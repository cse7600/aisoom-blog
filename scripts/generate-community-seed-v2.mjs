#!/usr/bin/env node
/**
 * Phase 9.2 — 레이어2 커뮤니티 게시판 v2 시드
 *
 * 현재: community_posts 32개, comments 96개 (평균 3.0/post)
 * 목표: 90~120개 게시글, 평균 6~7 댓글
 *
 * 특징:
 *   - API 호출 없이 사전 작성 각본 사용 (generate-scripts.mjs 의존 X)
 *   - 카테고리별 자연스러운 주제 풀 (자유/질문/후기/정보/유머)
 *   - 페르소나 ID 랜덤 선택 (active 페르소나 60+)
 *   - 타임스탬프 자연 분산 (anti-bot-utils)
 *   - IP hash 다양화
 *   - 조회수 경과일 기반 추정
 *   - 작성 후 즉시 재수화된 상태
 *
 * 사용:
 *   node scripts/generate-community-seed-v2.mjs --dry
 *   node scripts/generate-community-seed-v2.mjs --count 60
 */

import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateFakeIpHash,
  distributeCommentTimestamps,
  pickReplyTimestamp,
  estimateViewCount,
  snapToActiveWindow,
} from "./lib/anti-bot-utils.mjs";

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
const countIndex = process.argv.indexOf("--count");
const TARGET_COUNT = countIndex !== -1 ? Number(process.argv[countIndex + 1]) : 60;

// ─── 사전 작성 각본 풀 ────────────────────────────────────────────────────
// 각 항목: { category, title, content, tone, commentsHint }
// 포스트당 댓글 4~8개 자동 생성.

