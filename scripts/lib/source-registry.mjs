/**
 * 출처 링크 품질 정책 모듈
 *
 * Phase 9.7.1 — 출처 링크 신뢰성 업그레이드
 *
 * 역할:
 *   - 공식 기관 화이트리스트 (tier 1~4)
 *   - 도메인 블랙리스트 (DNS/HTTP 검증 실패 확인된 것)
 *   - 주제 키워드 → 공식 URL 매핑 테이블
 *   - URL 분류 + 대체 후보 선정 헬퍼
 *
 * 사용:
 *   import { classifyUrl, pickReplacement } from "./lib/source-registry.mjs";
 */

// ─────────────────────────────────────────────────────────────
// Tier 1: 정부 최상위 도메인 (.go.kr). 무조건 신뢰.
// ─────────────────────────────────────────────────────────────
export const TIER1_GOV_DOMAINS = new Set([
  "law.go.kr",
  "nts.go.kr",
  "mss.go.kr",
  "moef.go.kr",
  "pipc.go.kr",
  "moel.go.kr",
  "mois.go.kr",
  "police.go.kr",
  "nfa.go.kr",
  "nfs.go.kr",
  "mfds.go.kr",
  "kca.go.kr",
  "gov.kr",
  "hometax.go.kr",
  "wetax.go.kr",
  "iros.go.kr",
  "minimumwage.go.kr",
  "mohw.go.kr",
  "ftc.go.kr",
  "kats.go.kr",
  "nfds.go.kr",
  "bepa.kr",
  "golmok.seoul.go.kr",
]);

// ─────────────────────────────────────────────────────────────
// Tier 2: 실존 확인된 .or.kr 공공기관
// ─────────────────────────────────────────────────────────────
export const TIER2_PUBLIC_DOMAINS = new Set([
  "kisa.or.kr",
  "semas.or.kr",
  "nhis.or.kr",
  "kcomwel.or.kr",
  "kosha.or.kr",
  "kacpta.or.kr",
  "fss.or.kr",
  "comwel.or.kr",
  "kait.or.kr",
  "4insure.or.kr",
  "seoulallnet.or.kr",
]);

// ─────────────────────────────────────────────────────────────
// Tier 3: 공식 제조사·국제 표준·대형 포털
// ─────────────────────────────────────────────────────────────
export const TIER3_BRAND_DOMAINS = new Set([
  "hanwhavision.com",
  "samsung.com",
  "lg.com",
  "onvif.org",
]);

// ─────────────────────────────────────────────────────────────
// Tier 4: 자사 파트너 블로그 (접속 가능할 때만 보조 출처 인정)
// ─────────────────────────────────────────────────────────────
export const TIER4_PARTNER_DOMAINS = new Set([
  "keeper.ceo",
  "corp.apply.kr",
]);

// ─────────────────────────────────────────────────────────────
// 블랙리스트: 즉시 제거 또는 교체 대상
// (DNS/HTTP 실패가 반복 확인된 도메인)
// ─────────────────────────────────────────────────────────────
export const DOMAIN_BLACKLIST = new Set([
  "gbsc.or.kr",
]);

