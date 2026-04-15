"use client";

import Link from "next/link";
import {
  Building2,
  Camera,
  ArrowRight,
  Shield,
  TrendingDown,
  Clock4,
  RotateCcw,
  PiggyBank,
} from "lucide-react";

export type AdVariant =
  | "corp-cost"
  | "corp-time"
  | "corp-restart"
  | "cctv-theft"
  | "cctv-legal"
  | "cctv-cost";

export type AdPlacement = "inline" | "sidebar";

interface NativeAdCardProps {
  variant: AdVariant;
  placement?: AdPlacement;
  className?: string;
}

interface AdContent {
  icon: typeof Building2;
  badge: string;
  heroNumber: string;
  heroLabel: string;
  hook: string;
  body: string;
  cta: string;
  href: string;
  // Tailwind 클래스 직접 지정 — CSS 변수 체인 없음
  tw: {
    card: string;       // 카드 배경
    badge: string;      // 뱃지 bg + text
    heroNum: string;    // 히어로 숫자 색
    heroLabel: string;  // 라벨 색
    iconWrap: string;   // 아이콘 배경
    iconColor: string;  // 아이콘 색
    divider: string;    // 구분선
    hook: string;       // 후킹 문장 색
    body: string;       // 본문 색
    cta: string;        // CTA 버튼
    ctaHover: string;   // CTA hover
  };
}