const POST_SCRIPTS = [
  // ── free (자유토크) ────────────────────────────────────
  {
    category: "free",
    title: "요즘 주말마다 뭐 하면서 보내세요?",
    content:
      "작년 가을부터 주 5일 야근이 이어져서 주말에는 거의 집에서 넷플릭스만 봤거든요. 근데 이번 주 토요일에 오랜만에 한강 가서 돗자리 펴고 맥주 한 캔 먹었는데 이게 진짜 힐링이더라구요.\n\n다들 주말에 뭐 하시는지 궁금해요. 서울 근교 당일치기 코스도 괜찮고, 집에서 하는 루틴도 좋고요. 저는 카공족처럼 카페 가서 노트북만 뚫어지게 보는 건 이제 조금 물렸습니다.",
    tone: "personal",
  },
  {
    category: "free",
    title: "혼자 외식하는 거 어색한 사람 있나요",
    content:
      "30대 중반인데 아직도 혼자 식당 들어가는 게 어색합니다. 특히 고깃집이나 2인분부터 되는 집은 엄두도 안 나네요. 편의점에서 도시락 먹고 말지 하는 성격인데, 최근에 같이 다니던 친구가 결혼 준비하면서 만나기 힘들어져서 혼밥 연습이라도 해야 하나 싶어요. 다들 어떤 식당까지는 혼자 잘 가시는지 의견 듣고 싶습니다.",
    tone: "question",
  },
  {
    category: "free",
    title: "퇴근 후 1시간 루틴 공유해요",
    content:
      "요즘 퇴근 후에 뭐 하면 좋을지 고민되는 사람들 많으실 것 같아서 제 루틴 공유합니다. 저는 집 오자마자 스트레칭 15분 → 찬물 샤워 → 전자책 30분 → 불끄고 명상 앱 15분 이 순서로 돌립니다. 이거 2주 했는데 불면증이 확실히 줄었어요. 여러분 루틴도 궁금합니다.",
    tone: "share",
  },
  {
    category: "free",
    title: "반려동물 키우면서 달라진 일상",
    content:
      "작년 겨울부터 고양이 한 마리 키우기 시작했는데 삶이 진짜 많이 바뀌었어요. 퇴근길 발걸음이 빨라졌고, 여행 계획 세우는 방식도 완전히 달라졌습니다. 근데 병원비가 생각보다 부담이에요. 혹시 저처럼 직장인이신 분들은 펫 보험 어떻게 하시는지 궁금합니다.",
    tone: "share",
  },
  {
    category: "free",
    title: "평일 저녁 운동 추천받아요",
    content:
      "직장인 5년차고 주 3회 정도 운동하고 싶은데 헬스는 지루하고 요가는 동작 따라가기 힘들어서 고민 중이에요. 예전에 다녔던 크로스핏은 어깨 부상 이후 접었고요. 요즘 클라이밍이나 복싱 어떨까 싶은데 실제로 평일 저녁에 꾸준히 다니시는 분들 있으시면 후기 부탁드립니다.",
    tone: "question",
  },
  {
    category: "free",
    title: "옆자리 동료 때문에 집중 안 될 때",
    content:
      "오픈 오피스에서 일하는데 옆자리 분이 전화 통화를 거의 30분 단위로 하셔서 집중이 안 돼요. 이어폰 꽂아도 소리가 들리고 에어팟 프로 노캔 써도 사람 목소리는 새어 들어오더라구요. 혹시 비슷한 환경에서 일하시는 분들 어떻게 극복하셨는지 궁금합니다.",
    tone: "question",
  },
  {
    category: "free",
    title: "집에서 커피 내리는 루틴 만드는 중",
    content:
      "스벅 하루 두 잔씩 먹다가 한 달에 20만원 넘게 지출돼서 홈카페 입문했어요. 드립 도구 3만원대로 샀고 원두는 로컬 로스터리에서 200g씩 사고 있습니다. 처음엔 물 온도 재는 것도 귀찮았는데 이제 루틴이 돼서 아침에 15분 투자가 하루 시작을 좋게 만들더라구요.",
    tone: "share",
  },

  // ── qna (질문/답변) ────────────────────────────────────
  {
    category: "qna",
    title: "법인 설립 비용 진짜 80만원이면 될까요?",
    content:
      "1인 법인 설립 준비 중인데 법무사 통하면 70~80만원 견적 받았고 셀프로 하면 등록세 위주로 30만원대라고 들었어요. 시간 여유가 있긴 한데 정관 작성이 제일 걱정이에요. 주식 총수랑 액면가 설정 이런 거 처음이라서요. 실제로 셀프로 하신 분들 난이도 어땠는지 궁금합니다.",
    tone: "question",
  },
  {
    category: "qna",
    title: "편의점 CCTV 4채널 30만원대 괜찮나요?",
    content:
      "7평짜리 편의점 준비 중인데 CCTV 업체 3군데 견적 받았더니 가격 차이가 많이 나요. A사 30만원대부터 C사 80만원대까지. 사양이 2메가픽셀이냐 4메가냐 정도 차이인데 실제로 사용하시는 분들 2메가 해상도로 충분한지 궁금합니다.",
    tone: "question",
  },
  {
    category: "qna",
    title: "개인사업자 → 법인 전환 타이밍 고민",
    content:
      "개인사업자 4년차고 작년 매출 8천만원 찍었어요. 세무사님은 법인 전환 추천하시는데 초기 기장료 부담이랑 직원 4대보험 이슈 때문에 미루고 있어요. 실제로 비슷한 매출대에서 전환하신 분들 체감이 어떠셨는지 경험 공유 부탁드립니다.",
    tone: "question",
  },
  {
    category: "qna",
    title: "첫 오피스 임대 계약할 때 체크리스트",
    content:
      "1인 법인 만들었고 이제 공유 오피스 벗어나서 진짜 사무실 구하려고 합니다. 보증금이랑 월세는 그렇다 치고 관리비·공과금·인터넷·주차 이런 거 계약서에 꼭 명시해야 한다는데 실제로 어떤 조항이 함정이었는지 경험 공유 부탁드립니다.",
    tone: "question",
  },
  {
    category: "qna",
    title: "무인매장 운영하시는 분들 CCTV 몇 대나 다셨어요",
    content:
      "무인 셀프 빨래방 준비 중입니다. 30평대고 세탁기 건조기 합쳐 12대인데 카메라 몇 대가 적정인지 모르겠어요. 업체 견적은 8채널 권장이고 개인적으론 오버스펙 같다는 생각도 들어서요. 실제 운영 중이신 분들 조언 부탁드립니다.",
    tone: "question",
  },
  {
    category: "qna",
    title: "세무사 수수료 월 기장료 적정선이 얼마인가요",
    content:
      "지역은 경기도고 매출 규모 월 3천~5천 왔다갔다 하는 개인사업자입니다. 세무사 3명 견적 받았는데 월 15만/22만/30만원 이렇게 다양해요. 서비스 범위가 다 달라서 뭘로 정해야 할지 모르겠습니다. 비슷한 규모에서 어느 정도 수수료가 일반적인지 기준점 알고 싶어요.",
    tone: "question",
  },
  {
    category: "qna",
    title: "법인 설립 후 첫 달에 꼭 해야 할 일 리스트",
    content:
      "이번 주에 등기 완료되는데 그 이후에 순서대로 뭘 해야 하는지 헷갈립니다. 4대보험 신고 · 법인 통장 개설 · 세무서 사업자 등록 · 카드 발급 중에 우선순위가 있을까요? 먼저 해놓으면 편한 것과 늦어도 상관없는 것 구분해서 알려주시면 감사하겠습니다.",
    tone: "question",
  },

  // ── review (후기/리뷰) ────────────────────────────────
  {
    category: "review",
    title: "한화비전 키퍼 3개월 사용 후기",
    content:
      "카페 오픈하면서 키퍼 4채널 설치하고 3개월 지났습니다. 화질은 생각보다 좋고 앱으로 원격 확인하는 게 편했어요. 다만 처음 2주간 야간 알림이 너무 자주 와서 민감도 조정했습니다. 전체적으로 만족하는데 단점은 초기 설치 때 기사님 일정 맞추는 데 일주일 걸렸다는 거예요.",
    tone: "review",
  },
  {
    category: "review",
    title: "법인설립지원센터 통해서 진행한 후기",
    content:
      "혼자 정관 작성하다가 두 번 반려되고 지원센터 통해서 진행했어요. 총 70만원에 6일 만에 등기까지 끝냈습니다. 담당자분이 자본금 설정이나 발행 주식 수 같은 부분을 미리 정리해주셔서 시간 아낀 게 컸어요. 셀프로 할 때 막혔던 부분이 싹 해결됐습니다.",
    tone: "review",
  },
  {
    category: "review",
    title: "캡스 vs 키퍼 실제 비교해본 후기",
    content:
      "두 곳 다 견적 받고 결국 키퍼로 갔는데 이유 공유합니다. 캡스는 3년 약정이 기본이고 키퍼는 1년부터 가능했어요. 월 요금 차이는 1.5만원 정도인데 계약 유연성에서 키퍼가 나았습니다. 출동 서비스는 없지만 앱 실시간 알림이 워낙 빨라서 실사용에선 차이 못 느꼈어요.",
    tone: "review",
  },
  {
    category: "review",
    title: "다이소 득템 3개월 누적 리스트",
    content:
      "매달 다이소 들러서 산 것 중에 진짜 잘 샀다 싶은 것만 정리해봅니다. 5천원 독서등, 3천원 휴대용 공구 세트, 2천원 식기건조대. 이 세 개는 가격 대비 만족도 최고였어요. 반대로 실패한 건 1천원 충전 케이블이에요. 2주 만에 끊어져서 재구매했습니다.",
    tone: "review",
  },
  {
    category: "review",
    title: "국민카드 법인 비즈니스 카드 6개월 써본 솔직 후기",
    content:
      "법인 설립하고 국민 비즈니스 카드 발급받아서 6개월 썼습니다. 장점은 매월 정산 내역이 세무사랑 연동돼서 회계 처리가 빨라졌다는 점이에요. 단점은 사용 한도 증액 과정이 생각보다 까다로워서 매출 증빙 자료를 매달 제출해야 했습니다.",
    tone: "review",
  },

  // ── info (정보공유) ────────────────────────────────
  {
    category: "info",
    title: "2026년 소상공인 CCTV 지원금 신청 요약",
    content:
      "올해부터 소상공인 진흥원에서 CCTV 설치 지원금 최대 50만원까지 신청 가능해졌습니다. 대상은 사업자 등록 1년 이상 · 연매출 5억 이하. 신청 기간은 분기별로 열리고 서류는 사업자등록증 · 견적서 2부 · 설치 사진만 있으면 돼요. 저도 이번 분기에 35만원 받았습니다.",
    tone: "info",
  },
  {
    category: "info",
    title: "법인세 중간예납 놓치지 않는 캘린더 설정법",
    content:
      "매년 8월 말 법인세 중간예납 놓치는 분들이 의외로 많아요. 저는 작년에 놓쳤다가 가산세 물었습니다. 올해부터는 매년 7월 1일 · 8월 15일 · 8월 25일 세 번 알림 걸어뒀어요. 구글 캘린더에 반복 일정 설정하는 법 첨부합니다.",
    tone: "info",
  },
  {
    category: "info",
    title: "1인 법인 통장 개설 은행별 난이도 정리",
    content:
      "최근 은행 5곳 직접 돌아보면서 법인 통장 개설 난이도 체크했습니다. 국민이 제일 수월했고 다음 신한 · 하나 · 우리 · 카카오뱅크 순이에요. 설립 등기 서류 외에 뭘 더 요구하는지 은행별로 차이가 꽤 있었어요. 자본금 1천만원 이하면 카카오뱅크가 의외로 빠릅니다.",
    tone: "info",
  },
  {
    category: "info",
    title: "부가세 환급 빨리 받는 팁 3가지",
    content:
      "환급 신청 후 평균 30일 걸린다고 하는데 저는 최근 12일 만에 받았습니다. 팁 3가지 공유합니다. 첫째 세금계산서 발행 즉시 국세청에 업로드. 둘째 신고서 작성할 때 홈택스 자동조회 쓰기. 셋째 환급 계좌 등록을 미리 해두기. 이거 세 개만 지켜도 확실히 빨라져요.",
    tone: "info",
  },
  {
    category: "info",
    title: "편의점 창업 초기 1개월 지출 현실 공유",
    content:
      "7평짜리 24시간 편의점 오픈 1개월 기준으로 실제 지출 내역 정리합니다. 초도 물품 1200만원 · 임대료 220만원 · 인건비 350만원 · 전기가스수도 80만원 · POS 리스 25만원. 예상보다 초도 물품 회전이 느려서 재고 관리가 제일 큰 스트레스였습니다.",
    tone: "info",
  },

  // ── humor (유머) ────────────────────────────────
  {
    category: "humor",
    title: "출근길에 있었던 어이없는 사건",
    content:
      "어제 지하철 환승하는데 급하게 뛰다가 커피 흘려서 옆에 계신 분 가방에 다 쏟았어요. 그분이 하시는 말씀이 '아 괜찮아요 저도 아침에 커피 흘렸거든요' 이러시는데 정장에 커피 자국이 선명하게 있더라구요. 서로 웃다가 지하철 떠나보낸 ㅋㅋㅋ 월요일 아침 컨셉 확실했습니다.",
    tone: "humor",
  },
  {
    category: "humor",
    title: "우리집 고양이 주인 알기 테스트 통과 못 함",
    content:
      "2년째 키우고 있는데 여전히 우리집 고양이는 제가 퇴근해도 쳐다도 안 봅니다. 대신 부모님이 놀러오시면 바로 달려가요. 어제 놀러오신 엄마한테 '얘 평소엔 내 근처도 안 와요' 했더니 고양이가 제 발목에 머리 비볐어요. 그 뒤로 다시 무시 모드 ㅋㅋㅋ",
    tone: "humor",
  },
  {
    category: "humor",
    title: "편의점 신상 먹방 후기 엉망진창 버전",
    content:
      "SNS에서 핫하다는 신상 삼각김밥 6종 사서 다 먹었는데 3개째부터 혀가 마비됐어요. 분명 다 다른 맛인데 다 같은 맛처럼 느껴지는 현상이요. 결국 절반 이상 남겼고 우리집 고양이도 안 먹어요. 다이어트 강제 시작됐습니다.",
    tone: "humor",
  },
  {
    category: "humor",
    title: "친구가 어제 한 말 때문에 빵 터진 썰",
    content:
      "친구가 진지하게 '요즘 돈 아끼려고 점심 도시락 싸가는데 원가 계산해보니까 식당 가는 게 더 싸다' 하더라구요. 들어보니까 유기농 재료 · 친환경 용기 · 아몬드 토핑 이런 거 다 챙겨서 하루 도시락 원가 8천원. 식당 가면 6천원에 먹을 수 있는데 왜 이러는지 모르겠다고 ㅋㅋ",
    tone: "humor",
  },
  {
    category: "humor",
    title: "퇴근 후 맥주 한 캔이 주는 위로",
    content:
      "회사에서 프로젝트 마감 이틀 남았다는 소리 듣고 퇴근길 편의점에서 맥주 4캔짜리 사왔어요. 집 와서 뚜껑 딸 때 그 소리 하나로 오늘 하루 다 갚은 느낌. 사장님 죄송한데 저는 맥주 광고처럼 살고 싶습니다.",
    tone: "humor",
  },
];

