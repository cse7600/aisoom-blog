export const SITE_CONFIG = {
  name: "아이숨",
  nameEn: "AISOOM",
  tagline: "아이의 숨을 위한 공기질 연구소",
  description:
    "육아 가정의 공기 환경을 수치로 분석합니다. 가습기·공기청정기 실사용 리뷰, 위생 가이드.",
  url: "https://www.aisoom.co.kr",
  locale: "ko_KR",
  language: "ko",
  ogImage: "/og-default.png",
  twitterHandle: "@aisoom_kr",
} as const;

export const CATEGORIES = [
  {
    slug: "humidifier",
    name: "가습기",
    description: "저온가열·초음파·가열식 방식 비교, 위생 가이드",
    icon: "Droplets",
    path: "/humidifier",
  },
  {
    slug: "air-purifier",
    name: "공기청정기",
    description: "HEPA 필터, CADR, 소음 수치 기반 비교 리뷰",
    icon: "Wind",
    path: "/air-purifier",
  },
  {
    slug: "baby-care",
    name: "육아공간",
    description: "신생아·영유아 방 공기 환경 세팅 가이드",
    icon: "Baby",
    path: "/baby-care",
  },
  {
    slug: "lifestyle",
    name: "라이프스타일",
    description: "실내 공기질, 위생 관리 생활 정보",
    icon: "Home",
    path: "/lifestyle",
  },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export const AFFILIATE_PLATFORMS = {
  carepod: {
    name: "케어팟",
    trackingParam: "ref=carepodlife",
    commissionRate: "제휴",
  },
} as const;

export const SEO_DEFAULTS = {
  titleTemplate: "%s | 아이숨",
  titleSeparator: " | ",
  defaultTitle: "아이숨 — 아이의 숨을 위한 공기질 연구소",
  defaultDescription:
    "육아 가정의 공기 환경을 수치로 분석합니다. 가습기·공기청정기 실사용 리뷰, 위생 가이드.",
  maxTitleLength: 60,
  maxDescriptionLength: 155,
} as const;

export const READING_SPEED_WPM = 500;