const AD_DATA: Record<AdVariant, AdContent> = {
  "corp-cost": {
    icon: PiggyBank,
    badge: "법인 전환",
    heroNumber: "3,200만 원",
    heroLabel: "연간 절세 가능 금액 (순이익 1억 기준)",
    hook: "순이익 1억 사장님, 법인세 10% vs 종소세 38% 아직도 모르세요?",
    body: "개인사업자로 1년 더 버티면 딱 그만큼 사라집니다. 이미 전환한 사장님들은 매달 270만 원씩 세금 차액을 챙기고 있습니다.",
    cta: "3분 무료 세금 진단 받기",
    href: "https://k-startbiz.org/?ref=STARTBIZ_CYM",
    tw: {
      card: "bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200",
      badge: "bg-emerald-100 text-emerald-800",
      heroNum: "text-emerald-900",
      heroLabel: "text-emerald-700",
      iconWrap: "bg-emerald-200",
      iconColor: "text-emerald-800",
      divider: "bg-emerald-200",
      hook: "text-emerald-950",
      body: "text-emerald-800",
      cta: "bg-emerald-700 text-white hover:bg-emerald-800",
      ctaHover: "",
    },
  },
  "corp-time": {
    icon: Clock4,
    badge: "포괄양수도",
    heroNumber: "5영업일",
    heroLabel: "공백 없는 전환 완료 기간",
    hook: "세무서 폐업 → 재등록 공백 20일, 그 사이 매출은 0원입니다.",
    body: "직접 진행하면 평균 2~3주, 전문 대행은 5영업일 완료. 포괄양수도 계약서 1장으로 거래처·직원·자산을 그대로 넘깁니다.",
    cta: "무료 전환 타임라인 받기",
    href: "https://k-startbiz.org/?ref=STARTBIZ_CYM",
    tw: {
      card: "bg-gradient-to-br from-emerald-50 to-teal-100 border border-teal-200",
      badge: "bg-teal-100 text-teal-800",
      heroNum: "text-teal-900",
      heroLabel: "text-teal-700",
      iconWrap: "bg-teal-200",
      iconColor: "text-teal-800",
      divider: "bg-teal-200",
      hook: "text-teal-950",
      body: "text-teal-800",
      cta: "bg-teal-700 text-white hover:bg-teal-800",
      ctaHover: "",
    },
  },
  "corp-restart": {
    icon: RotateCcw,
    badge: "재창업 전략",
    heroNumber: "세금 4배 차이",
    heroLabel: "개인 재창업 vs 법인 재창업",
    hook: "어차피 다시 시작한다면, 같은 매출로 세금만 4배 줄이는 방법이 있습니다.",
    body: "폐업 후 개인으로 재개업하면 종소세 38% 그대로입니다. 법인으로 재창업하면 첫해부터 법인세 10% 구간 진입.",
    cta: "내 매출 기준 손익계산 받기",
    href: "https://k-startbiz.org/?ref=STARTBIZ_CYM",
    tw: {
      card: "bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200",
      badge: "bg-emerald-100 text-emerald-800",
      heroNum: "text-emerald-900",
      heroLabel: "text-emerald-700",
      iconWrap: "bg-emerald-200",
      iconColor: "text-emerald-800",
      divider: "bg-emerald-200",
      hook: "text-emerald-950",
      body: "text-emerald-800",
      cta: "bg-emerald-700 text-white hover:bg-emerald-800",
      ctaHover: "",
    },
  },
  "cctv-theft": {
    icon: TrendingDown,
    badge: "무인매장 손실 방어",
    heroNumber: "월 34만 원",
    heroLabel: "무인매장 평균 도난 손실액",
    hook: "이번 달에도 모르는 새 사라진 월매출 10%, CCTV 없는 매장이 먼저 털립니다.",
    body: "도난 1건 평균 8~15만 원, 월 2~4건. 렌탈비 월 6만 원이면 1건만 막아도 원금 회수. 지금 이 순간에도 집계되고 있습니다.",
    cta: "무인매장 견적 무료 상담",
    href: "https://keeper.ceo/security?ref=89S42E",
    tw: {
      card: "bg-gradient-to-br from-sky-50 to-sky-100 border border-sky-200",
      badge: "bg-sky-100 text-sky-800",
      heroNum: "text-sky-900",
      heroLabel: "text-sky-700",
      iconWrap: "bg-sky-200",
      iconColor: "text-sky-800",
      divider: "bg-sky-200",
      hook: "text-sky-950",
      body: "text-sky-800",
      cta: "bg-sky-700 text-white hover:bg-sky-800",
      ctaHover: "",
    },
  },
  "cctv-legal": {
    icon: Shield,
    badge: "법률 리스크",
    heroNumber: "5,000만 원",
    heroLabel: "설치 방식 잘못하면 과태료",
    hook: "직원 감시 목적으로 달았다면, 지금 당장 개인정보보호법 위반입니다.",
    body: "안내판 문구 1줄, 설치 각도 하나 차이로 과태료 범위가 갈립니다. 설치 전 법률 체크 없이 달면 고스란히 사업주 책임.",
    cta: "법률 준수 설치 컨설팅",
    href: "https://keeper.ceo/security?ref=89S42E",
    tw: {
      card: "bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200",
      badge: "bg-slate-200 text-slate-700",
      heroNum: "text-slate-900",
      heroLabel: "text-slate-600",
      iconWrap: "bg-slate-200",
      iconColor: "text-slate-700",
      divider: "bg-slate-300",
      hook: "text-slate-900",
      body: "text-slate-700",
      cta: "bg-slate-800 text-white hover:bg-slate-900",
      ctaHover: "",
    },
  },
  "cctv-cost": {
    icon: Camera,
    badge: "매장 CCTV",
    heroNumber: "월 6만 원",
    heroLabel: "커피 20잔 값으로 24시간 보안",
    hook: "매장 보안을 커피값으로 해결 못 하는 이유가 있나요?",
    body: "4대 + 녹화기 렌탈 월 6만 원대, 24시간 관제 포함. 구매 시 초기 220만 원 한 번에, 3년 총비용은 거의 동일.",
    cta: "매장 견적 무료 받기",
    href: "https://keeper.ceo/security?ref=89S42E",
    tw: {
      card: "bg-gradient-to-br from-sky-50 to-sky-100 border border-sky-200",
      badge: "bg-sky-100 text-sky-800",
      heroNum: "text-sky-900",
      heroLabel: "text-sky-700",
      iconWrap: "bg-sky-200",
      iconColor: "text-sky-800",
      divider: "bg-sky-200",
      hook: "text-sky-950",
      body: "text-sky-800",
      cta: "bg-sky-700 text-white hover:bg-sky-800",
      ctaHover: "",
    },
  },
};