// ─── 댓글 풀 (tone별) ──────────────────────────────────────────────────
// 각 포스트마다 3~8개 댓글 자동 조합. 일부는 대댓글 연결.

const COMMENT_POOL_BY_TONE = {
  personal: [
    "저도 작년 이맘때 비슷한 고민 했었는데 결국 작은 거부터 바꾸는 게 제일 오래 가더라구요 요즘은 주말 아침 20분 산책이 저한텐 최고입니다",
    "한강 돗자리 진짜 저도 추천드립니다 혼자 갔다가 우연히 만난 사람들이랑 얘기 나누면서 맥주 마셨던 기억이 있어요 날 좋을 땐 무조건 나가세요",
    "저는 평일 루틴에 목요일 운동 하나 추가했는데 주말이 완전히 달라졌어요 이게 생각보다 큰 차이였습니다",
    "집에서 넷플릭스만 봐도 괜찮다고 생각해요 다들 밖으로 나가야 한다는 압박이 오히려 스트레스더라구요",
    "저는 주말에 친구랑 요리 원데이 클래스 갔다 왔는데 진짜 좋았습니다 평일엔 할 엄두가 안 나서 주말에만 가능한 활동 추천합니다",
  ],
  question: [
    "저도 정확히 같은 고민을 하고 있어서 댓글 주시는 분들 의견 같이 봅니다 저는 혼밥은 국밥집까지는 가능한데 고깃집은 아직도 힘들어요",
    "저는 혼자 외식 5년 차인데 제일 큰 팁은 평일 점심 시간대를 노리라는 거예요 혼자 오는 사람이 많아서 부담이 덜합니다",
    "혼밥 어색한 거 정상이에요 저는 연습한다고 식당 가서 책 들고 갔다가 오히려 더 집중 안 됐던 기억이 있네요",
    "저는 퇴근 후 운동 결국 집 앞 헬스장이 답이었어요 거리 차이가 꾸준함을 좌우하더라구요",
    "복싱 추천드립니다 1대1 레슨이라 동작 교정도 빠르고 스트레스 푸는 데도 최고예요",
    "저도 세무사 견적 받을 때 15~30만원 차이 나서 고민했는데 결국 가격보다 커뮤니케이션 스타일이 맞는 분 선택했습니다 결과적으로 만족이에요",
    "저 이거 정확히 작년에 겪었어요 결국 중간 가격대 세무사 골랐는데 월 22만원이고 서비스 딱 적당한 수준이었습니다",
  ],
  share: [
    "저도 퇴근 후 루틴 고민하다가 스트레칭부터 시작했는데 확실히 수면 질이 좋아졌어요 좋은 팁 공유 감사합니다",
    "홈카페 입문하셨군요 저는 1년 됐는데 원두 고르는 재미가 제일 크더라구요 로스터리마다 개성이 달라서요",
    "반려동물 이야기 공감됩니다 저도 병원비 때문에 펫 보험 알아보는 중인데 조건이 생각보다 까다로워요",
    "저는 퇴근 후 루틴에 전자책 30분만 추가했는데 월 독서량이 3권에서 8권으로 늘었습니다 루틴의 힘이 크네요",
  ],
  review: [
    "저희 매장도 같은 모델 쓰고 있는데 야간 민감도 조정하는 거 꿀팁 감사합니다 저도 처음에 알림 너무 많이 와서 짜증 났어요",
    "키퍼 1년 넘게 썼는데 앱 업데이트될수록 좋아지는 게 느껴져요 초기엔 약간 버벅였는데 지금은 만족 중입니다",
    "저도 지원센터 통해서 70만원대에 끝냈어요 정관 반려되는 스트레스를 돈으로 해결한 느낌이라 아깝지 않았습니다",
    "캡스 vs 키퍼 비교 잘 봤습니다 저는 아직 고민 중인데 1년 약정 가능한지 다시 알아봐야겠어요",
    "다이소 충전 케이블 저도 당했습니다 2주면 그나마 양반이고 저는 3일 만에 끊어졌어요 ㅋㅋ",
  ],
  info: [
    "지원금 정보 감사해요 저도 지난 분기에 신청해서 40만원 받았습니다 서류 진짜 간단하니까 고민 말고 신청해보세요",
    "법인세 중간예납 캘린더 설정 공유 감사합니다 저도 작년에 놓쳐서 15만원 가산세 냈던 기억이 새록새록 나네요",
    "카카오뱅크 법인 통장 의외로 빠르다는 거 처음 알았어요 다음 법인 만들 때 참고할게요",
    "부가세 환급 12일이면 진짜 빠르네요 저는 보통 45일 넘게 걸려서 세무사한테 독촉하곤 했는데 셀프로도 빠를 수 있군요",
  ],
  humor: [
    "ㅋㅋㅋ 커피 가방에 쏟았는데 서로 웃다가 지하철 놓치는 그림 너무 공감돼요 월요일 아침엔 모든 게 엉망이죠",
    "우리집 고양이 얘기 완전 공감임 ㅋㅋ 저도 부모님 오시면 저 버리고 다른 집 고양이처럼 행동합니다",
    "저도 편의점 신상 먹방 도전했다가 똑같이 혀 마비됨 ㅋㅋㅋ 중반부터 다 같은 맛 현상 진짜 있어요",
    "유기농 도시락이 식당보다 비싼 거 진짜 웃기네요 ㅋㅋ 그 친구분 어떻게 합리적 설득하시나요",
    "맥주 4캔 사서 뚜껑 딸 때 그 소리 ㅠㅠ 진짜 하루 갚아지는 느낌 최고죠",
  ],
};

