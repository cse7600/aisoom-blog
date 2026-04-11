export const SITE_CONFIG = {
  name: "꿀정보",
  nameEn: "KkulInfo",
  tagline: "찐 비교, 찐 추천",
  description:
    "구매 전 꼭 확인하세요. 전문가가 직접 비교하고 테스트한 찐 추천 콘텐츠.",
  url: "https://www.factnote.co.kr",
  locale: "ko_KR",
  language: "ko",
  ogImage: "/og-default.png",
  twitterHandle: "@kkulinfo",
} as const;

export const CATEGORIES = [
  {
    slug: "tech",
    name: "테크/가전",
    description: "스마트폰, 노트북, 가전제품 비교 리뷰",
    icon: "Cpu",
    path: "/tech",
  },
  {
    slug: "finance",
    name: "금융",
    description: "신용카드, 적금, 보험 비교 분석",
    icon: "Wallet",
    path: "/finance",
  },
  {
    slug: "beauty",
    name: "뷰티/건강",
    description: "화장품, 건강기능식품 솔직 리뷰",
    icon: "Heart",
    path: "/beauty",
  },
  {
    slug: "home-living",
    name: "생활/홈",
    description: "생활용품, 인테리어, 주방용품 추천",
    icon: "Home",
    path: "/home-living",
  },
  {
    slug: "travel",
    name: "여행",
    description: "국내/해외 여행 가이드, 숙소 비교",
    icon: "Plane",
    path: "/travel",
  },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export const AFFILIATE_PLATFORMS = {
  coupang: {
    name: "쿠팡",
    trackingParam: "src=kkulinfo",
    commissionRate: "3-10%",
  },
  naver: {
    name: "네이버",
    trackingParam: "ref=kkulinfo",
    commissionRate: "1-5%",
  },
  amazon: {
    name: "아마존",
    trackingParam: "tag=kkulinfo-20",
    commissionRate: "1-10%",
  },
  financial: {
    name: "금융",
    trackingParam: "partner=kkulinfo",
    commissionRate: "CPA",
  },
} as const;

export const SEO_DEFAULTS = {
  titleTemplate: "%s | 꿀정보",
  titleSeparator: " | ",
  defaultTitle: "꿀정보 - 찐 비교, 찐 추천",
  defaultDescription:
    "구매 전 꼭 확인하세요. 전문가가 직접 비교하고 테스트한 찐 추천 콘텐츠. 테크, 금융, 뷰티, 생활, 여행 카테고리별 실용 정보.",
  maxTitleLength: 60,
  maxDescriptionLength: 155,
} as const;

export const READING_SPEED_WPM = 500;