// ─────────────────────────────────────────────────────────────
// 주제 키워드 → 공식 대체 URL 매핑
// 앵커 텍스트에서 매칭할 키워드 (긴 것부터 체크)
// priority: 높을수록 먼저 채택 (동점이면 키워드 길이)
// ─────────────────────────────────────────────────────────────
export const OFFICIAL_SOURCE_MAP = [
  // 소상공인 (최우선)
  { keywords: ["소상공인 지원", "소상공인 정책자금", "소상공인 지원센터", "경영환경개선", "스마트상점"], url: "https://www.semas.or.kr", name: "소상공인시장진흥공단", tier: 2, priority: 10 },
  { keywords: ["소상공인"], url: "https://www.semas.or.kr", name: "소상공인시장진흥공단", tier: 2, priority: 8 },
  { keywords: ["골목상권", "골목상점"], url: "https://www.mss.go.kr", name: "중소벤처기업부", tier: 1, priority: 7 },

  // 법인·세무 (구체적 키워드 우선)
  { keywords: ["법인세율", "법인세 신고", "법인세"], url: "https://www.nts.go.kr", name: "국세청", tier: 1, priority: 9 },
  { keywords: ["부가가치세", "부가세 신고", "VAT"], url: "https://www.nts.go.kr", name: "국세청", tier: 1, priority: 9 },
  { keywords: ["홈택스"], url: "https://www.hometax.go.kr", name: "국세청 홈택스", tier: 1, priority: 9 },
  { keywords: ["위택스", "지방세"], url: "https://www.wetax.go.kr", name: "행정안전부 위택스", tier: 1, priority: 8 },
  { keywords: ["법인등기", "정관변경", "변경등기", "상호검색"], url: "http://www.iros.go.kr", name: "대법원 인터넷등기소", tier: 1, priority: 9 },
  { keywords: ["법령", "상법", "정관"], url: "https://www.law.go.kr", name: "법제처 국가법령정보센터", tier: 1, priority: 7 },
  { keywords: ["법인설립", "창업"], url: "https://www.mss.go.kr", name: "중소벤처기업부", tier: 1, priority: 8 },
  { keywords: ["세무사"], url: "https://www.kacpta.or.kr", name: "한국세무사회", tier: 2, priority: 7 },
  { keywords: ["공정거래", "FTC 한국"], url: "https://www.ftc.go.kr", name: "공정거래위원회", tier: 1, priority: 7 },
  { keywords: ["기획재정부", "조세정책"], url: "https://www.moef.go.kr", name: "기획재정부", tier: 1, priority: 7 },

  // 노동·4대보험
  { keywords: ["근로기준법", "노동법", "고용노동"], url: "https://www.moel.go.kr", name: "고용노동부", tier: 1, priority: 8 },
  { keywords: ["최저임금"], url: "https://www.minimumwage.go.kr", name: "최저임금위원회", tier: 1, priority: 9 },
  { keywords: ["건강보험"], url: "https://www.nhis.or.kr", name: "국민건강보험공단", tier: 2, priority: 8 },
  { keywords: ["근로복지", "산재보험"], url: "https://www.kcomwel.or.kr", name: "근로복지공단", tier: 2, priority: 8 },
  { keywords: ["산업안전", "안전보건"], url: "https://www.kosha.or.kr", name: "안전보건공단", tier: 2, priority: 8 },
  { keywords: ["4대보험"], url: "https://www.4insure.or.kr", name: "4대사회보험 정보연계센터", tier: 2, priority: 7 },

  // CCTV·개인정보·보안 (개인영상정보가 소상공인보다 우선되면 안 됨)
  { keywords: ["개인영상정보", "영상정보처리기기", "CCTV 개인정보"], url: "https://www.pipc.go.kr", name: "개인정보보호위원회", tier: 1, priority: 8 },
  { keywords: ["개인정보보호"], url: "https://www.pipc.go.kr", name: "개인정보보호위원회", tier: 1, priority: 7 },
  { keywords: ["경찰청", "112", "범죄통계", "수사"], url: "https://www.police.go.kr", name: "경찰청", tier: 1, priority: 8 },
  { keywords: ["소방청", "화재조사", "화재통계"], url: "https://www.nfa.go.kr", name: "소방청", tier: 1, priority: 8 },
  { keywords: ["KISA", "한국인터넷진흥원", "해킹", "사이버보안"], url: "https://www.kisa.or.kr", name: "한국인터넷진흥원", tier: 2, priority: 8 },

  // 식약·보건·의료
  { keywords: ["식품의약품", "식약처"], url: "https://www.mfds.go.kr", name: "식품의약품안전처", tier: 1, priority: 8 },
  { keywords: ["보건복지부"], url: "https://www.mohw.go.kr", name: "보건복지부", tier: 1, priority: 7 },

  // 금융
  { keywords: ["금융감독원", "금감원"], url: "https://www.fss.or.kr", name: "금융감독원", tier: 2, priority: 7 },

  // 표준·제조사
  { keywords: ["ONVIF"], url: "https://www.onvif.org", name: "ONVIF International Forum", tier: 3, priority: 6 },
  { keywords: ["한화비전", "키퍼 제조"], url: "https://www.hanwhavision.com", name: "한화비전", tier: 3, priority: 6 },

  // 정부 통합 (우선순위 낮음 — 구체적 기관이 없을 때만)
  { keywords: ["정부24"], url: "https://www.gov.kr", name: "정부24", tier: 1, priority: 5 },
  { keywords: ["행정안전부"], url: "https://www.mois.go.kr", name: "행정안전부", tier: 1, priority: 6 },
];

/**
 * 해외 출처 매칭이 어려운 앵커 패턴
 * — 이 패턴이 매칭되면 국내 대체가 부적절하므로 제거 선호
 */
export const FOREIGN_ANCHOR_PATTERNS = [
  /NDAA/i,
  /미국\s*(?:의회|정부|법안|국방)/,
  /FCC/i,
  /congress\.gov/i,
  /GDPR/i,
  /EU\s*(?:집행위|회원국|규정)/,
];