export function NativeAdCard({ variant, placement = "inline", className = "" }: NativeAdCardProps) {
  const ad = AD_DATA[variant];
  const Icon = ad.icon;

  if (placement === "sidebar") {
    return (
      <Link
        href={ad.href}
        rel="nofollow sponsored noopener"
        target="_blank"
        aria-label={`${ad.badge} — ${ad.cta}`}
        className={`group block rounded-[var(--radius-card)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-md)] ${ad.tw.card} ${className}`}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${ad.tw.badge}`}>
            {ad.badge}
          </span>
        </div>
        <p className={`text-2xl font-black tabular-nums leading-tight mb-0.5 ${ad.tw.heroNum}`}>
          {ad.heroNumber}
        </p>
        <p className={`text-[11px] font-semibold uppercase tracking-wide mb-3 ${ad.tw.heroLabel}`}>
          {ad.heroLabel}
        </p>
        <p className={`text-xs font-medium leading-snug mb-3 ${ad.tw.hook}`}>
          {ad.hook}
        </p>
        <span className={`flex items-center justify-center gap-1 w-full min-h-[44px] px-3 rounded-[var(--radius-button)] text-sm font-semibold transition-colors ${ad.tw.cta}`}>
          {ad.cta}
          <ArrowRight size={13} />
        </span>
      </Link>
    );
  }

  // inline
  return (
    <Link
      href={ad.href}
      rel="nofollow sponsored noopener"
      target="_blank"
      aria-label={`${ad.badge} — ${ad.cta}`}
      className={`group relative my-8 block overflow-hidden rounded-[var(--radius-card)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-lg)] ${ad.tw.card} ${className}`}
    >
      {/* 우상단 글로우 장식 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-8 h-36 w-36 rounded-full blur-3xl opacity-40"
        style={{ backgroundColor: "currentColor" }}
      />

      <div className="relative z-10 p-5 sm:p-6">
        {/* 상단: badge + 아이콘 */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${ad.tw.badge}`}>
            {ad.badge}
          </span>
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${ad.tw.iconWrap}`}>
            <Icon className={`h-5 w-5 ${ad.tw.iconColor}`} strokeWidth={2.2} />
          </div>
        </div>

        {/* 히어로 숫자 — 시선을 1초 안에 잡는 요소 */}
        <p className={`text-4xl sm:text-5xl font-black tabular-nums leading-[1.05] ${ad.tw.heroNum}`}>
          {ad.heroNumber}
        </p>
        <p className={`mt-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${ad.tw.heroLabel}`}>
          {ad.heroLabel}
        </p>

        {/* 구분선 */}
        <div className={`h-px w-full my-4 ${ad.tw.divider}`} />

        {/* 후킹 카피 */}
        <p className={`text-base sm:text-lg font-bold leading-snug mb-2 ${ad.tw.hook}`}>
          {ad.hook}
        </p>
        <p className={`text-sm leading-relaxed mb-4 ${ad.tw.body}`}>
          {ad.body}
        </p>

        {/* CTA — 모바일 full-width, min-height 52px */}
        <span className={`flex items-center gap-2 w-full sm:w-auto sm:inline-flex min-h-[52px] sm:min-h-[44px] px-5 py-3 rounded-[var(--radius-button)] text-sm font-semibold transition-colors ${ad.tw.cta}`}>
          {ad.cta}
          <ArrowRight size={15} className="ml-auto sm:ml-0" />
        </span>
      </div>
    </Link>
  );
}
