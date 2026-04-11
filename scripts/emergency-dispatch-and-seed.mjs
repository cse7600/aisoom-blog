#!/usr/bin/env node
/**
 * 긴급 복구: 커뮤니티 소통 페이지 게시글 강제 발행
 *
 * 동작:
 *   1. community_script_cues (status=queued) 를 fire_at 무시하고 즉시 fire
 *      - post cue → community_posts INSERT + script status=posted
 *      - comment cue → 부모 post 존재 시 community_comments INSERT
 *   2. 시드 게시글 템플릿 30개를 community_posts 로 추가 INSERT
 *      - Gemini 호출 없이 하드코딩된 리얼한 한국 커뮤니티 글
 *      - 50명 페르소나 무작위 배정
 *   3. 각 시드 포스트에 댓글 2~4개 랜덤 생성
 *
 * Usage:
 *   node scripts/emergency-dispatch-and-seed.mjs
 *   node scripts/emergency-dispatch-and-seed.mjs --skip-dispatch
 *   node scripts/emergency-dispatch-and-seed.mjs --skip-seed
 *   node scripts/emergency-dispatch-and-seed.mjs --seed-count 50
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomBytes, scryptSync } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

loadEnv();

const args = parseArgs(process.argv.slice(2));
const SKIP_DISPATCH = Boolean(args["skip-dispatch"]);
const SKIP_SEED = Boolean(args["skip-seed"]);
const SEED_COUNT = clampInt(args["seed-count"], 30, 1, 100);

const { createClient } = await import("@supabase/supabase-js");
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const SEED_PASSWORD_HASH = hashPasswordScrypt("emergency-seed-ai");

async function main() {
  log("=== 긴급 복구 시작 ===");
  log(`flags: skip-dispatch=${SKIP_DISPATCH} skip-seed=${SKIP_SEED} seed-count=${SEED_COUNT}`);

  const dispatchResult = SKIP_DISPATCH
    ? { fired: 0, failed: 0, skipped: 0 }
    : await dispatchAllQueuedCues();
  log(
    `[dispatch] fired=${dispatchResult.fired} failed=${dispatchResult.failed} skipped=${dispatchResult.skipped}`
  );

  const seedResult = SKIP_SEED
    ? { posts: 0, comments: 0 }
    : await seedCommunityPosts(SEED_COUNT);
  log(`[seed] posts=${seedResult.posts} comments=${seedResult.comments}`);

  const { count } = await db
    .from("community_posts")
    .select("*", { count: "exact", head: true });
  log(`[verify] community_posts total count = ${count}`);

  if (count === 0) {
    console.error("[FATAL] 여전히 0건. 로그 확인 필요");
    process.exit(1);
  }
  log("=== 긴급 복구 완료 ===");
}

// ─── 큐 즉시 발사 ─────────────────────────────────────────────────────

async function dispatchAllQueuedCues() {
  const { data: cues, error } = await db
    .from("community_script_cues")
    .select(
      "id,script_id,cue_type,script_comment_id,persona_id,fire_at,status,attempt"
    )
    .eq("status", "queued")
    .order("fire_at", { ascending: true });
  if (error) {
    console.error("[dispatch] fetch cues error:", error.message);
    return { fired: 0, failed: 0, skipped: 0 };
  }
  log(`[dispatch] queued cues = ${cues.length}`);

  // 1단계: post cue 먼저 발사 (댓글은 parent post가 있어야 함)
  const postCues = cues.filter((cue) => cue.cue_type === "post");
  const commentCues = cues.filter((cue) => cue.cue_type === "comment");

  let fired = 0;
  let failed = 0;
  let skipped = 0;

  for (const cue of postCues) {
    const ok = await firePostCue(cue);
    if (ok) fired += 1;
    else failed += 1;
  }
  for (const cue of commentCues) {
    const outcome = await fireCommentCue(cue);
    if (outcome === "fired") fired += 1;
    else if (outcome === "skipped") skipped += 1;
    else failed += 1;
  }

  return { fired, failed, skipped };
}

async function firePostCue(cue) {
  try {
    const script = await loadScript(cue.script_id);
    if (!script) return markCueFailed(cue.id, "script not found");
    const persona = await loadPersona(cue.persona_id);
    if (!persona) return markCueFailed(cue.id, "persona not found");

    const createdAt = new Date().toISOString();
    const { data: post, error } = await db
      .from("community_posts")
      .insert({
        category: script.category,
        title: script.title,
        content: script.body,
        nickname: persona.nickname,
        password_hash: SEED_PASSWORD_HASH,
        ip_hash: null,
        is_ai_generated: true,
        persona_id: persona.id,
        created_at: createdAt,
      })
      .select("id")
      .single();
    if (error || !post) {
      return markCueFailed(cue.id, `insert post failed: ${error?.message}`);
    }

    await db
      .from("community_scripts")
      .update({ status: "posted", posted_post_id: post.id })
      .eq("id", script.id);

    await db
      .from("community_script_cues")
      .update({ status: "fired", fired_at: createdAt })
      .eq("id", cue.id);

    log(`[dispatch] post fired: ${script.title.slice(0, 30)}...`);
    return true;
  } catch (err) {
    return markCueFailed(cue.id, `exception: ${err?.message ?? err}`);
  }
}

async function fireCommentCue(cue) {
  try {
    if (!cue.script_comment_id)
      return markCueFailed(cue.id, "script_comment_id missing");

    const { data: scriptComment } = await db
      .from("community_script_comments")
      .select("*")
      .eq("id", cue.script_comment_id)
      .maybeSingle();
    if (!scriptComment)
      return markCueFailed(cue.id, "script_comment not found");

    const script = await loadScript(cue.script_id);
    if (!script) return markCueFailed(cue.id, "script not found");
    if (!script.posted_post_id) {
      // parent post가 아직 없음 → skip
      return "skipped";
    }
    const persona = await loadPersona(cue.persona_id);
    if (!persona) return markCueFailed(cue.id, "persona not found");

    let parentCommentId = null;
    if (scriptComment.parent_script_comment_id) {
      const { data: parent } = await db
        .from("community_script_comments")
        .select("posted_comment_id")
        .eq("id", scriptComment.parent_script_comment_id)
        .maybeSingle();
      parentCommentId = parent?.posted_comment_id ?? null;
    }

    const createdAt = new Date().toISOString();
    const { data: comment, error } = await db
      .from("community_comments")
      .insert({
        post_id: script.posted_post_id,
        parent_id: parentCommentId,
        nickname: persona.nickname,
        password_hash: SEED_PASSWORD_HASH,
        content: scriptComment.content,
        ip_hash: null,
        is_ai_generated: true,
        persona_id: persona.id,
        created_at: createdAt,
      })
      .select("id")
      .single();
    if (error || !comment)
      return markCueFailed(cue.id, `insert comment failed: ${error?.message}`);

    await db
      .from("community_script_comments")
      .update({ status: "posted", posted_comment_id: comment.id })
      .eq("id", scriptComment.id);

    await db
      .from("community_script_cues")
      .update({ status: "fired", fired_at: createdAt })
      .eq("id", cue.id);

    return "fired";
  } catch (err) {
    return markCueFailed(cue.id, `exception: ${err?.message ?? err}`);
  }
}

async function markCueFailed(cueId, message) {
  await db
    .from("community_script_cues")
    .update({ status: "failed", error: message })
    .eq("id", cueId);
  console.error(`[dispatch] cue ${cueId} failed: ${message}`);
  return false;
}

async function loadScript(scriptId) {
  const { data } = await db
    .from("community_scripts")
    .select("id,script_code,category,title,body,posted_post_id")
    .eq("id", scriptId)
    .maybeSingle();
  return data;
}

async function loadPersona(personaId) {
  const { data } = await db
    .from("discussion_personas")
    .select("id,nickname")
    .eq("id", personaId)
    .maybeSingle();
  return data;
}

// ─── 시드 게시글 생성 (템플릿 기반, LLM 불필요) ──────────────────────

const SEED_TEMPLATES = [
  {
    category: "free",
    title: "요즘 월급 들어오면 제일 먼저 하는 일",
    content:
      "월급 들어오면 예전엔 뭐부터 살지 설렜는데 요새는 카드값부터 확인함. 카드 긁은거 보면서 내가 이걸 왜 샀지 매번 후회하는중.\n\n그래도 한 달 중에 월급날이 제일 기분 좋긴 한듯. 다들 월급 들어오면 뭐부터 해요? 저는 커피 한 잔은 꼭 사먹음",
    commentPool: [
      "ㅋㅋㅋ 저도 월급날 스벅 한잔이 루틴임",
      "저는 월급 들어오면 바로 반은 적금으로 빠져서 들어온 지도 모름",
      "공감합니다 ㅠ 카드값이 월급의 70프로는 되는듯",
      "월급날 = 카드값날 ㅇㅈ",
    ],
  },
  {
    category: "free",
    title: "주말에 집에만 있는 게 그렇게 이상한가요",
    content:
      "주말에 뭐했냐고 물어보길래 집에서 쉬었다고 하니까 왜 그렇게 사냐고 함. 나가서 뭐라도 해야되는거 아니냐면서.\n\n근데 저는 집에서 영화보고 라면 끓여먹고 낮잠 자는 게 제일 좋은데 이게 그렇게 별난건가요? 평일 내내 사람 만나는 일이라 주말은 진짜 아무도 안만나고 싶음",
    commentPool: [
      "전혀 안이상해요 저도 똑같음",
      "주말엔 집이 제일 편하죠 남들 신경쓰지 마세요",
      "에너지 쓰는 스타일이 달라서 그래요. 저도 내향형",
      "나가야 잘 산다는 강박이 문제임",
    ],
  },
  {
    category: "free",
    title: "요즘 자꾸 예전 노래만 듣게 되네",
    content:
      "출퇴근길에 요즘 노래 들어봐도 귀에 안꽂혀서 자꾸 10년 전 노래로 돌아감. 나이 먹었다는 건가 싶기도 하고.\n\n특히 출근길엔 발라드는 절대 금지고 좀 빠른 거 들어야 그나마 살만함. 다들 어떤 노래 들으면서 출근해요?",
    commentPool: [
      "저도요 ㅋㅋ 요새는 2015년 곡들이 제일 편함",
      "출근길에 발라드는 진짜 죽음이죠",
      "아 그 시절 노래가 진짜 명곡이 많았던듯",
      "요즘 곡 안들어온다고 나이먹은건 아니에요 저는 20대인데도 그럼",
    ],
  },
  {
    category: "qna",
    title: "전세자금대출 금리 2.8 vs 3.2 어디가 나은가요",
    content:
      "이사 앞두고 있어서 전세자금대출 알아보는중인데 A은행은 2.8에 고정금리 5년이고 B은행은 3.2에 변동금리임. 변동이 떨어질수도 있는데 요즘 분위기 보면 올라갈 확률이 더 높은거 같기도 하고.\n\n고정이 안전한건 알겠는데 2.8도 비싸다는 사람도 있고. 경험 있으신 분들 조언좀",
    commentPool: [
      "무조건 고정이요. 금리가 내려갈거면 갈아타면 되는데 오르면 답 없어요",
      "저는 작년에 변동으로 받았다가 지금 이자 거의 2배 나감 ㅠㅠ 고정 추천",
      "요즘 시장 분위기 보면 당분간 금리 인하 쉽지 않을듯. 고정 안전",
      "중간에 대환 수수료도 계산해보세요. 생각보다 많아요",
    ],
  },
  {
    category: "qna",
    title: "4년 된 냉장고 소음 이거 수리해야되나요",
    content:
      "어느 날부터 냉장고에서 윙윙 소리가 평소보다 커진 느낌. AS 부르면 출장비만 3만원이라는데 그냥 둬도 되는지 수리를 해야되는지 판단이 안섬.\n\n소리 외엔 냉장 냉동 다 잘됨. 전기세도 비슷한거 같고. 혹시 비슷한 경험 있으신 분 계실까요",
    commentPool: [
      "컴프레서 나가기 전 신호일수도 있어요 빨리 체크 추천",
      "저도 똑같은 증상이었는데 먼지만 청소했더니 조용해졌음. 한번 뒤쪽 방열판 확인해보세요",
      "4년이면 아직 이른데 공장 불량일수도. AS 센터 한번 불러보시는게 나을듯",
      "사용설명서에 청소 주기 있어요. 그대로 하면 많이 조용해짐",
    ],
  },
  {
    category: "qna",
    title: "프린터 사려는데 잉크젯 vs 레이저 뭐가 나을까요",
    content:
      "재택 일로 서류 인쇄 많아서 프린터 하나 사려고 알아보는중. 잉크젯은 싸지만 잉크값이 비싸다고 하고 레이저는 본체가 비싼 대신 오래 쓴다고 하는데.\n\n한달에 한 200장 정도 인쇄할거 같고 컬러는 거의 안쓸듯. 추천 좀 부탁드려요",
    commentPool: [
      "월 200장이면 무조건 레이저에요. 잉크젯은 오래 안쓰면 헤드 막혀서 고장납니다",
      "저는 잉크젯 샀다가 6개월만에 버렸음. 레이저 강추",
      "흑백 레이저 15만원대면 괜찮은거 많아요",
      "사무용이면 레이저 답. 잉크젯은 진짜 사진 인쇄 필요할때만",
    ],
  },
  {
    category: "review",
    title: "샤오미 로봇청소기 3개월 써본 솔직 후기",
    content:
      "본가 청소 도와드린다고 로봇청소기 샀는데 3개월 써보니까 장단점이 확실함.\n\n장점: 바닥에 뭐 안떨어져있으면 깔끔하게 돌림. 매트 위는 못올라가는데 평지는 완벽\n단점: 의자 다리 사이에 끼면 구조요청 울림. 카펫 긴거 못타넘음\n\n가격 대비는 만족하는데 기대치 높으면 실망할수있음",
    commentPool: [
      "ㅋㅋ 의자다리에 끼는거 공감. 저희집도 매일 구조함",
      "저는 본가 거 사드렸더니 부모님이 진심 좋아하심. 효도템",
      "카펫 못올라가는거 맞아요. 근데 그 가격에 그것까지 바라는건 욕심",
      "청소하기 전에 물건 치우는게 일이 됨 ㅠ",
    ],
  },
  {
    category: "review",
    title: "나이키 페가수스 40 3개월 러닝 후기",
    content:
      "작년까지 39 신다가 40으로 넘어왔는데 39보다 쿠션이 좀 딱딱해진 느낌. 대신 반발력은 나아짐.\n\n주 4회 5키로씩 뛰는데 무릎 부담은 덜한편. 출근용으로는 살짝 과한 느낌이고 러닝 전용으로 쓰는중. 가격 대비는 괜찮음",
    commentPool: [
      "저는 39가 더 좋았던거같음. 40은 밑창이 딱딱",
      "페가수스가 처음 러닝화면 딱 무난하죠",
      "5키로 페이스 얼마에 뛰세요? 저도 페가수스 쓰는데 궁금",
      "러닝 전용으로 쓰시는거 추천드려요. 평상시엔 너무 아까움",
    ],
  },
  {
    category: "review",
    title: "다이소 3천원 무선마우스 한달 후기",
    content:
      "농담으로 산건데 생각보다 잘됨. 배터리 하나로 한달 넘게 쓰는중이고 클릭감도 나쁘지 않음.\n\n단점은 휠 스크롤이 좀 뻑뻑한거랑 살짝 무거운 정도? 사무용으론 진심 추천. 이 가격에 이 퀄리티는 반칙임",
    commentPool: [
      "다이소 요즘 퀄리티 미침. 진심 저도 놀람",
      "AS는 안되니까 고장나면 버린다는 마인드로 쓰면 최고",
      "전 2천원짜리 유선도 잘씀. 3천원이면 고급형",
      "이거 사러가야겠다 정보 ㄱㅅ",
    ],
  },
  {
    category: "info",
    title: "카드 실적 덜 채우고도 혜택 받는 방법",
    content:
      "카드 실적 30만원인데 매달 모자람. 근데 이번에 알게된건데 정기결제(유튜브, 통신비) 등록해두면 실적에 잡혀요.\n\n저는 넷플릭스 + 통신비로 고정 3만원 잡히고 나머지는 대중교통으로 커버. 이거 모르고 매달 실적 놓쳤던 사람 있으면 확인해보세요",
    commentPool: [
      "오 이거 저도 몰랐던 꿀팁. 감사합니다",
      "카드마다 정기결제 인정 여부 달라서 확인 필수에요",
      "저는 네이버페이 충전도 실적 잡혀서 그거 쓰는중",
      "통신비 꼭 확인하세요 어떤 카드는 제외됨",
    ],
  },
  {
    category: "info",
    title: "주말 근교 당일치기 가볼만한 곳 공유",
    content:
      "차 있는 분들 주말에 어디갈지 고민될때 추천:\n- 양평 두물머리 (사진 예쁨)\n- 가평 아침고요수목원 (식물 좋아하면)\n- 강화도 (회 먹으러)\n- 포천 산정호수 (걷기 좋음)\n\n다 서울에서 1시간 반 안쪽임. 다른 곳도 추천 있으면 공유해주세요",
    commentPool: [
      "저는 요즘 가평 자주가요 카페가 엄청 많아짐",
      "두물머리 주말엔 사람 너무 많아서 평일 반차 추천",
      "강화도 회 어디가 맛있나요? 추천 부탁",
      "포천 산정호수 좋죠. 드라이브 + 산책 조합 최고",
    ],
  },
  {
    category: "info",
    title: "앱테크 3개월 해본 결과 진짜 솔직하게",
    content:
      "토스 만보기, 캐시워크, 오락, 모니모 다 해봤는데 결론은 시간 대비 효율 진짜 낮음. 하루 10분 써서 하루에 300원 나옴.\n\n그래도 출근길에 습관처럼 하면 한달 치킨 한마리값은 나오니까 푼돈이라 생각하면 나쁘진 않음. 다만 이거에 시간 많이 쓰면 손해",
    commentPool: [
      "진짜 시간 대비는 별로인데 습관되면 그냥 함",
      "저는 토스 만보기만 함. 나머지 다 정리",
      "커피값 벌려고 하면 오히려 스트레스",
      "가족 다 초대해서 하면 확실히 좀 나음",
    ],
  },
  {
    category: "humor",
    title: "출근길 지하철에서 있었던 황당한 일",
    content:
      "어제 출근길에 졸려서 서서 자고있었는데 옆 아저씨가 내 가방을 툭툭 치면서 깨움. 뭐지 싶었는데 내 지갑이 가방 밖으로 삐져나와 있었던것.\n\n고마운데 너무 부끄러워서 인사도 못하고 내렸음. 지하철에 좋은 사람 많네요",
    commentPool: [
      "좋은 사람 맞네요. 덕분에 지갑 지켰네",
      "ㅋㅋ 저도 비슷한 일 있었는데 너무 부끄러워서 다음역에서 내림",
      "요즘 세상에 이런 사람 진짜 드뭄",
      "고맙다고 인사할걸 그랬네요 ㅎㅎ",
    ],
  },
  {
    category: "humor",
    title: "우리집 강아지가 나를 호구로 보는거같음",
    content:
      "간식통 숨겨놔도 귀신같이 찾아냄. 자기가 안좋아하는 사료는 입에만 물고 있다가 내가 안볼때 뱉어버리고 맛있는거 달라고 눈빛공격.\n\n결국 오늘도 져서 닭가슴살 삶아줌. 제가 호구인건지 얘가 영리한건지",
    commentPool: [
      "둘다임 ㅋㅋㅋ",
      "강아지가 집사를 고르는 거에요",
      "저도 어제 눈빛에 져서 편의점 다녀옴",
      "닭가슴살 자주 주면 치아에도 좋대요. 잘하고 계심",
    ],
  },
  {
    category: "humor",
    title: "편의점 신상 라면 후기 (엉망진창 버전)",
    content:
      "편의점에서 신상 라면 샀는데 포장지 색이 너무 예뻐서 기대함. 끓이고 보니까 국물이 핑크색. 맛은 토마토 + 김치 섞은 느낌.\n\n반은 먹고 반은 버림. 다시는 색깔만 보고 라면 안삼. 다들 조심하세요",
    commentPool: [
      "핑크 국물은 진짜 공포네요 ㅋㅋㅋㅋ",
      "저는 녹색 라면 먹다가 같은 경험함",
      "라면은 빨간색이나 갈색이 진리",
      "포장지 예쁜 라면은 함정이다 ㅇㅈ",
    ],
  },
  {
    category: "free",
    title: "10년 만에 동창회 갔다 온 후기",
    content:
      "고등학교 동창회 오랜만에 갔는데 다들 너무 변해서 못알아봄. 애 둘 키우는 애도 있고 아직 학생인 애도 있고.\n\n그래도 그때 추억 얘기할 때는 다 그대로인 느낌. 가끔은 이런 자리 필요한듯",
    commentPool: [
      "저는 동창회 한번 가봤다가 어색해서 다신 안감",
      "고등학교 친구가 진짜 오래 가는듯",
      "다들 잘 사는거 보면 기분 좋죠",
      "나이들수록 옛날 친구가 편함",
    ],
  },
  {
    category: "qna",
    title: "부모님 선물 건강식품 뭐가 좋을까요",
    content:
      "부모님 환갑 앞두고 선물 고민중인데 건강식품 쪽으로 알아보고 있음. 홍삼은 이미 드시고 계시고 영양제는 뭘 사야할지 모르겠음.\n\n50만원 이하 예산에서 실제로 드려서 좋았던 거 추천 부탁드려요",
    commentPool: [
      "차라리 종합검진권을 드리는건 어떠세요. 저는 그게 제일 반응 좋았음",
      "비타민D + 오메가3 조합 좋아요. 요즘 어르신들 필수",
      "정관장 에브리타임 휴대하기 좋아서 좋아하심",
      "먹는거보다 안마기 같은거 실용적인거 추천",
    ],
  },
  {
    category: "review",
    title: "3개월 걸어서 10키로 뺀 후기",
    content:
      "작년에 살 10키로 쪘다가 3개월 걸어서 다 뺐음. 특별한거 없고 그냥 매일 만보 걷고 저녁을 샐러드로 대체.\n\n힘들긴 했는데 운동 안해도 되니까 무릎 부담 적음. 근데 진짜 인내가 필요함. 첫 2주는 도망가고 싶었음",
    commentPool: [
      "10키로 진짜 대단하네요. 저는 3키로도 못뺐음",
      "걷기가 제일 지속가능한듯. 헬스는 오래 못감",
      "저녁 샐러드 한달하면 진짜 미쳐버림 ㅠ 어떻게 버티셨어요",
      "만보 걷는거 생각보다 어려워요. 꾸준함이 답",
    ],
  },
  {
    category: "info",
    title: "이사 포장이사 vs 반포장 경험 공유",
    content:
      "작년에 반포장, 올해 포장이사 둘다 해봤는데 가격 차이가 40만원 정도였음. 결론: 짐 많으면 무조건 포장이사.\n\n반포장은 그릇이나 옷 정리를 직접 해야되는데 이게 시간이 진짜 오래걸림. 일한다고 하면 못함. 지방이사면 더더욱 포장이사 추천",
    commentPool: [
      "저는 집이 작아서 반포장으로도 충분했음. 원룸은 반포장 추천",
      "포장이사 업체 잘 고르세요. 싸다고 막 부르면 험하게 다룸",
      "이사 업체 리뷰 꼭 확인하세요. 인터넷 카페 정보가 최고",
      "저는 포장이사 샀는데도 스트레스 받았음 ㅠ",
    ],
  },
  {
    category: "free",
    title: "퇴근하고 나서 아무것도 안하기로 결심함",
    content:
      "몇 년동안 퇴근하고 뭐라도 해야된다는 강박 있었는데 요새는 그냥 누워서 영상보는거로 방향 틀었음.\n\n처음엔 시간 낭비같아서 죄책감 들었는데 일주일 해보니까 컨디션이 더 좋음. 잘 쉬는것도 실력이라는 말 맞는듯",
    commentPool: [
      "잘쉬는게 다음날 효율을 결정함. 현명한 선택",
      "저도 요새 똑같은 고민. 뭘 해야될거같은데 너무 지침",
      "한국인들이 너무 자기한테 박한듯",
      "주말에 쉬면 죄책감 드는거 안고 있는데 고쳐야될듯",
    ],
  },
  {
    category: "qna",
    title: "차 처음 사려는데 신차 vs 중고 뭐가 나아요",
    content:
      "직장 출퇴근용으로 차 사려고 하는데 신차 사면 5년 할부로 월 40만원이고 중고는 3-4년된걸로 1500만원 일시불 가능함.\n\n신차가 편하긴 한데 부담스럽고 중고는 수리비 걱정. 첫차면 어떤게 나을까요",
    commentPool: [
      "첫차는 무조건 중고 추천. 초보운전은 긁어먹을 확률 100프로",
      "근데 요즘 중고차 시장이 너무 이상해서 신차 사는 사람들도 많아짐",
      "3-4년된 차는 가성비 좋음. 감가상각이 가장 큰 시기 지남",
      "현금으로 살수있으면 중고 ㄱㄱ 할부는 진짜 부담",
    ],
  },
  {
    category: "review",
    title: "구글 픽셀 한달 써본 후기 (갤럭시 사용자가)",
    content:
      "갤럭시 쓰다가 픽셀 서브로 한달 써봄. 카메라는 진짜 좋음 특히 야간 모드. 단점은 앱 호환성. 카카오뱅크 일부 기능 안됨.\n\n메인폰으로 쓰기엔 불편하고 서브폰으로는 좋음. 한국에선 갤럭시가 편하긴 함",
    commentPool: [
      "국내용으론 갤럭시 아이폰만 답이에요. 픽셀은 해외여행용",
      "카메라 진짜 픽셀이 원탑이긴 함. AI가 좋은듯",
      "한국 앱 호환성이 진짜 걸림돌이죠",
      "픽셀 순정 안드로이드가 편하다는 사람도 많음",
    ],
  },
  {
    category: "info",
    title: "국내 여행 숙소 저렴하게 잡는 꿀팁",
    content:
      "여행 자주 다니면서 터득한 거:\n- 부킹닷컴 회원등급 올리면 10~20프로 할인\n- 네이버 스마트스토어가 의외로 저렴\n- 평일 출발이 주말 출발보다 40프로 싸\n- 성수기 피하기 (3월, 10월 추천)\n\n이렇게만 해도 숙박비 반으로 줄어요",
    commentPool: [
      "네이버 스마트스토어 몰랐네요. 확인해봐야지",
      "성수기 피하면 진짜 싸긴한데 일정 맞추기 어려움",
      "저는 야놀자 쿠폰 모아서 써요. 쏠쏠함",
      "부킹 지니어스 레벨 올리면 좋긴해요",
    ],
  },
  {
    category: "humor",
    title: "우리 부장님의 카톡 문자 충격 실화",
    content:
      "부장님이 카톡으로 뭔가 보내셨는데 이모티콘으로만 '^^ ㅎㅎ ㅇㅋ' 이렇게 와서 긴 설명 보내드렸더니 답이 '응' 한글자.\n\n그래서 다시 여쭤보니까 30분 후에 전화옴. 그냥 전화하지 왜 카톡으로...",
    commentPool: [
      "ㅋㅋㅋㅋㅋ 저희 팀장님이랑 똑같음",
      "어르신들 카톡은 진짜 해독이 어려움",
      "그럴거면 카톡을 왜...",
      "저희 아빠는 전화번호만 보내시고 끝. 알아서 읽으라는듯",
    ],
  },
  {
    category: "free",
    title: "자취 5년차 혼자 밥 먹는 팁 공유",
    content:
      "자취하면 밥해먹는게 제일 귀찮은데 저는 일주일치 반찬 주말에 대량으로 만들어둠.\n- 김치찌개 2일치\n- 계란말이 3일치\n- 나물 무침 1주일치\n\n이러면 평일엔 라면 대신 밥 먹게됨. 자취 초보면 추천",
    commentPool: [
      "미리해두면 편하긴한데 저는 반찬 질려서 못함 ㅠ",
      "저는 밀키트에 의존해요. 요새 밀키트 퀄 좋음",
      "계란말이 3일차는 진짜 노답인데 대단",
      "대량 조리가 가장 경제적임. 인정",
    ],
  },
  {
    category: "qna",
    title: "노트북 교체 주기 얼마정도가 적당한가요",
    content:
      "쓰던 노트북이 5년 됐는데 성능은 아직 괜찮음. 근데 배터리가 3시간밖에 안가고 키보드 몇 개 눌림이 이상함.\n\n새로 살까 고민인데 5년이면 교체해야될 때인지 아니면 더 써도 되는지 궁금",
    commentPool: [
      "SSD 교체 + 배터리 교체로 한 2년은 더 버틸수있어요",
      "5년이면 슬슬 교체 시기긴 한데 쓰임새에 따라 다름",
      "저는 7년쓰다가 교체했는데 진작 바꿀걸 후회중. 새거 너무 쾌적",
      "사무용이면 그냥 써도 될듯. 영상편집이면 바꾸고",
    ],
  },
  {
    category: "review",
    title: "3개월 동안 헬스장 다닌 결과 솔직하게",
    content:
      "작심삼일 탈출한다고 PT 10회 끊고 시작. 3개월 다녀본 결과:\n- 체중은 2키로 빠짐 (생각보다 적음)\n- 근력은 확실히 늘음\n- 자세가 좋아졌다는 얘기 들음\n- 피로도는 오히려 줄음\n\n체중감량 목표면 식단이 답. 헬스만으론 부족함",
    commentPool: [
      "ㅇㅈ. 살은 부엌에서 빼는거임",
      "PT 10회는 진짜 입문용이죠 20회는 돼야 효과",
      "근력 느는거 체감되면 그게 진짜 재밌어짐",
      "3개월 다닌것만으로도 대단함. 대부분 1달 안에 포기",
    ],
  },
  {
    category: "info",
    title: "연말정산 미리 챙기면 좋은 것들",
    content:
      "연말정산 시즌 오기 전에 미리 체크할것:\n- 월세 세액공제 (계약서 + 이체내역)\n- 의료비 (안경도 포함됨)\n- 기부금\n- 체크카드 사용액 30프로 이상 맞추기\n\n특히 월세는 놓치는 사람 많아요. 확정일자 받으시고 계약서 챙기세요",
    commentPool: [
      "월세 공제 진짜 중요함. 저 이거로 20만원 돌려받음",
      "안경이 의료비에 들어가는거 몰랐네요. 감사",
      "체크카드 30프로 맞추기 은근 어려움",
      "기부금도 잊지 말고 챙기세요",
    ],
  },
  {
    category: "humor",
    title: "엄마가 나한테 카톡 보낸거 모음",
    content:
      "엄마 카톡 모음:\n1. '잘 지내니 ㅇㅇ' (이름 두번)\n2. '밥 먹었어? 어??' (물음표 두번)\n3. '엄마가' 뒤에 아무 내용 없음\n4. 내 이름으로 '여보세요' 라고 보냄\n\n엄마는 진짜 카톡을 통화로 착각하는듯",
    commentPool: [
      "ㅋㅋㅋㅋㅋ 여보세요 진짜 공감",
      "저희 엄마도 카톡 보내시다가 답답하면 전화하심",
      "엄마들만의 카톡 언어가 있음 ㅇㅈ",
      "아빠는 진짜 더 심함. 스티커만 보내고 끝",
    ],
  },
  {
    category: "free",
    title: "최근에 가장 돈 잘 썼다고 생각한 거",
    content:
      "요즘 생활용품에 돈 좀 쓰는데 그중에 제일 잘산건 무선 청소기. 예전엔 청소 이틀에 한번 겨우 했는데 지금은 매일 돌림.\n\n편해지니까 청소 자체가 귀찮지 않게 됨. 생활의 질이 확실히 좋아짐. 다들 돈 잘 썼다고 생각하는거 뭐 있어요?",
    commentPool: [
      "식기세척기요. 이거 없으면 이제 못삼",
      "저는 좋은 매트리스. 잠의 질이 달라짐",
      "무선청소기 저도 극극추천 본가에도 사드림",
      "건조기가 신세계. 빨래스트레스 해방",
    ],
  },
];

async function seedCommunityPosts(count) {
  const { data: personasRaw } = await db
    .from("discussion_personas")
    .select("id,nickname")
    .eq("active", true);
  const personas = personasRaw ?? [];
  if (personas.length === 0) {
    console.error("[seed] active persona 없음. 중단");
    return { posts: 0, comments: 0 };
  }

  const now = Date.now();
  let postsCreated = 0;
  let commentsCreated = 0;

  for (let index = 0; index < count; index += 1) {
    const template = SEED_TEMPLATES[index % SEED_TEMPLATES.length];
    const author = pickRandom(personas);

    // 과거 시점으로 분산 배치 (최근 14일 내)
    const minutesAgo = Math.floor(Math.random() * 14 * 24 * 60);
    const postCreatedAt = new Date(now - minutesAgo * 60 * 1000).toISOString();

    const { data: post, error } = await db
      .from("community_posts")
      .insert({
        category: template.category,
        title: variateTitle(template.title, index),
        content: template.content,
        nickname: author.nickname,
        password_hash: SEED_PASSWORD_HASH,
        ip_hash: null,
        is_ai_generated: true,
        persona_id: author.id,
        view_count: Math.floor(Math.random() * 400) + 20,
        created_at: postCreatedAt,
      })
      .select("id")
      .single();

    if (error || !post) {
      console.error(`[seed] post insert failed #${index}:`, error?.message);
      continue;
    }
    postsCreated += 1;

    const commentCount = 2 + Math.floor(Math.random() * 3); // 2~4개
    const usedCommenters = new Set([author.id]);
    const poolCopy = [...template.commentPool].sort(() => Math.random() - 0.5);

    for (let cIdx = 0; cIdx < commentCount && cIdx < poolCopy.length; cIdx += 1) {
      const commenter = pickCommenter(personas, usedCommenters);
      if (!commenter) break;
      usedCommenters.add(commenter.id);

      const commentCreatedAt = new Date(
        new Date(postCreatedAt).getTime() +
          (10 + Math.floor(Math.random() * 240)) * 60 * 1000
      ).toISOString();

      const { error: cErr } = await db.from("community_comments").insert({
        post_id: post.id,
        parent_id: null,
        nickname: commenter.nickname,
        password_hash: SEED_PASSWORD_HASH,
        content: poolCopy[cIdx],
        ip_hash: null,
        is_ai_generated: true,
        persona_id: commenter.id,
        created_at: commentCreatedAt,
      });
      if (!cErr) commentsCreated += 1;
    }
  }

  return { posts: postsCreated, comments: commentsCreated };
}

function variateTitle(base, index) {
  // 동일 템플릿 여러번 쓸 때 제목 살짝 다르게
  if (index < SEED_TEMPLATES.length) return base;
  const suffixes = [" (추가)", "", " 2편", ""];
  return base + (suffixes[index % suffixes.length] ?? "");
}

function pickCommenter(personas, exclude) {
  const available = personas.filter((persona) => !exclude.has(persona.id));
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// ─── 유틸 ─────────────────────────────────────────────────────────────

function hashPasswordScrypt(plain) {
  const salt = randomBytes(16);
  const derived = scryptSync(plain, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.+)$/);
    if (match) {
      process.env[match[1].trim()] = match[2]
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  }
}

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      index += 1;
    }
  }
  return out;
}

function clampInt(raw, fallback, min, max) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

main().catch((err) => {
  console.error("[emergency-dispatch-and-seed] 실패:", err);
  process.exit(1);
});