// ─────────────────────────────────────────────────────────────
// 카테고리별 기본 fallback (대체 후보를 못 찾을 때 최후 보루)
// ─────────────────────────────────────────────────────────────
export const CATEGORY_FALLBACK = {
  tech: [
    { url: "https://www.pipc.go.kr", name: "개인정보보호위원회", tier: 1 },
    { url: "https://www.kisa.or.kr", name: "한국인터넷진흥원", tier: 2 },
    { url: "https://www.police.go.kr", name: "경찰청", tier: 1 },
    { url: "https://www.semas.or.kr", name: "소상공인시장진흥공단", tier: 2 },
  ],
  finance: [
    { url: "https://www.nts.go.kr", name: "국세청", tier: 1 },
    { url: "https://www.law.go.kr", name: "법제처 국가법령정보센터", tier: 1 },
    { url: "http://www.iros.go.kr", name: "대법원 인터넷등기소", tier: 1 },
    { url: "https://www.mss.go.kr", name: "중소벤처기업부", tier: 1 },
  ],
  beauty: [
    { url: "https://www.mfds.go.kr", name: "식품의약품안전처", tier: 1 },
    { url: "https://www.ftc.go.kr", name: "공정거래위원회", tier: 1 },
  ],
  "home-living": [
    { url: "https://www.law.go.kr", name: "법제처 국가법령정보센터", tier: 1 },
    { url: "https://www.ftc.go.kr", name: "공정거래위원회", tier: 1 },
  ],
  travel: [
    { url: "https://www.gov.kr", name: "정부24", tier: 1 },
  ],
  default: [
    { url: "https://www.law.go.kr", name: "법제처 국가법령정보센터", tier: 1 },
    { url: "https://www.gov.kr", name: "정부24", tier: 1 },
  ],
};

// ─────────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────────

/**
 * URL 호스트 추출
 */
export function extractHost(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * URL을 tier로 분류
 * @returns {"tier1"|"tier2"|"tier3"|"tier4"|"blacklist"|"unknown"}
 */
export function classifyUrl(url) {
  const host = extractHost(url);
  if (!host) return "unknown";
  if (DOMAIN_BLACKLIST.has(host)) return "blacklist";
  if (TIER1_GOV_DOMAINS.has(host) || host.endsWith(".go.kr")) return "tier1";
  if (TIER2_PUBLIC_DOMAINS.has(host)) return "tier2";
  if (TIER3_BRAND_DOMAINS.has(host)) return "tier3";
  if (TIER4_PARTNER_DOMAINS.has(host)) return "tier4";
  return "unknown";
}

/**
 * 해외 출처 여부 판정
 */
export function isForeignAnchor(anchor, originalUrl) {
  const text = `${anchor} ${originalUrl}`;
  return FOREIGN_ANCHOR_PATTERNS.some((p) => p.test(text));
}

/**
 * 앵커 텍스트 + 원 URL에서 주제 키워드 매칭 → 대체 후보 반환
 * @param {string} anchor 마크다운 링크 텍스트
 * @param {string} originalUrl 원본 URL
 * @param {string} [category] 어필리에이트 카테고리 (fallback용)
 * @returns {Array<{url:string, name:string, tier:number, score:number}>} 점수 높은 순
 */
export function pickReplacement(anchor, originalUrl, category = "default") {
  // 해외 출처는 국내 대체가 부적절 → 후보 없음 반환 (호출자가 제거 처리)
  if (isForeignAnchor(anchor, originalUrl)) {
    return [];
  }

  const text = `${anchor} ${originalUrl}`.toLowerCase();
  const candidates = [];

  for (const entry of OFFICIAL_SOURCE_MAP) {
    for (const kw of entry.keywords) {
      if (text.includes(kw.toLowerCase())) {
        candidates.push({
          url: entry.url,
          name: entry.name,
          tier: entry.tier,
          // priority × 100 + 키워드 길이 → priority가 우선
          score: (entry.priority ?? 5) * 100 + kw.length,
          matchedKeyword: kw,
        });
        break;
      }
    }
  }

  if (candidates.length === 0) {
    const fallback = CATEGORY_FALLBACK[category] ?? CATEGORY_FALLBACK.default;
    return fallback.map((f, idx) => ({ ...f, score: -idx }));
  }

  // 중복 제거 + 점수 내림차순
  const seen = new Set();
  const unique = [];
  candidates.sort((a, b) => b.score - a.score);
  for (const c of candidates) {
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    unique.push(c);
  }
  return unique;
}

/**
 * 어필리에이트 이름 → 카테고리 매핑
 */
export const AFFILIATE_CATEGORY_MAP = {
  "키퍼메이트": "tech",
  "법인설립지원센터": "finance",
  "밀리의서재": "home-living",
  "차별화상회": "finance",
};

/**
 * 마크다운 링크 형식 변환
 * @param {string} anchor
 * @param {string} url
 */
export function formatMarkdownLink(anchor, url) {
  return `- [${anchor}](${url})`;
}
