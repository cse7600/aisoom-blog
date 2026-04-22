"use client";

import Link from "next/link";
import {
  Droplets,
  Wind,
  ShieldCheck,
  Star,
  ThumbsUp,
  ArrowRight,
  Thermometer,
  Baby,
} from "lucide-react";

export type AdVariant =
  | "humidifier-safe"
  | "humidifier-review"
  | "humidifier-vs"
  | "air-compact"
  | "air-baby"
  | "air-silent";

export type AdPlacement = "inline" | "sidebar";

interface NativeAdCardProps {
  variant: AdVariant;
  placement?: AdPlacement;
  className?: string;
}

interface AdContent {
  icon: typeof Droplets;
  badge: string;
  heroNumber: string;
  heroLabel: string;
  hook: string;
  body: string;
  cta: string;
  href: string;
  tw: {
    card: string;
    badge: string;
    heroNum: string;
    heroLabel: string;
    iconWrap: string;
    iconColor: string;
    divider: string;
    hook: string;
    body: string;
    cta: string;
    ctaHover: string;
  };
}

const AD_DATA: Record<AdVariant, AdContent> = {
  "humidifier-safe": {
    icon: ShieldCheck,
    badge: "자동살균 가습기",
    heroNumber: "100만 대",
    heroLabel: "누적 판매 — 병원·산후조리원 공식 사용",
    hook: "초음파 가습기 쓰면서 세균 걱정 하셨나요?",
    body: "케어팟 X50V는 저온가열로 세균을 자동 사멸합니다. 고온 화상 위험 없이, 세척 걱정도 없이. 아이 방에 두기 가장 안전한 가습기입니다.",
    cta: "케어팟 X50V 자세히 보기",
    href: "https://carepod.co.kr/",
    tw: {
      card: "bg-gradient-to-br from-amber-50 to-stone-100 border border-amber-200",
      badge: "bg-amber-100 text-amber-800",
      heroNum: "text-amber-900",
      heroLabel: "text-amber-700",
      iconWrap: "bg-amber-200",
      iconColor: "text-amber-800",
      divider: "bg-amber-200",
      hook: "text-stone-900",
      body: "text-stone-700",
      cta: "bg-amber-600 hover:bg-amber-700 text-white",
      ctaHover: "hover:bg-amber-700",
    },
  },
  "humidifier-review": {
    icon: Star,
    badge: "2,588개 리뷰",
    heroNumber: "4.8점",
    heroLabel: "네이버 구매자 리뷰 2,588건 · 4.8점 — 2026년 4월 기준",
    hook: "엄마들이 가장 많이 선택한 가습기, 이유가 있습니다.",
    body: "케어팟 X50V는 리뷰 2,588건 중 대부분이 '위생'과 '살균'을 이유로 선택했습니다. 아이 키우는 집이라면 한 번은 읽어봐야 할 솔직한 후기들.",
    cta: "실사용 후기 전체 보기",
    href: "https://carepod.co.kr/",
    tw: {
      card: "bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200",
      badge: "bg-orange-100 text-orange-800",
      heroNum: "text-orange-900",
      heroLabel: "text-orange-700",
      iconWrap: "bg-orange-200",
      iconColor: "text-orange-800",
      divider: "bg-orange-200",
      hook: "text-stone-900",
      body: "text-stone-700",
      cta: "bg-orange-600 hover:bg-orange-700 text-white",
      ctaHover: "hover:bg-orange-700",
    },
  },
  "humidifier-vs": {
    icon: ThumbsUp,
    badge: "비교 분석",
    heroNumber: "9%",
    heroLabel: "할인 중 — 정가 289,000원 → 264,000원",
    hook: "위생 기준 하나로 결정이 달라집니다. 케어팟과 코웨이를 3년 TCO로 비교했습니다.",
    body: "3년 기준 케어팟 1대가 코웨이 렌탈보다 총비용이 낮거나 비슷하다는 계산 결과가 있습니다. 위생은 구조적으로 차이가 납니다.",
    cta: "케어팟 가격 확인하기",
    href: "https://carepod.co.kr/",
    tw: {
      card: "bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200",
      badge: "bg-yellow-100 text-yellow-800",
      heroNum: "text-yellow-900",
      heroLabel: "text-yellow-700",
      iconWrap: "bg-yellow-200",
      iconColor: "text-yellow-800",
      divider: "bg-yellow-200",
      hook: "text-stone-900",
      body: "text-stone-700",
      cta: "bg-yellow-600 hover:bg-yellow-700 text-white",
      ctaHover: "hover:bg-yellow-700",
    },
  },
  "air-compact": {
    icon: Wind,
    badge: "컴팩트 공기청정기",
    heroNumber: "270m³/h",
    heroLabel: "CADR — 작은 크기, 강력한 청정 성능",
    hook: "거실 대형 공기청정기가 아이 방 공기까지 책임지나요?",
    body: "케어팟 Air Cube One은 침실·아이방 개인 공간 전용으로 설계됐습니다. HEPA13 3중 필터 + 24dB 초저소음으로 아이가 자는 동안도 조용히 작동합니다.",
    cta: "Air Cube One 자세히 보기",
    href: "https://carepod.co.kr/",
    tw: {
      card: "bg-gradient-to-br from-stone-50 to-slate-100 border border-stone-200",
      badge: "bg-stone-200 text-stone-800",
      heroNum: "text-stone-900",
      heroLabel: "text-stone-600",
      iconWrap: "bg-stone-200",
      iconColor: "text-stone-800",
      divider: "bg-stone-200",
      hook: "text-stone-900",
      body: "text-stone-700",
      cta: "bg-stone-700 hover:bg-stone-800 text-white",
      ctaHover: "hover:bg-stone-800",
    },
  },
  "air-baby": {
    icon: Baby,
    badge: "아이방 전용",
    heroNumber: "HEPA13",
    heroLabel: "3중 필터 — PM2.5·바이러스·포름알데히드 동시 차단",
    hook: "아이방 공기청정기, 소음 때문에 꺼두신 적 있나요?",
    body: "케어팟 Air Cube One은 PM2.5 초미세먼지 센서로 실시간 공기질을 측정하고 AI가 자동으로 강도를 조절합니다. 에너지 소비효율 1등급이라 24시간 틀어도 부담 없습니다.",
    cta: "아이방 공기질 개선 시작하기",
    href: "https://carepod.co.kr/",
    tw: {
      card: "bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200",
      badge: "bg-amber-100 text-amber-800",
      heroNum: "text-amber-900",
      heroLabel: "text-amber-700",
      iconWrap: "bg-amber-200",
      iconColor: "text-amber-800",
      divider: "bg-amber-200",
      hook: "text-stone-900",
      body: "text-stone-700",
      cta: "bg-amber-700 hover:bg-amber-800 text-white",
      ctaHover: "hover:bg-amber-800",
    },
  },
  "air-silent": {
    icon: Thermometer,
    badge: "초저소음 24dB",
    heroNumber: "24dB",
    heroLabel: "나뭇잎 흔들리는 소리 수준 — 수면 방해 없음",
    hook: "공기청정기 팬 소리에 아이가 깨진 않으셨나요?",
    body: "케어팟 Air Cube One은 24dB 초저소음으로 아이 수면을 방해하지 않습니다. AI 자동 청정 모드로 수면 중에는 자동으로 약풍 전환.",
    cta: "조용한 공기청정기 확인하기",
    href: "https://carepod.co.kr/",
    tw: {
      card: "bg-gradient-to-br from-stone-50 to-amber-50 border border-stone-200",
      badge: "bg-stone-200 text-stone-800",
      heroNum: "text-stone-900",
      heroLabel: "text-stone-600",
      iconWrap: "bg-stone-300",
      iconColor: "text-stone-800",
      divider: "bg-stone-200",
      hook: "text-stone-900",
      body: "text-stone-700",
      cta: "bg-stone-700 hover:bg-stone-800 text-white",
      ctaHover: "hover:bg-stone-800",
    },
  },
};