const REPLY_POOL = [
  "ㅇㅈ",
  "ㅋㅋㅋㅋㅋ 이거 진짜 공감되네요",
  "저도 같은 경험 있어요",
  "이거 맞습니다 현장에선 다들 이렇게 해요",
  "저도 방금 해보니까 똑같이 되네요",
  "혹시 더 디테일한 방법 궁금한데 DM 가능하세요",
  "저랑 정확히 같은 의견입니다",
  "이거 진짜 꿀팁이네요 저장했어요",
];

// ─── 페르소나 풀 ──────────────────────────────────────────────────────────
async function loadPersonas() {
  const { data, error } = await supabase
    .from("discussion_personas")
    .select("id,nickname,persona_type")
    .eq("active", true);
  if (error) throw new Error(`personas: ${error.message}`);
  return data ?? [];
}

function pickPersona(personas, preferredTypes = []) {
  if (preferredTypes.length > 0) {
    const filtered = personas.filter((p) => preferredTypes.includes(p.persona_type));
    if (filtered.length > 0) return filtered[Math.floor(Math.random() * filtered.length)];
  }
  return personas[Math.floor(Math.random() * personas.length)];
}

// ─── 삽입 로직 ────────────────────────────────────────────────────────────
function passwordHashSeed() {
  const raw = "community-v2-seed-" + Date.now() + "-" + Math.random();
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function insertPost(script, author, createdAt, ipHash, viewCount) {
  if (isDryRun) {
    return { id: `dry-${Math.random().toString(36).slice(2, 10)}`, created_at: createdAt };
  }
  const { data, error } = await supabase
    .from("community_posts")
    .insert({
      category: script.category,
      title: script.title,
      content: script.content,
      nickname: author.nickname,
      password_hash: passwordHashSeed(),
      view_count: viewCount,
      is_ai_generated: true,
      persona_id: author.id,
      ip_hash: ipHash,
      created_at: createdAt.toISOString(),
      updated_at: createdAt.toISOString(),
    })
    .select("id,created_at")
    .single();
  if (error) {
    console.error("  insertPost:", error.message);
    return null;
  }
  return data;
}

async function insertComment(postId, parentId, author, content, createdAt, ipHash) {
  if (isDryRun) {
    return { id: `dry-c-${Math.random().toString(36).slice(2, 10)}` };
  }
  const { data, error } = await supabase
    .from("community_comments")
    .insert({
      post_id: postId,
      parent_id: parentId,
      nickname: author.nickname,
      password_hash: passwordHashSeed(),
      content,
      is_ai_generated: true,
      persona_id: author.id,
      ip_hash: ipHash,
      created_at: createdAt.toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    console.error("  insertComment:", error.message);
    return null;
  }
  return data;
}

function buildCommentsForPost(script) {
  const pool = COMMENT_POOL_BY_TONE[script.tone] ?? COMMENT_POOL_BY_TONE.personal;
  const count = 4 + Math.floor(Math.random() * 5); // 4~8
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, pool.length));
}

