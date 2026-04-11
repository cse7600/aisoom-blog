#!/usr/bin/env node
/**
 * Phase 9.2 — 레이어1 댓글 품질 보정
 *
 * 실측 지표 (fix 전):
 *   - 평균 길이 103자 (목표 150자)
 *   - <80자 댓글 83개 (34.6%)
 *   - 질문 비율 8.8% (목표 22%)
 *   - generic 문구 다수 ("정보 감사합니다", "굿정보", "ㄱㅅ")
 *
 * 전략:
 *   1) <40자 generic lurker 댓글 → 구체적 lurker 질문·보충으로 재작성
 *   2) <80자 casual 댓글 → 동일 페르소나 문체로 150자+ 확장
 *   3) 포스트 topic별 질문 1개 보장 (질문 비율 22% 달성)
 *
 * DRY-RUN: node scripts/inject-discussions-quality-fix.mjs --dry
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf-8").split("\n")) {
  const match = line.match(/^([^#=]+)=(.+)$/);
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const isDryRun = process.argv.includes("--dry");

// ─── 짧은 generic lurker 댓글 대체 ────────────────────────────────────────
// content 패턴 기준 매핑. 포스트별 topic 컨텍스트를 섞어 자연스럽게 확장.

const GENERIC_PATTERNS = [
  /^정보\s*감사/,
  /^좋은\s*정보/,
  /^참고할게요/,
  /^굿정보/,
  /^ㄱㅅ/,
  /^감사합니다$/,
  /^신청해봐야/,
  /^\.$/,
];

// 슬러그별 자연스러운 lurker 발화 풀 — generic 문구 대체용
const LURKER_POOL_BY_TOPIC = {
  corporation: [
    "아 저도 1인 법인 알아보고 있었는데 이 글이 딱이네요 정관 작성 부분이 제일 막혔거든요 혹시 자본금 100만원으로 시작해도 나중에 증자할 때 문제 없는지 궁금해요",
    "법인 전환 시뮬레이션 보면 매출 기준이 7천만원쯤이라 들었는데 지역 세무사마다 기준이 다르다고 해서 혼란스러워요 저처럼 온라인 판매만 하는 경우도 같은 기준인지 경험 있으신 분 계신가요",
    "지금 개인사업자 4년째인데 법인 전환을 계속 고민 중이에요 직원 뽑는 타이밍이랑 맞물려서 한꺼번에 처리하려고 하는데 그 경우에 주의할 점이 따로 있는지 궁금합니다",
  ],
  cctv: [
    "편의점 7평 정도 공간에 4채널 설치 고민 중이었는데 이 글 덕분에 비교 지점이 명확해졌어요 혹시 야간에 유리창 반사가 심한 환경이면 카메라 위치를 어디에 두는 게 좋은지 추가로 여쭤봐도 될까요",
    "매장 오픈 준비하면서 CCTV 견적 비교 중인데 3년 약정 위약금이 진짜 무서운 부분이었어요 렌탈 업체마다 계약서 샘플 공유받아서 조항 비교해보는 게 확실히 안전한 것 같습니다",
    "저희 매장은 창문 쪽이 커서 역광 문제로 고민 중인데 혹시 HDR 지원되는 모델이 꼭 필요한지 아니면 각도 조절로 해결 가능한지 현장 경험 있으신 분 조언 부탁드려요",
  ],
  tax: [
    "부가세 신고 직전인데 이 글 보고 다행히 놓친 부분 잡았어요 법인카드 경비 처리 기준이 개인사업자랑 달라서 한참 헤맸거든요 확실히 정리된 글이 필요했는데 감사합니다",
    "종합소득세 vs 법인세 계산식을 엑셀로 직접 돌려봤는데 글에 나온 숫자랑 거의 일치해서 신뢰가 갑니다 혹시 중간예납 기간도 이 계산에 반영되는 건지 궁금해요",
    "세무사비 포함한 실제 총비용이 제일 헷갈리는 부분인데 이번 글에서 감 잡았어요 다만 지역별 수수료 차이가 꽤 크다고 들어서 서울 기준인지 아니면 전국 평균인지 확인해보고 싶습니다",
  ],
  general: [
    "오래 고민하던 주제인데 이렇게 구체적인 수치가 나온 글 처음 봤어요 다른 블로그는 대부분 원론적인 설명만 있어서 답답했거든요 저 같은 초보에게 진짜 도움이 됩니다",
    "친구가 비슷한 고민 중이라 이 글 공유해줬는데 바로 저장해두더라구요 실제 경험 기반 글이 이렇게 값진 거였네요 댓글도 다들 현장 경험 많으신 분들이라 더 믿음이 갑니다",
    "북마크 해두고 필요할 때마다 찾아볼 예정입니다 다만 한 가지 궁금한 건 표에 나온 비용이 부가세 포함인지 별도인지 애매하게 느껴져서요 확인 가능하실까요",
  ],
};

function pickTopic(slug) {
  if (/corporation|corp|vat|tax/i.test(slug)) {
    if (/vat|tax/i.test(slug)) return "tax";
    return "corporation";
  }
  if (/cctv|keeper|caps|secom|cafe|store/i.test(slug)) return "cctv";
  return "general";
}

function pickReplacement(slug, seed) {
  const topic = pickTopic(slug);
  const pool = LURKER_POOL_BY_TOPIC[topic] ?? LURKER_POOL_BY_TOPIC.general;
  return pool[seed % pool.length];
}

// ─── casual 댓글 확장 (80~150자) ──────────────────────────────────────────
// 문장 끝에 자연스런 질문 또는 구체적 경험을 한 문장 더 붙인다.
const CASUAL_EXTENSIONS_BY_TOPIC = {
  corporation: [
    " 저희 동네 세무사는 법인 전환 패키지 150만원이라고 하시던데 이 금액이 평균인지 궁금해요.",
    " 법인 전환하고 첫 달 기장료가 생각보다 부담이라는 얘기도 많던데 실제 체감이 어떠세요?",
    " 설립 후에 법인 통장 개설이 은행마다 까다롭다고 하던데 제일 수월했던 은행 있으신가요?",
  ],
  cctv: [
    " 혹시 설치 후에 와이파이로 원격 접속할 때 끊김 현상 있으셨는지 궁금합니다.",
    " 설치 기사님이 공사 시간 대략 몇 시간 걸린다고 하시던가요 매장 휴무를 잡아야 해서요.",
    " 저는 야간 알림이 너무 자주 울려서 민감도 조절이 관건이었거든요 혹시 비슷한 경험 있으세요?",
  ],
  tax: [
    " 세무사 수수료를 월 고정으로 할지 건당으로 할지 고민 중인데 의견 주실 분 계신가요?",
    " 저도 올해부터 법인 전환 검토 중인데 중간예납 기간 놓치지 않도록 캘린더 알림 걸어둬야겠네요.",
    " 종합소득세 신고 기간이랑 겹칠 때 우선순위는 어떻게 잡으시는지 궁금합니다.",
  ],
  general: [
    " 글 마지막 부분에 추가로 참고할 자료가 있다면 출처도 함께 알려주실 수 있을까요?",
    " 저도 비슷한 고민으로 밤새 검색했는데 이 글이 가장 정리 잘돼있어서 링크 걸어뒀습니다.",
    " 혹시 비슷한 주제로 업데이트 글 예정이신지 구독해두고 싶네요.",
  ],
};

function extendCasual(existing, slug, seed) {
  const topic = pickTopic(slug);
  const pool = CASUAL_EXTENSIONS_BY_TOPIC[topic] ?? CASUAL_EXTENSIONS_BY_TOPIC.general;
  const addition = pool[seed % pool.length];
  return existing.trim().replace(/\.+$/, "") + "." + addition;
}

// ─── 질문 변환 ────────────────────────────────────────────────────────────
// 포스트별 기존 댓글 중 statement 1~2개를 질문형으로 변환하여 질문 비율 22% 확보.

function toQuestion(content, slug) {
  const topic = pickTopic(slug);
  const templates = {
    corporation: " 혹시 이 부분 경험 있으신 분들은 어떻게 처리하셨나요?",
    cctv: " 비슷한 환경에서 설치해보신 분들 조언 부탁드립니다.",
    tax: " 이 경우 실제 신고 때는 어떤 근거로 기재해야 할지 알려주실 수 있을까요?",
    general: " 이 부분에 대해 추가로 알고 계신 분 의견 듣고 싶어요.",
  };
  const trimmed = content.trim().replace(/[.?!]+$/, "");
  return trimmed + "." + templates[topic];
}

// ─── 메인 로직 ────────────────────────────────────────────────────────────
async function fetchDiscussions() {
  const { data, error } = await supabase
    .from("post_discussions")
    .select("id,post_slug,content,is_question,persona_id,quality_tier")
    .order("created_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function updateDiscussion(id, content, isQuestion) {
  if (isDryRun) return;
  const patch = { content, char_count: content.length };
  if (typeof isQuestion === "boolean") patch.is_question = isQuestion;
  const { error } = await supabase
    .from("post_discussions")
    .update(patch)
    .eq("id", id);
  if (error) console.error(`  update ${id}: ${error.message}`);
}

function isGeneric(content) {
  const trimmed = (content ?? "").trim();
  if (trimmed.length <= 15) return true;
  return GENERIC_PATTERNS.some((pattern) => pattern.test(trimmed));
}

async function main() {
  console.log(`[quality-fix] dryRun=${isDryRun}`);
  const discussions = await fetchDiscussions();
  console.log(`total=${discussions.length}`);

  const bySlug = new Map();
  for (const disc of discussions) {
    if (!bySlug.has(disc.post_slug)) bySlug.set(disc.post_slug, []);
    bySlug.get(disc.post_slug).push(disc);
  }

  let seed = 7000;
  let stats = { replacedGeneric: 0, extendedCasual: 0, toQuestion: 0 };

  for (const [slug, comments] of bySlug.entries()) {
    // 1) generic 대체
    for (const disc of comments) {
      if (isGeneric(disc.content)) {
        const replacement = pickReplacement(slug, seed++);
        await updateDiscussion(disc.id, replacement, false);
        stats.replacedGeneric += 1;
      }
    }

    // 2) 80자 미만 & generic 아닌 댓글 확장
    for (const disc of comments) {
      const current = disc.content ?? "";
      if (isGeneric(current)) continue;
      if (current.length >= 80 || current.length < 30) continue;
      const extended = extendCasual(current, slug, seed++);
      await updateDiscussion(disc.id, extended, disc.is_question);
      stats.extendedCasual += 1;
    }

    // 3) 질문 비율 확보 — 포스트당 질문 1~2개 보장 (기존 질문 0개인 경우)
    const freshComments = await fetchSlugComments(slug);
    const questionCount = freshComments.filter((c) => c.is_question).length;
    if (questionCount < 1) {
      // 첫 번째 120~200자 구간 댓글을 질문으로 전환
      const target = freshComments.find(
        (c) => (c.content?.length ?? 0) >= 120 && (c.content?.length ?? 0) <= 200
      );
      if (target) {
        const qContent = toQuestion(target.content, slug);
        await updateDiscussion(target.id, qContent, true);
        stats.toQuestion += 1;
      }
    }
  }

  console.log(
    `[done] replacedGeneric=${stats.replacedGeneric} extendedCasual=${stats.extendedCasual} toQuestion=${stats.toQuestion}`
  );
  if (isDryRun) console.log("[dry-run] 실제 DB 변경 없음.");
}

async function fetchSlugComments(slug) {
  const { data } = await supabase
    .from("post_discussions")
    .select("id,content,is_question")
    .eq("post_slug", slug)
    .order("created_at");
  return data ?? [];
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
