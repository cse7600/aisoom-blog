export const SITE_CONFIG = {
  name: "팩트노트",
  nameEn: "FactNote",
  tagline: "정확한 정보, 팩트만",
  description:
    "어필리에이트 정보 큐레이션 허브. 실사용자 경험 기반의 팩트 정보만 제공합니다.",
  url: "https://www.factnote.co.kr",
  locale: "ko_KR",
  language: "ko",
  ogImage: "/og-default.png",
  twitterHandle: "@factnote_kr",
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
    trackingParam: "src=factnote",
    commissionRate: "3-10%",
  },
  naver: {
    name: "네이버",
    trackingParam: "ref=factnote",
    commissionRate: "1-5%",
  },
  amazon: {
    name: "아마존",
    trackingParam: "tag=factnote-20",
    commissionRate: "1-10%",
  },
  financial: {
    name: "금융",
    trackingParam: "partner=factnote",
    commissionRate: "CPA",
  },
} as const;

export const SEO_DEFAULTS = {
  titleTemplate: "%s | 팩트노트",
  titleSeparator: " | ",
  defaultTitle: "팩트노트 - 정확한 정보, 팩트만",
  defaultDescription:
    "어필리에이트 정보 큐레이션 허브. 실사용자 경험 기반의 팩트 정보만 제공합니다. CCTV, 법인설립, 전자책, 식자재 등 카테고리별 검증 콘텐츠.",
  maxTitleLength: 60,
  maxDescriptionLength: 155,
} as const;

export const READING_SPEED_WPM = 500;
