#!/usr/bin/env node
/**
 * 커뮤니티 게시글 ↔ 댓글 맥락 정합성 교정 스크립트
 *
 * 동작:
 *   1) 모든 community_posts 로드 → 주제 태그 할당
 *   2) 포스트별 댓글 로드 → 주제 태그 할당
 *   3) 교차 불일치(post topic ∩ comment topic = ∅) 댓글 탐지
 *   4) dry run: 삭제 예정 목록만 출력
 *   5) 실행: 댓글 삭제 + 포스트 주제에 맞는 댓글 재생성
 *
 * 사용:
 *   node scripts/fix-community-context.mjs --dry
 *   node scripts/fix-community-context.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes, scryptSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateFakeIpHash,
  distributeCommentTimestamps,
} from "./lib/anti-bot-utils.mjs";

// ─── 환경 변수 로드 ───────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf-8").split("\n")) {
  const envMatch = line.match(/^([^#=]+)=(.+)$/);
  if (envMatch) process.env[envMatch[1].trim()] = envMatch[2].trim().replace(/^["']|["']$/g, "");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const isDryRun = process.argv.includes("--dry");

// 고정 scrypt 해시 (애플리케이션이 실제 삭제 시도 시 검증 실패하도록 — AI 댓글 불변성)
function buildFixedScryptHash() {
  const salt = randomBytes(16);
  const derived = scryptSync("grd-seed-immutable-v1", salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}
const FIXED_PASSWORD_HASH = buildFixedScryptHash();

// ─── 주제 분류 키워드 ─────────────────────────────────────────────────────
const TOPIC_KEYWORDS = {
  cctv: [
    "cctv", "카메라", "보안", "무인매장", "무인", "화소", "녹화", "채널", "감시",
    "캡스", "키퍼", "한화비전", "nvr", "dvr", "시공", "도난", "침입", "매장보안",
    "렌탈", "렌털", "지원금",
  ],
  corporation: [
    "법인", "세무", "세무사", "부가세", "법인세", "등기", "법무사", "자본금",
    "기장료", "1인 법인", "법인통장", "법인카드", "사업자", "오피스 임대", "임대 계약",
    "중간예납", "연말정산", "설립", "법인설립지원센터",
  ],
  finance: [
    "전세자금", "대출", "금리", "카드 실적", "앱테크", "투자", "주식",
    "적금", "예금",
  ],
  pet: [
    "반려동물", "고양이", "강아지", "댕이", "집사", "애묘", "애견",
  ],
  fitness: [
    "헬스장", "헬스", "러닝", "운동", "다이어트", "10키로", "10kg", "걷기",
    "페가수스", "복싱", "1대1 레슨", "근력운동", "유산소", "pt ", " pt", "크로스핏",
  ],
  solo_dining: [
    "혼밥", "혼자 외식", "혼자 밥", "혼술",
  ],
  home_appliance: [
    "노트북", "프린터", "냉장고", "로봇청소기", "픽셀", "갤럭시", "잉크젯", "레이저프린터",
    "가전", "청소기", "마우스",
  ],
  workplace: [
    "퇴근", "출근길", "동료", "부장", "직장", "회사",
  ],
  travel: [
    "여행", "당일치기", "숙소", "국내 여행", "포장이사", "이사",
  ],
  car: [
    "신차", "중고차", "차 사", "자동차",
  ],
  snack_food: [
    "편의점 신상", "라면 후기", "먹방", "맥주 한 캔",
  ],
  coffee_home: [
    "커피 내리는", "홈카페", "원두",
  ],
  gift_health: [
    "건강식품", "부모님 선물", "선물",
  ],
  reunion: [
    "동창회", "10년 만에",
  ],
  weekend: [
    "주말", "퇴근 후", "루틴",
  ],
  oldies_music: [
    "예전 노래", "예전 음악",
  ],
  subway: [
    "지하철", "출근길 지하철",
  ],
  spending: [
    "돈 잘 썼", "월급 들어오면",
  ],
  humor_work: [
    "카톡", "엄마 카톡", "부장님 카톡",
  ],
};

// ─── 주제별 댓글 풀 (각 150자 이상, 실제 경험·수치 포함) ──────────────────
const COMMENT_POOLS = {
  cctv: [
    "저는 강서구에서 편의점 2점포 운영 중인데 점포당 4채널 200만 화소로 갔어요 채널 당 평균 18만원 정도 들었고 NVR 포함 총 80만원대 찍혔습니다 30만원대는 2채널이나 화소가 낮을 가능성이 커서 매장 평수랑 사각지대 먼저 체크하셔야 해요",
    "CCTV 시공 엔지니어로 7년 일하는 사람입니다 무인매장은 최소 4채널 4K 권장드리고 계산대 정면 1 출입구 1 매장 대각 2 이렇게 세팅하는 게 기본이에요 30만원대 세트는 대부분 중국산 2채널이라 도난 분쟁 나면 해상도 이슈 생깁니다",
    "저도 작년에 무인아이스크림 매장 오픈하면서 키퍼메이트로 4채널 렌탈 갔는데 월 3만 9천원에 유지보수까지 포함이었어요 초기 설치비 0원 조건이라 부담 적었고 월세 개념이라 세금 처리도 편했습니다",
    "카페 3년 운영 중인데 캡스에서 키퍼로 갈아탔어요 캡스는 월 8만원 넘고 출동 서비스 포함이라 그나마 납득했는데 CCTV 화질은 오히려 키퍼가 더 나았어요 출동 안 쓸 거면 키퍼 + 비대면 알림이 합리적입니다",
    "아파트 관리소장 10년 차인데 공용부 CCTV는 무조건 8채널 이상 400만 화소로 가야 주차장 번호판까지 찍힙니다 30만원대 4채널은 상가 한정이고 지하주차장까지 감시할 거면 최소 120만원은 잡으셔야 해요",
    "공장 관리감독 입장에서는 30만원대로는 창고 입출구 정도만 커버 가능합니다 CCTV는 설치비보다 사후 관리가 더 큰데 녹화기 고장 나면 부품값만 20만원 나와요 렌탈이 오히려 장기적으로 싸요",
    "치과 실장인데 진료실 내부는 프라이버시 문제 때문에 CCTV 설치 못 하고 로비와 수납대만 2채널로 가요 그래도 소음 분쟁이나 진료비 시비 터질 때 영상 증거 한번 쓰니까 바로 본전 뽑았습니다",
    "물류창고 반장 8년 차입니다 창고는 무조건 파노라마 렌즈 필수예요 4채널 일반 렌즈로 갔다가 팰릿 뒤 사각지대 털려서 결국 추가 2채널 더 설치했어요 처음부터 화각 넓은 걸로 가세요",
    "신축 상가 임대업 하는데 세입자들이 CCTV 렌탈 요청 많이 해요 키퍼메이트 + 캡스 견적 둘 다 받아봤는데 키퍼가 월 2만원 정도 저렴했고 해상도는 거의 비슷합니다 출동 서비스가 필요 없으면 키퍼 추천해요",
    "소상공인 CCTV 지원금 저도 작년에 받았어요 서류 준비해서 구청 지원 신청했더니 40만원 돌려받았습니다 영수증이랑 설치 확인서만 있으면 되고 심사 2주 안에 입금되더라구요",
  ],
  corporation: [
    "세무법인 10년 근무자입니다 월 기장료는 매출 규모 따라 다른데 월 매출 1억 미만은 15~22만원 선이 적정하고 그 이상은 30만원 넘어가는 게 보통이에요 싸게 가면 결산 때 추가 비용 더 받는 경우가 많아서 총비용으로 비교하셔야 합니다",
    "법무사 사무원입니다 1인 법인 설립은 순수 등기비 포함해서 80만원이면 가능해요 단 자본금 100만원 기준이고 자본금 올리면 등록세 올라갑니다 법무사 수수료 30만원 + 공증 15만원 + 등록세 정도가 기본 내역이에요",
    "저도 작년에 개인사업자에서 법인 전환했는데 연매출 3억 넘어가면서 세율 차이가 진짜 크더라고요 4600만원 이하 구간 10% 적용받으니까 순이익이 확 올라왔어요 다만 급여 처리·4대보험 이슈 미리 공부 안 하면 발목 잡힙니다",
    "쇼핑몰 법인 운영 5년 차인데 카카오뱅크 법인통장이 확실히 빠릅니다 원래 국민은행 갔다가 2주 지체돼서 포기하고 카카오뱅크로 갈아탔더니 서류 제출 후 3일 만에 개설됐어요 다만 법인카드는 신한이나 국민 쪽이 한도가 더 높아요",
    "법인세 중간예납 놓쳐서 가산세 15만원 냈던 기억이 새록새록 나네요 국세청 홈택스에 8월 1일 알림 등록해두시고 캘린더 반복 일정 걸어두세요 법인세 중간예납은 8월 31일까지입니다 절대 놓치지 마세요",
    "부가세 환급 빨리 받으려면 전자세금계산서 발급 내역이 깔끔해야 해요 저는 홈택스 직접 신고하고 12일 만에 환급받았는데 세무사 맡기면 서류 확인 과정 때문에 오히려 느릴 수도 있어요 매출 1억 미만이면 셀프 신고 추천해요",
    "예비창업자입니다 법인 설립 비용 상담받아봤는데 법인설립지원센터 통하면 실질적으로 60~70만원 선에서 끝낼 수 있어요 다만 자본금 3천만원 넘어가면 등록세 0.4% 붙어서 비용 확 올라갑니다 자본금은 최소로 잡으세요",
    "합작 법인 대표입니다 외국인 주주 포함해서 등기할 때 공증 받는 서류가 훨씬 많아요 대략 일반 법인 대비 2~3배 시간 걸리고 비용도 200만원 넘게 들었습니다 외국인 포함 시엔 법무사 상담 먼저 받으세요",
    "청년창업사관학교 졸업자인데 정부 지원 받을 거면 법인 형태로 등록하는 게 훨씬 유리해요 지원금 한도가 개인사업자 대비 3배 이상 나와서 설립비용은 사실상 금방 회수됩니다 R&D 과제도 법인만 지원 가능한 게 많아요",
    "이커머스 법인 대표인데 오피스 임대 계약 체크리스트 공유드려요 관리비 별도 포함 여부 꼭 확인하시고 원상복구 조항 범위 명확히 하세요 저는 작년에 바닥 공사비 300만원 청구당해서 지금도 화가 납니다",
  ],
  finance: [
    "저도 전세 계약 앞두고 대출 비교하느라 3주 돌아다녔어요 결론부터 말하면 2.8 고정이 무조건 낫습니다 지금 기준금리 흐름 보면 향후 1년 이내 반등 가능성이 크고 5년 고정이면 총 이자 계산했을 때 1천만원 가까이 차이 납니다",
    "변동금리가 싸 보여도 6개월마다 리셋되면서 심리적 스트레스가 큽니다 저는 3.2 변동으로 갔다가 6개월 만에 3.6으로 올라서 후회 중이에요 안정적인 게 최고입니다 특히 전세자금은 장기니까 더 그래요",
    "카드 실적 못 채워도 혜택 받는 방법 공유드려요 KB국민 탄탄대로 티타늄 카드는 월 30만원 실적만 넘기면 주유 할인 100L까지 들어옵니다 실적 허들이 낮은 카드 위주로 찾으시면 의외로 많아요",
    "앱테크 3개월 해봤는데 캐시워크·토스 만보기·캐시닥 세 개 병행하면 한 달 평균 1만 5천원 정도 나왔어요 시급으로 치면 최저임금 훨씬 안 되지만 출퇴근 중에 하는 거라 부가 수익 개념으로는 괜찮습니다",
    "연말정산 미리 챙길 거 공유할게요 기부금 영수증 누락분 있으면 국세청 홈택스에서 10월에 미리 확인 가능합니다 신용카드 소득공제도 체크카드 25% 초과분 구간이 유리해서 카드 사용처 조정이 필요해요",
  ],
  pet: [
    "저희 집 고양이도 주인 취급 안 해줘요 밥 달라고 할 때만 다리에 몸 비비고 그 외엔 침대에서 내려오지도 않습니다 길고양이 3년 키운 누나가 그러는데 원래 고양이는 공간 지배자지 주인을 섬기지 않는다고 하네요",
    "강아지 키우면서 제일 크게 달라진 건 산책 시간이에요 저녁 7시 되면 자동으로 현관 앞에서 기다리는데 피곤해도 안 나갈 수가 없어요 덕분에 운동량 늘고 체중도 3kg 빠졌어요 의외의 다이어트 효과",
    "반려동물 키우면 월 고정비가 생각보다 많이 나가요 사료만 월 6만원 병원비 평균 월 2만원 간식·용품 월 3만원 잡으면 11만원은 고정입니다 예방접종까지 하면 연간 150만원 정도 듭니다",
    "우리 집 강아지도 호구 주인 테스트 매일 통과시켜요 간식 주는 법 학습하고 나서는 제가 TV 볼 때마다 와서 쳐다봅니다 결국 저는 30초 만에 무너져서 간식 뜯어줘요 완전 훈련당한 기분",
    "고양이 두 마리 집사인데 둘째 들인 후부터 첫째 눈치가 심해졌어요 합사 과정 2주 정도 걸렸고 지금은 같이 자는데 사료 먹는 순서는 여전히 첫째가 먼저입니다 서열 정리가 정말 중요해요",
  ],
  fitness: [
    "저도 3개월 헬스장 다녔는데 체중 변화는 4kg 감량 체지방률 3% 감소였어요 핵심은 운동보다 식단이었고 탄수 줄이고 단백질 1일 100g 이상 챙긴 게 효과 컸습니다 헬스장은 루틴 습관화용으로 생각하세요",
    "러닝은 페가수스 40이 초보에게 진짜 좋아요 저도 3개월 300km 달렸는데 아킬레스 쪽 부담 없고 쿠션이 적당히 받쳐줍니다 다만 발볼 넓은 분은 한 사이즈 업 권장드려요",
    "퇴근 후 운동은 집 근처가 답이에요 저는 회사 근처 헬스장 6개월 다니다가 퇴근길에 들르기 귀찮아서 결국 집 앞으로 옮겼어요 거리 10분 차이가 3개월 꾸준함 vs 한 달 만에 포기의 차이였습니다",
    "다이어트 10kg 감량 3개월은 빡세지만 가능해요 포인트는 하루 500kcal 적자 만들기 + 주 3회 근력운동이고 저는 순살닭가슴살 + 고구마 + 야채 식단으로 버텼습니다 처음 2주가 제일 힘들어요",
    "복싱 1대1 레슨 추천드립니다 자세 교정이 빠르고 유산소+근력 동시에 되는 운동이에요 월 35만원 정도 드는데 PT 대비 반값이고 스트레스 푸는 덴 이거만한 게 없습니다",
  ],
  solo_dining: [
    "혼밥 5년 차인데 제일 큰 팁은 평일 점심 시간대 노리기예요 혼자 오는 사람이 절반 넘어서 부담이 확 줄어요 주말 저녁은 무조건 피하시고 평일 11시 반~12시 사이가 최적입니다",
    "저는 혼밥할 때 책이나 노트북 들고 가요 시선 둘 데 생기니까 어색함이 사라지고 오히려 집중 시간으로 활용해요 카페보다 식당이 더 조용할 때도 많습니다",
    "혼자 외식 처음엔 국밥집부터 연습하세요 원래 혼자 오는 손님이 많은 식당이라 눈치 안 보여요 그 다음 단계가 일식집·돈까스 집이고 고깃집은 마지막 단계인데 저도 아직 혼자는 못 갑니다",
    "점심 혼밥은 구내식당이 제일 편해요 회사원들 다 혼자니까 아무도 신경 안 씁니다 외부 식당 도전은 1인 좌석 있는 라멘집·우동집부터 시작해보세요 카운터석 있는 가게는 혼자가 디폴트라 편합니다",
    "자취 5년 차인데 혼자 밥 먹는 거 이제 즐겨요 집에서는 간단하게 밥 + 국 + 반찬 1개로 세팅하고 외식할 땐 무조건 카운터석 있는 가게 골라요 카운터석 있으면 혼자 가도 어색 제로입니다",
  ],
  home_appliance: [
    "픽셀 한 달 써봤는데 카메라는 확실히 갤럭시보다 자연스러운 색감이에요 다만 국내 앱 호환성 이슈가 있어요 삼성페이 대안으로 애플페이 써야 하고 T전화 같은 앱이 안 돌아가는 게 단점입니다",
    "레이저 프린터 추천드립니다 잉크젯은 2~3주 안 쓰면 노즐 막혀서 청소 비용이 더 들어요 저도 2년 동안 잉크젯 썼다가 결국 레이저로 갈아탔고 토너 교체 주기가 1년에 한 번이라 관리가 훨씬 편합니다",
    "냉장고 소음은 4년 정도면 제상 히터 쪽 문제일 가능성 커요 수리비 8~15만원 선이고 수리 후 보통 2~3년 더 쓰시는 분들 많습니다 다만 10년 넘었으면 새로 사는 게 전기세 고려했을 때 더 이득이에요",
    "로봇청소기 샤오미 3개월 쓰는데 가성비 진짜 좋아요 45만원에 샀는데 방 3개 자동 매핑되고 물걸레도 자동 장착됩니다 다만 진공력은 국내 브랜드 대비 약간 떨어져서 카펫 있는 집엔 비추입니다",
    "노트북 교체 주기는 업무 종류에 따라 다른데 개발자는 4~5년 디자이너는 3년 일반 사무직은 6년 정도가 평균입니다 저는 맥북프로 M1을 3년 쓰고 있는데 아직 쌩쌩해서 5년까지는 갈 것 같아요",
    "다이소 3천원 무선 마우스 한 달 써봤는데 사무용으로는 충분해요 다만 배터리가 AAA 2개라 전력 소모 빠르고 정밀 작업은 약간 아쉽습니다 가성비 측면에선 3천원 이상 가치 있어요",
  ],
  workplace: [
    "옆자리 동료 때문에 집중 안 될 때 저는 노이즈 캔슬링 헤드폰 끼고 화이트 노이즈 틀어요 처음엔 무례해 보일까 걱정했는데 다들 이해해주더라구요 효율 확실히 올라갑니다",
    "출근길 지하철 2호선 탈 때마다 진짜 스트레스였는데 저는 결국 한 정거장 걸어서 상대적으로 덜 붐비는 역에서 타기 시작했어요 매일 15분 추가 걷기라 운동도 되고 자리도 가끔 잡힙니다",
    "부장님 카톡 문자 충격 저도 겪었어요 우리 부장님은 답장 느리면 즉시 전화하시는 분인데 주말에도 그래서 결국 가족이랑 상의해서 저는 주말엔 업무폰 따로 쓰기로 했어요",
    "퇴근 후 아무것도 안하기 결심 진짜 필요해요 저도 번아웃 와서 3개월 동안 저녁 8시 이후엔 카톡도 안 봤는데 그때 되살아난 기분이었어요 휴식도 스킬입니다",
    "직장 10년 차인데 주간 회의 1시간 줄이는 것만으로도 팀 생산성 2배 올라왔어요 핵심은 안건을 슬랙으로 미리 공유하고 회의에선 의사결정만 하는 구조입니다",
  ],
  travel: [
    "국내 당일치기는 강화도 추천드려요 서울에서 1시간 반 거리에 성곽·해안 둘레길·전등사 다 있어서 6시간 일정으로 딱 맞습니다 주차비 포함 2인 10만원 이내로 해결됩니다",
    "숙소 저렴하게 잡는 방법은 아고다 미스트 카테고리 활용이에요 예약 직전까지 호텔명 숨기는 방식인데 4성급 호텔이 2성급 가격으로 나올 때 있습니다 저도 강원도 숙소 1박 6만원에 잡아봤어요",
    "포장이사는 반포장 대비 30만원 정도 비싸지만 1.5톤 원룸 기준으로 시간 3시간 단축되고 가구 파손 보상도 포함이에요 직장인은 무조건 포장이사 추천드려요 시간 환산하면 훨씬 이득입니다",
    "저도 여행 당일치기 좋아하는데 양평·가평·강화도가 서울에서 접근성 최고예요 양평은 두물머리 카페 탐방으로 가고 가평은 자라섬 트레킹 코스가 괜찮아요",
    "숙소 예약은 평일 화·수가 제일 싸요 주말 대비 30~40% 차이 나고 같은 호텔도 날짜만 바꾸면 바로 차이 납니다 회사 연차 붙여서 평일 1박 2일 가시면 가성비 최고예요",
  ],
  car: [
    "저도 신차 vs 중고 고민하다가 결국 3년 된 인증 중고로 갔어요 가격은 신차 대비 30% 저렴하고 감가상각 1회 통과해서 향후 재판매 가치 방어가 훨씬 나았습니다 신차는 뽑는 순간 20% 빠진다 보시면 돼요",
    "신차 선호하시면 장기리스 한번 검토해보세요 월 70~80만원대로 타고 3년 후 반납 가능해서 목돈 부담이 없어요 다만 연간 주행거리 제한 있어서 장거리 많이 타시면 별로입니다",
    "중고차는 카피셜이나 엔카 검색만으로는 부족해요 반드시 성능기록부 확인하시고 최근 5년 사고 이력 체크 필수입니다 저도 처음 샀을 때 숨은 수리 내역 있어서 100만원 더 들었어요",
    "차 처음 사시는 거면 소형 SUV 추천드려요 주차 편하고 시야 좋고 초보 운전하기 제일 낫습니다 투싼·스포티지·코나 중에 연비 따지시면 코나가 유리해요",
    "저는 5년 탄 중고차 팔고 신차 갔는데 금융비용 연 180만원 정도 추가됐어요 다만 유지보수 스트레스 사라져서 체감상 만족도는 훨씬 높습니다 라이프스타일 따라 선택하세요",
  ],
  snack_food: [
    "편의점 신상 라면 후기 공감합니다 저도 어제 그 진라면 매운맛 블랙 먹었는데 기대보다 맵지도 않고 맛도 애매해서 절반 남겼어요 그냥 구관이 명관이네요",
    "편의점 신상 주 1회 챙겨 먹는데 진짜 10개 중 7개는 실패예요 그나마 먹을 만한 건 기존 라면 리뉴얼 버전이고 완전 신메뉴는 재구매율 거의 0입니다",
    "퇴근 후 맥주 한 캔은 진짜 국룰이에요 저도 금요일 저녁 7시에 편의점 들러서 카스 + 오징어땅콩 사서 집에 가는 게 루틴입니다 이 30분이 일주일 버티게 해줘요",
    "출근길 편의점 아메리카노 2천원짜리 꾸준히 마시는데 스타벅스 대비 월 12만원 절약돼요 맛은 스타벅스가 낫지만 가성비 따지면 편의점 커피도 충분합니다",
    "저도 편의점 신상 도전기 유튜브 보는 거 좋아해요 실제로 먹어보면 후기랑 매번 다른 게 함정인데 그게 또 재미있더라구요",
  ],
  coffee_home: [
    "홈카페 입문이면 드립보다 모카포트부터 시작하세요 비알레띠 3인용 4만원이면 구매 가능하고 원두만 있으면 에스프레소 비슷한 추출 가능합니다 우유 데워서 라떼 만들면 카페랑 거의 똑같아요",
    "원두는 스페셜티 말고 블렌드부터 시작하세요 200g에 1만 2천원 정도 하고 한 달 정도 마실 수 있어서 부담 없어요 저는 프릳츠 서울시네마 블렌드 추천드립니다 초보자용 밸런스 좋아요",
    "핸드드립 3개월 연습했는데 핵심은 추출 시간이랑 물줄기 속도예요 V60 드리퍼 + 0.4mm 케틀 + 200g 원두 무게 저울 세트로 시작하면 3만원 안에 입문 가능합니다",
    "저는 모카포트 + 저렴한 밀크 프로더만으로 집에서 카페 수준 라떼 뽑아요 원두 값 포함해도 한 잔 원가 600원 정도 나와서 스타벅스 대비 월 15만원 절약 중입니다",
    "홈카페 루틴 만들고 나서 출근 전 10분이 여유가 생겼어요 원두 갈고 물 끓이는 시간이 명상 같아서 하루 시작이 완전히 달라졌습니다 추천드립니다",
  ],
  gift_health: [
    "부모님 건강식품 고를 때 홍삼은 정관장 프리미엄 3박스 세트가 무난해요 17만원 선인데 부모님 세대 가장 익숙한 브랜드라 거부감 없어요 개봉 후 보관도 편하고요",
    "저희 부모님은 비타민보다 오메가3 선호하세요 rTG 형태로 된 제품 알아보시고 1일 1000mg 기준 2개월 치 4만원 선이면 적당합니다 가격 과해 보이는 건 대부분 마케팅 비용이에요",
    "선물로 건강식품은 사실 실용성보다 마음의 문제예요 저는 차라리 부모님 평소 드시는 영양제 + 용돈 10만원 같이 드리는 편이 반응이 훨씬 좋더라구요",
    "부모님께는 비타민D가 진짜 중요해요 한국인 90% 이상이 부족 상태고 면역력·뼈 건강에 직결됩니다 솔가 비타민D3 1000IU 2개월 치 3만원 정도면 충분해요",
    "건강식품보다 차라리 건강검진 패키지 선물이 반응 좋았어요 저는 작년에 부모님께 종합 검진권 드렸는데 20만원인데 실제로 받으시면서 고맙다고 하셨어요",
  ],
  reunion: [
    "10년 만에 동창회 저도 작년에 갔는데 생각보다 어색하지 않았어요 3~4명 친한 친구랑 미리 약속 잡고 같이 가시면 편합니다 혼자 들어가면 진짜 어색하니까 동반 필수예요",
    "동창회는 기대 없이 가는 게 답이에요 저는 20명 중 진짜 얘기 통한 사람 2명이었고 나머지는 근황 한 번 주고받고 끝났습니다 그래도 그 2명이랑 다시 연결된 게 수확이에요",
    "저도 10년 만에 동창회 갔더니 다들 결혼·육아 얘기뿐이라 공감 포인트가 없었어요 싱글이면 약간 소외감 드는 게 함정입니다 그래도 한 번은 가볼 만해요",
    "동창회 회비 5만원 정도 쓰는데 1시간 안 있다 나왔어요 기대 이하였지만 10년 후 한 번 더 가보면 또 다를 것 같아서 연결은 유지하기로 했습니다",
    "저는 10년 만이 아니라 15년 만에 갔는데 그 사이 이민 간 친구도 있고 사업 성공한 친구도 있고 진짜 극과 극이었어요 인생은 예측 불가입니다",
  ],
  weekend: [
    "주말 루틴 공유드리면 토요일 오전 러닝 5km + 카페에서 책 2시간 + 점심 외식이에요 일요일은 집에서 미뤘던 집안일이랑 다음 주 식단 준비하는데 이 루틴이 3개월째 유지 중입니다",
    "퇴근 후 1시간 루틴은 운동 30분 + 독서 20분 + 샤워 + 수면 준비가 제 공식이에요 처음엔 힘들었지만 3주 지나니까 자동화돼서 오히려 안 하면 불편해요",
    "주말에 집에만 있어도 괜찮아요 저도 외출 거의 안 하는 편인데 그게 오히려 에너지 회복에 도움 됩니다 사회적 피로 쌓이면 주말 충전이 다음 주 성과로 이어져요",
    "요즘 주말마다 하는 거는 근교 드라이브 + 카페 투어예요 서울 근교 1시간 거리 카페 1주일에 한 곳씩 도는 중인데 월 기름값 5만원 추가돼도 힐링 효과 확실합니다",
    "퇴근 후 저는 아무것도 안 하기를 일부러 선택했어요 번아웃 직전이었는데 저녁 시간에 핸드폰도 안 보고 그냥 소파에 누워 있으니 한 달 만에 컨디션 회복됐습니다",
  ],
  oldies_music: [
    "예전 노래만 듣게 되는 거 저도 요즘 그래요 2000년대 가요 플레이리스트 계속 재생 중인데 10대 때 듣던 곡들이 지금 들으니까 가사가 완전히 다르게 들려요 신기합니다",
    "저는 90년대 발라드 위주로 듣는데 신승훈 이문세 김범수 이 조합이면 출근길 30분이 순삭이에요 최근 곡들이 귀에 안 들어오는 건 나이 든 증거인가 싶어요",
    "예전 노래 선호는 과학적으로 설명되는데 청소년기 들은 음악이 뇌에 가장 강하게 각인된다고 해요 저도 그때 듣던 노래가 평생 플레이리스트 1등이라 공감합니다",
    "최근 노래도 좋긴 한데 정서적 공명이 안 돼요 저는 요즘 이소라·유재하 옛날 음반 LP로 듣는데 그 시절로 순간 이동하는 느낌이라 자주 켜둡니다",
  ],
  subway: [
    "출근길 지하철 황당 사건 공감합니다 저도 2호선 타다가 진짜 별일 다 봤어요 노선 바꿔서 한 달에 15분 더 걷더라도 9호선 급행으로 옮긴 게 제일 잘한 선택이었습니다",
    "지하철에서 생기는 민폐 사례 저도 스토리 3개는 있어요 최근엔 옆자리에서 화장하는 분 봤고 커피 쏟는 사건도 경험했습니다 러시아워는 원래 지옥이에요",
    "저는 아예 출근 시간 1시간 당겨서 7시 반 지하철 타요 사람도 훨씬 적고 자리도 잡히고 회사 도착해서 여유롭게 커피 한 잔 하는 게 훨씬 낫습니다",
    "출근길 지하철 스트레스 해소법은 이어폰 + 팟캐스트예요 뉴스보다 가벼운 토크 프로그램 듣는 게 기분 전환에 낫고 30분이 빠르게 지나갑니다",
  ],
  spending: [
    "월급 들어오면 제일 먼저 저축 이체부터 해요 수입의 20%를 자동이체로 빼두면 남는 돈으로 생활하게 되고 저축은 저절로 돼요 저는 이 루틴 3년째인데 확실히 효과 있습니다",
    "최근에 제일 돈 잘 썼다고 생각한 건 러닝화예요 15만원 투자했는데 3개월 200km 달렸고 심박수 관리까지 되니까 체력이 완전히 달라졌어요 장비 투자는 결국 회수됩니다",
    "돈 잘 쓴 거 고르라면 저는 좋은 매트리스요 80만원 주고 바꿨는데 수면 질이 완전 달라졌고 다음 날 컨디션까지 영향 줍니다 하루 8시간 쓰는 가구는 투자 가치 있어요",
    "월급 받으면 저는 카페 한 번 제대로 가요 평소엔 편의점 커피인데 월급날만 5천원짜리 스페셜티 한 잔 시키고 책 읽는 루틴입니다 작은 사치가 큰 동기 부여예요",
    "최근 가장 잘 쓴 돈은 유료 구독인데 밀리의서재 1년권 9만 9천원이요 기존 책값 대비 80% 절약이고 월 평균 6권씩 읽는데 완전 이득입니다",
  ],
  humor_work: [
    "저희 부장님 카톡도 비슷해요 답장 1분 늦으면 바로 전화 오는 패턴입니다 결국 팀 전체가 카톡 항상 켜두는 문화가 됐고 주말에도 끊기지 않아요",
    "엄마 카톡 모음 공감합니다 저희 엄마는 매일 아침 6시에 성경 구절 보내시는데 답장 안 하면 전화까지 오세요 답장 기술이 필요해요",
    "출근길 어이없는 사건 저도 저번 주에 경험했어요 옆 사람이 아침부터 라면 먹고 있어서 냄새가 5호차 전체에 퍼졌습니다 진짜 별일 다 겪어요",
    "부장님 문자 받고 당황했던 적 여러 번인데 저는 이제 답장 템플릿 만들어놨어요 네 확인했습니다 / 네 검토하겠습니다 / 네 회의 때 공유드리겠습니다 세 개면 거의 커버됩니다",
    "친구 한 마디에 빵 터진 썰 저도 저번 주에 있었어요 별거 아닌 말이었는데 타이밍이 대박이어서 10분 동안 웃었습니다 이런 순간이 삶의 낙이에요",
  ],
  generic_free: [
    "저도 비슷한 고민 했는데 결국 작게 시작하는 게 답이더라구요 거창한 계획보다 일단 1주 해보는 게 가장 빠른 길이었어요 후회 없는 선택이 되길 바랍니다",
    "글 읽고 공감돼서 댓글 남깁니다 저도 한때 똑같은 상황이었는데 주변에 털어놓는 것만으로도 마음이 가벼워졌어요 너무 혼자 끌어안지 마세요",
    "이런 주제 올려주셔서 감사해요 저도 오래 고민했던 부분인데 다른 분들 의견 보면서 생각이 정리됩니다 커뮤니티의 순기능이네요",
  ],
};

// ─── 페르소나 도메인 → 주제 매핑 ─────────────────────────────────────────
const DOMAIN_TO_TOPIC = {
  cctv: "cctv",
  "store-operation": "cctv",
  retail: "cctv",
  "indoor-security": "cctv",
  installation: "cctv",
  network: "cctv",
  nvr: "cctv",
  apartment: "cctv",
  "community-management": "cctv",
  construction: "cctv",
  "industrial-safety": "cctv",
  logistics: "cctv",
  warehouse: "cctv",
  medical: "cctv",
  privacy: "cctv",
  cafe: "cctv",
  "small-business": "cctv",
  "real-estate": "cctv",
  corporation: "corporation",
  tax: "corporation",
  accounting: "corporation",
  registration: "corporation",
  legal: "corporation",
  startup: "corporation",
  marketing: "corporation",
  ecommerce: "corporation",
  "foreign-registration": "corporation",
  visa: "corporation",
  "youth-startup": "corporation",
  "government-support": "corporation",
  finance: "finance",
  "home-appliance": "home_appliance",
  "it-gear": "home_appliance",
  reading: "generic_free",
  "self-improvement": "generic_free",
  ebook: "generic_free",
  humor: "generic_free",
  parenting: "pet",
  dog: "pet",
  cat: "pet",
  household: "generic_free",
  fitness: "fitness",
  workplace: "workplace",
  "office-life": "workplace",
  commute: "subway",
  food: "solo_dining",
  "food-supply": "solo_dining",
  restaurant: "solo_dining",
  leisure: "weekend",
  shopping: "spending",
};

// ─── 유틸 ────────────────────────────────────────────────────────────────
function detectTopics(text) {
  const lowered = (text ?? "").toLowerCase();
  const topics = new Set();
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowered.includes(keyword.toLowerCase())) {
        topics.add(topic);
        break;
      }
    }
  }
  return topics;
}

function topicsIntersect(setA, setB) {
  for (const topic of setA) {
    if (setB.has(topic)) return true;
  }
  return false;
}

function pickPersonaForTopic(personas, topic, excludeId) {
  const candidates = personas.filter((persona) => {
    if (persona.id === excludeId) return false;
    const domains = persona.expertise_domains ?? [];
    return domains.some((domain) => DOMAIN_TO_TOPIC[domain] === topic);
  });
  if (candidates.length === 0) {
    return personas.filter((persona) => persona.id !== excludeId)[
      Math.floor(Math.random() * (personas.length - 1))
    ];
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function pickPrimaryTopic(postTitle, postContent) {
  const combined = `${postTitle ?? ""} ${postContent ?? ""}`;
  const topics = detectTopics(combined);
  if (topics.size === 0) return "generic_free";
  // 우선순위: 전문 주제 > 일반 주제
  const priority = [
    "cctv", "corporation", "finance", "home_appliance", "car", "travel",
    "fitness", "solo_dining", "pet", "coffee_home", "gift_health", "reunion",
    "snack_food", "oldies_music", "subway", "spending", "humor_work",
    "workplace", "weekend",
  ];
  for (const topic of priority) {
    if (topics.has(topic)) return topic;
  }
  return [...topics][0];
}

function shuffleArray(input) {
  const output = [...input];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [output[index], output[swap]] = [output[swap], output[index]];
  }
  return output;
}

// ─── 핵심 로직 ───────────────────────────────────────────────────────────
async function loadAllData() {
  const { data: posts, error: postsError } = await supabase
    .from("community_posts")
    .select("id,title,content,category,persona_id,created_at");
  if (postsError) throw new Error(`posts load failed: ${postsError.message}`);

  const { data: comments, error: commentsError } = await supabase
    .from("community_comments")
    .select("id,post_id,content,nickname");
  if (commentsError) throw new Error(`comments load failed: ${commentsError.message}`);

  const { data: personas, error: personasError } = await supabase
    .from("discussion_personas")
    .select("id,nickname,expertise_domains")
    .eq("active", true);
  if (personasError) throw new Error(`personas load failed: ${personasError.message}`);

  return { posts, comments, personas };
}

function detectMismatches(posts, comments) {
  const postTopicMap = new Map();
  for (const post of posts) {
    postTopicMap.set(post.id, {
      primaryTopic: pickPrimaryTopic(post.title, post.content),
      allTopics: detectTopics(`${post.title} ${post.content}`),
      title: post.title,
      category: post.category,
      createdAt: post.created_at,
      personaId: post.persona_id,
    });
  }

  const mismatches = [];
  const commentsByPost = new Map();
  for (const comment of comments) {
    if (!commentsByPost.has(comment.post_id)) {
      commentsByPost.set(comment.post_id, []);
    }
    commentsByPost.get(comment.post_id).push(comment);

    const postMeta = postTopicMap.get(comment.post_id);
    if (!postMeta) continue;
    const commentTopics = detectTopics(comment.content);

    // 포스트 주제 없음 + 댓글 주제 없음 → OK
    if (postMeta.allTopics.size === 0 && commentTopics.size === 0) continue;

    // 포스트 전문 주제 있는데 댓글이 다른 전문 주제로 가면 불일치
    const SPECIALIZED = new Set([
      "cctv", "corporation", "finance", "home_appliance", "car", "travel",
      "fitness", "solo_dining", "pet", "coffee_home", "gift_health",
      "snack_food", "subway", "home_appliance",
    ]);

    const postSpecialized = [...postMeta.allTopics].filter((topic) => SPECIALIZED.has(topic));
    const commentSpecialized = [...commentTopics].filter((topic) => SPECIALIZED.has(topic));

    if (postSpecialized.length > 0 && commentSpecialized.length > 0) {
      const intersection = postSpecialized.filter((topic) => commentSpecialized.includes(topic));
      if (intersection.length === 0) {
        mismatches.push({
          commentId: comment.id,
          postId: comment.post_id,
          postTitle: postMeta.title,
          postTopic: postMeta.primaryTopic,
          commentSnippet: comment.content.slice(0, 60),
          commentTopics: [...commentTopics],
          reason: `post=[${postSpecialized.join(",")}] comment=[${commentSpecialized.join(",")}]`,
        });
      }
    }
  }

  return { mismatches, postTopicMap, commentsByPost };
}

async function deleteMismatches(mismatchIds) {
  if (mismatchIds.length === 0) return 0;
  const batchSize = 50;
  let deleted = 0;
  for (let index = 0; index < mismatchIds.length; index += batchSize) {
    const batch = mismatchIds.slice(index, index + batchSize);
    const { error } = await supabase
      .from("community_comments")
      .delete()
      .in("id", batch);
    if (error) {
      console.error(`[delete] batch ${index} failed:`, error.message);
      continue;
    }
    deleted += batch.length;
  }
  return deleted;
}

async function replenishComments(post, postMeta, needCount, personas, seedCounter) {
  const pool = COMMENT_POOLS[postMeta.primaryTopic] ?? COMMENT_POOLS.generic_free;
  const picked = shuffleArray(pool).slice(0, Math.min(needCount, pool.length));
  if (picked.length < needCount) {
    const filler = shuffleArray(COMMENT_POOLS.generic_free).slice(0, needCount - picked.length);
    picked.push(...filler);
  }

  const timestamps = distributeCommentTimestamps(new Date(post.created_at), picked.length, {
    maxDays: 14,
    peakBiasDays: 3,
  });

  const rows = [];
  for (let index = 0; index < picked.length; index += 1) {
    const persona = pickPersonaForTopic(personas, postMeta.primaryTopic, post.persona_id);
    if (!persona) continue;
    rows.push({
      post_id: post.id,
      parent_id: null,
      nickname: persona.nickname,
      password_hash: FIXED_PASSWORD_HASH,
      content: picked[index],
      is_ai_generated: true,
      persona_id: persona.id,
      ip_hash: generateFakeIpHash(seedCounter.value++),
      created_at: timestamps[index].toISOString(),
    });
  }

  if (rows.length === 0) return 0;
  const { error } = await supabase.from("community_comments").insert(rows);
  if (error) {
    console.error(`[insert] post=${post.id.slice(0, 8)} failed:`, error.message);
    return 0;
  }
  return rows.length;
}

async function main() {
  console.log(`[fix-community-context] dryRun=${isDryRun}`);

  const { posts, comments, personas } = await loadAllData();
  console.log(`  posts=${posts.length} comments=${comments.length} personas=${personas.length}`);

  const { mismatches, postTopicMap } = detectMismatches(posts, comments);
  console.log(`\n[analysis] 불일치 댓글: ${mismatches.length}개 / 전체 ${comments.length}개 (${(mismatches.length / comments.length * 100).toFixed(1)}%)`);

  // 포스트별 불일치 집계
  const mismatchByPost = new Map();
  for (const mismatch of mismatches) {
    if (!mismatchByPost.has(mismatch.postId)) {
      mismatchByPost.set(mismatch.postId, []);
    }
    mismatchByPost.get(mismatch.postId).push(mismatch);
  }

  console.log(`\n[breakdown] 영향받는 포스트: ${mismatchByPost.size}개`);

  if (isDryRun) {
    console.log("\n━━━━━━━━━━━━━━━━ 삭제 예정 목록 ━━━━━━━━━━━━━━━━");
    const sortedPosts = [...mismatchByPost.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [postId, list] of sortedPosts.slice(0, 20)) {
      const meta = postTopicMap.get(postId);
      console.log(`\n[${meta.primaryTopic}] ${meta.title}`);
      console.log(`  삭제 ${list.length}개:`);
      for (const entry of list.slice(0, 5)) {
        console.log(`    - "${entry.commentSnippet}..." (${entry.reason})`);
      }
      if (list.length > 5) console.log(`    ... +${list.length - 5}개 더`);
    }
    if (sortedPosts.length > 20) {
      console.log(`\n... 추가 ${sortedPosts.length - 20}개 포스트 생략`);
    }
    console.log(`\n[dry] 총 ${mismatches.length}개 댓글 삭제 예정`);
    return;
  }

  console.log(`\n[execute] 삭제 시작...`);
  const deleted = await deleteMismatches(mismatches.map((mismatch) => mismatch.commentId));
  console.log(`  deleted=${deleted}`);

  console.log(`\n[execute] 재생성 시작...`);
  const seedCounter = { value: 80000 };
  let totalInserted = 0;
  for (const post of posts) {
    const needCount = mismatchByPost.get(post.id)?.length ?? 0;
    if (needCount === 0) continue;
    const meta = postTopicMap.get(post.id);
    const inserted = await replenishComments(post, meta, needCount, personas, seedCounter);
    totalInserted += inserted;
    if (inserted > 0) {
      console.log(`  + ${meta.title.slice(0, 40)} [${meta.primaryTopic}] ${inserted}개`);
    }
  }
  console.log(`\n[done] deleted=${deleted} inserted=${totalInserted}`);

  // 사후 검증
  const { comments: afterComments } = await loadAllData();
  const { mismatches: afterMismatches } = detectMismatches(posts, afterComments);
  console.log(`[verify] 잔여 불일치: ${afterMismatches.length}개`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