export function NativeAdCard({ variant, placement = "inline", className = "" }: NativeAdCardProps) {
  const ad = AD_DATA[variant];
  const Icon = ad.icon;
  const isSidebar = placement === "sidebar";

  if (isSidebar) {
    return (
      <aside className={`rounded-2xl p-4 ${ad.tw.card} ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <div className={`p-1.5 rounded-lg ${ad.tw.iconWrap}`}>
            <Icon size={16} className={ad.tw.iconColor} />
          </div>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ad.tw.badge}`}>
            {ad.badge}
          </span>
        </div>
        <div className="mb-2">
          <span className={`text-2xl font-extrabold ${ad.tw.heroNum}`}>{ad.heroNumber}</span>
          <p className={`text-xs mt-0.5 ${ad.tw.heroLabel}`}>{ad.heroLabel}</p>
        </div>
        <div className={`h-px my-3 ${ad.tw.divider}`} />
        <p className={`text-sm font-semibold leading-snug mb-1 ${ad.tw.hook}`}>{ad.hook}</p>
        <p className={`text-xs leading-relaxed mb-3 ${ad.tw.body}`}>{ad.body}</p>
        <Link
          href={ad.href}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className={`flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-xl text-xs font-bold transition-colors ${ad.tw.cta}`}
        >
          {ad.cta}
          <ArrowRight size={12} />
        </Link>
        <p className="text-[10px] text-stone-400 mt-2 text-center">광고</p>
      </aside>
    );
  }

  return (
    <div className={`rounded-2xl p-5 my-6 ${ad.tw.card} ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ad.tw.badge}`}>
              {ad.badge}
            </span>
          </div>
          <div className="mb-3">
            <span className={`text-3xl font-extrabold ${ad.tw.heroNum}`}>{ad.heroNumber}</span>
            <span className={`text-sm ml-2 ${ad.tw.heroLabel}`}>{ad.heroLabel}</span>
          </div>
          <p className={`text-base font-semibold leading-snug mb-1 ${ad.tw.hook}`}>{ad.hook}</p>
          <p className={`text-sm leading-relaxed ${ad.tw.body}`}>{ad.body}</p>
        </div>
        <div className={`p-3 rounded-2xl shrink-0 ${ad.tw.iconWrap}`}>
          <Icon size={28} className={ad.tw.iconColor} />
        </div>
      </div>
      <div className={`h-px my-4 ${ad.tw.divider}`} />
      <div className="flex items-center justify-between">
        <Link
          href={ad.href}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className={`flex items-center gap-2 py-2.5 px-5 rounded-xl text-sm font-bold transition-colors ${ad.tw.cta}`}
        >
          {ad.cta}
          <ArrowRight size={14} />
        </Link>
        <p className="text-xs text-stone-400">광고</p>
      </div>
    </div>
  );
}