async function main() {
  console.log(`[seed-v2] dryRun=${isDryRun} target=${TARGET_COUNT}`);
  const personas = await loadPersonas();
  if (personas.length === 0) {
    console.error("페르소나가 없습니다. discussion_personas 테이블 확인 필요.");
    process.exit(1);
  }
  console.log(`personas loaded: ${personas.length}`);

  // 목표 개수만큼 스크립트 풀을 반복 (동일 스크립트도 nickname/timestamp 바꿔 다양화)
  const posts = [];
  let seedCounter = 11000;
  for (let index = 0; index < TARGET_COUNT; index += 1) {
    const script = POST_SCRIPTS[index % POST_SCRIPTS.length];
    const author = pickPersona(personas);

    // 포스트 생성 시각: 최근 35일 내 자연 분산 (한 번 더 섞어 중복 방지)
    const daysAgo = 1 + Math.random() * 34;
    const rawDate = new Date(Date.now() - daysAgo * 24 * 3600 * 1000);
    const createdAt = snapToActiveWindow(rawDate);
    const ipHash = generateFakeIpHash(seedCounter++);
    const viewCount = estimateViewCount(createdAt, { baseDaily: 2.8, decayHalfLife: 6 });

    const postData = await insertPost(script, author, createdAt, ipHash, viewCount);
    if (!postData) continue;

    // 댓글 4~8개
    const commentContents = buildCommentsForPost(script);
    const commentTimes = distributeCommentTimestamps(createdAt, commentContents.length, {
      maxDays: 10,
      peakBiasDays: 2,
    });

    const parentTimeMap = new Map();
    const parentIds = [];

    for (let cIdx = 0; cIdx < commentContents.length; cIdx += 1) {
      const commenter = pickPersona(personas.filter((p) => p.id !== author.id));
      if (!commenter) continue;
      const commentIp = generateFakeIpHash(seedCounter++);
      const inserted = await insertComment(
        postData.id,
        null,
        commenter,
        commentContents[cIdx],
        commentTimes[cIdx],
        commentIp
      );
      if (inserted) {
        parentIds.push(inserted.id);
        parentTimeMap.set(inserted.id, commentTimes[cIdx]);
      }
    }

    // 포스트당 1~2 대댓글 (30% 확률)
    if (Math.random() < 0.7 && parentIds.length >= 2) {
      const replyCount = 1 + Math.floor(Math.random() * 2);
      for (let rIdx = 0; rIdx < replyCount; rIdx += 1) {
        const parentId = parentIds[Math.floor(Math.random() * parentIds.length)];
        const parentTime = parentTimeMap.get(parentId);
        const replyAuthor = pickPersona(personas);
        const replyContent = REPLY_POOL[Math.floor(Math.random() * REPLY_POOL.length)];
        const replyIp = generateFakeIpHash(seedCounter++);
        const replyTime = pickReplyTimestamp(parentTime);
        await insertComment(postData.id, parentId, replyAuthor, replyContent, replyTime, replyIp);
      }
    }

    posts.push(postData);
    if ((index + 1) % 10 === 0) {
      console.log(`  progress ${index + 1}/${TARGET_COUNT}`);
    }
  }

  console.log(`[done] posts inserted: ${posts.length}`);
  if (isDryRun) console.log("[dry-run] 실제 DB 변경 없음.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
