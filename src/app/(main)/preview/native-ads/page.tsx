/**
 * 개발용 프리뷰 — 네이티브 광고 컴포넌트 UI 확인
 * /preview/native-ads 에서 접근
 */

"use client";

import { useState } from "react";
import { NativeAdCard, type AdVariant } from "@/components/content/NativeAdCard";
import { Moon, Sun, Smartphone, Monitor } from "lucide-react";

const MOCK_HUMIDIFIER_CONTENT = {
  before: `
    <p>아이가 있는 집이라면 겨울철 적정 습도(40~60%)를 유지하는 것이 중요합니다. 문제는 시중에 유통되는 초음파 가습기의 70%가 세균 오염 기준치를 초과한다는 소비자원 조사 결과입니다.</p>
    <h2>가습기 방식별 살균 성능 비교</h2>
    <p>가습 방식은 크게 초음파, 가열식, 기화식 세 가지로 나뉩니다. 초음파는 물 입자를 진동으로 쪼개 분무하기 때문에 탱크 세균이 그대로 공기 중에 방출됩니다. 가열식은 물을 끓여 증기로 내보내지만 히터 온도가 65도 이상이면 화상 위험이 있습니다.</p>
  `,
  middle: `
    <h2>케어팟 X50V는 왜 저온가열 방식인가요?</h2>
    <p>저온가열(50~60도)은 세균 사멸 온도(56도)를 유지하면서도 증기 온도는 체온과 유사한 수준으로 낮춥니다. 2026년 식약처 인증 기준 99.9% 살균율 달성. 병원·산후조리원 공식 사용 기준을 충족하는 유일한 가정용 가습기입니다.</p>
  `,
  after: `
    <h2>자주 묻는 질문</h2>
    <h3>Q. 케어팟 X50V는 전기세가 많이 나오나요?</h3>
    <p>저전력 설계로 일반 가열식 대비 전력 소비 40% 절감. 하루 8시간 사용 기준 월 전기세 약 1,200원 수준입니다.</p>
    <h3>Q. 물통 세척은 얼마나 자주 해야 하나요?</h3>
    <p>저온가열 자동살균으로 탱크 내 세균이 억제되기 때문에 주 1회 간단한 세척으로 충분합니다. 일반 초음파 가습기의 매일 세척 권장과 비교하면 관리 부담이 크게 줄어듭니다.</p>
    <h2>정리 — TL;DR</h2>
    <p>세균 걱정 없이 아이 방에 두려면 저온가열 방식 가습기가 맞습니다. 케어팟 X50V는 100만 대 판매 실적, 4.8점 리뷰, 병원 공식 사용 기준을 갖춘 선택지입니다.</p>
  `,
};

const MOCK_AIR_CONTENT = {
  before: `
    <p>서울 기준 연간 미세먼지 나쁨 일수는 70일을 넘습니다. 대형 공기청정기 한 대로 집 전체를 커버하려는 가정이 많지만, 실제로는 아이방처럼 폐쇄된 개인 공간까지 공기 순환이 되지 않습니다.</p>
    <h2>거실 공기청정기가 아이방을 커버하지 못하는 이유</h2>
    <p>CADR(청정공기공급률)은 면적 효율을 나타냅니다. 20평 거실에 맞게 설계된 제품이 문 닫힌 8평 아이방까지 감당하면 실제 공기 교환 횟수는 설계 기준의 40%로 떨어집니다.</p>
  `,
  middle: `
    <h2>아이방 전용 공기청정기가 필요한 이유는 무엇인가요?</h2>
    <p>케어팟 Air Cube One의 CADR 270m³/h는 10평 이하 공간 기준 시간당 4회 공기 교환을 보장합니다. HEPA13 필터는 0.3마이크론 이상 입자 99.97% 차단, PM2.5 센서가 실시간으로 공기질을 측정해 AI가 팬 속도를 자동 조절합니다.</p>
  `,
  after: `
    <h2>자주 묻는 질문</h2>
    <h3>Q. 24dB가 얼마나 조용한 건가요?</h3>
    <p>나뭇잎이 살랑이는 소리(약 20dB)와 속삭이는 대화(약 30dB) 사이입니다. 아이가 자는 방에서도 수면 방해 없이 작동합니다.</p>
    <h3>Q. 필터 교체 주기는 어떻게 되나요?</h3>
    <p>24시간 연속 사용 기준 약 6개월. 센서가 교체 시기를 자동으로 알려줍니다. 필터 가격은 29,000원입니다.</p>
    <h2>정리 — TL;DR</h2>
    <p>아이방 전용 소형 공기청정기가 대형 거실 제품보다 실내 공기 교환 효율이 높습니다. Air Cube One은 HEPA13 + 24dB + 에너지 1등급 3가지를 갖춘 선택지입니다.</p>
  `,
};

function MockArticle({
  title,
  content,
  adVariants,
  adPlacement,
}: {
  title: string;
  content: { before: string; middle: string; after: string };
  adVariants: [AdVariant, AdVariant, AdVariant];
  adPlacement?: "inline" | "sidebar";
}) {
  return (
    <article className="max-w-narrow w-full">
      <header className="mb-8 pb-6 border-b border-border">
        <span className="inline-block px-2.5 py-1 text-caption font-medium bg-primary text-white rounded-badge mb-3">
          humidifier
        </span>
        <h1 className="text-display-sm font-bold text-foreground mb-3">{title}</h1>
        <p className="text-body-sm text-foreground/40">
          케어팟 라이프 에디터 · 2026년 4월 22일 · 8분 읽기
        </p>
      </header>

      <div className="prose-content" dangerouslySetInnerHTML={{ __html: content.before }} />
      <NativeAdCard variant={adVariants[0]} placement={adPlacement ?? "inline"} />
      <div className="prose-content" dangerouslySetInnerHTML={{ __html: content.middle }} />
      <NativeAdCard variant={adVariants[1]} placement={adPlacement ?? "inline"} />
      <div className="prose-content" dangerouslySetInnerHTML={{ __html: content.after }} />
      <NativeAdCard variant={adVariants[2]} placement={adPlacement ?? "inline"} />
    </article>
  );
}

const ALL_VARIANTS: AdVariant[] = [
  "humidifier-safe",
  "humidifier-review",
  "humidifier-vs",
  "air-compact",
  "air-baby",
  "air-silent",
];

export default function NativeAdsPreviewPage() {
  const [isDark, setIsDark] = useState(false);
  const [showMobile, setShowMobile] = useState(false);

  return (
    <div className={isDark ? "dark" : ""}>
      <div className="min-h-screen bg-background text-foreground transition-colors">
        <div className="mx-auto max-w-content px-4 sm:px-6 py-8">
          {/* 컨트롤 바 */}
          <div className="sticky top-2 z-20 mb-8 flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface-1/90 p-3 backdrop-blur">
            <p className="text-body-sm font-semibold">
              개발 프리뷰 — /preview/native-ads
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowMobile((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-button border border-border text-body-sm font-medium hover:bg-surface-3 transition-colors"
                aria-pressed={showMobile}
              >
                {showMobile ? <Smartphone className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
                {showMobile ? "모바일 뷰" : "데스크탑 뷰"}
              </button>
              <button
                type="button"
                onClick={() => setIsDark((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-button border border-border text-body-sm font-medium hover:bg-surface-3 transition-colors"
                aria-pressed={isDark}
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {isDark ? "라이트" : "다크"}
              </button>
            </div>
          </div>

          <div className="mb-10 p-4 bg-amber-50 border border-amber-200 rounded-card dark:bg-amber-950/30 dark:border-amber-900">
            <p className="text-body-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">
              케어팟 네이티브 광고 6종 — 가습기 3종 + 공기청정기 3종
            </p>
            <p className="text-body-sm text-amber-700 dark:text-amber-300">
              amber/orange 계열(가습기) + stone/slate 계열(공기청정기). robots noindex 적용, 프로덕션 노출되지 않음.
            </p>
          </div>

          {/* Section 0: 전체 6종 개별 카드 비교 */}
          <section className="mb-16">
            <h2 className="text-display-sm font-bold mb-2">전체 6종 inline 비교</h2>
            <p className="text-body-sm text-foreground/50 mb-6">
              각 카드를 단독으로 볼 때 히어로 숫자의 시선 잡기 효과 확인
            </p>
            <div
              className={`mx-auto grid gap-6 ${
                showMobile ? "max-w-[390px] grid-cols-1" : "max-w-3xl grid-cols-1 md:grid-cols-2"
              }`}
            >
              {ALL_VARIANTS.map((variant) => (
                <NativeAdCard key={variant} variant={variant} placement="inline" />
              ))}
            </div>
          </section>

          <hr className="border-border my-12" />

          {/* Section 1: 가습기 inline ads (본문 맥락) */}
          <section className="mb-16">
            <h2 className="text-display-sm font-bold mb-2">가습기 — 본문 맥락 삽입</h2>
            <p className="text-body-sm text-foreground/50 mb-8">
              실제 포스트 중간·섹션 후 삽입. 살균 안전·후기·비교 3가지 각도
            </p>
            <div className={showMobile ? "mx-auto max-w-[390px]" : ""}>
              <MockArticle
                title="【비교】초음파 가습기 vs 가열식 가습기 — 아이 방에 어떤 게 더 안전한가 (2026년 기준)"
                content={MOCK_HUMIDIFIER_CONTENT}
                adVariants={["humidifier-safe", "humidifier-review", "humidifier-vs"]}
              />
            </div>
          </section>

          <hr className="border-border my-12" />

          {/* Section 2: 공기청정기 inline ads */}
          <section className="mb-16">
            <h2 className="text-display-sm font-bold mb-2">공기청정기 — 본문 맥락 삽입</h2>
            <p className="text-body-sm text-foreground/50 mb-8">
              3가지 각도 (컴팩트·아이방·초저소음)
            </p>
            <div className={showMobile ? "mx-auto max-w-[390px]" : ""}>
              <MockArticle
                title="【비교】거실 공기청정기 1대 vs 아이방 전용 공기청정기 — 미세먼지 차단 효율 비교"
                content={MOCK_AIR_CONTENT}
                adVariants={["air-compact", "air-baby", "air-silent"]}
              />
            </div>
          </section>

          <hr className="border-border my-12" />

          {/* Section 3: 사이드바형 전체 비교 */}
          <section className="mb-16">
            <h2 className="text-display-sm font-bold mb-2">사이드바 배너형 — 6종 비교</h2>
            <p className="text-body-sm text-foreground/50 mb-8">
              ArticleTableOfContents 아래 또는 sticky 사이드바에 배치
            </p>
            <div
              className={`grid gap-4 ${
                showMobile
                  ? "mx-auto max-w-[390px] grid-cols-1"
                  : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              } max-w-4xl`}
            >
              {ALL_VARIANTS.map((variant) => (
                <NativeAdCard key={variant} variant={variant} placement="sidebar" />
              ))}
            </div>
          </section>

          <hr className="border-border my-12" />

          {/* Section 4: 모바일 강제 시뮬레이션 (390px 고정) */}
          <section className="mb-16">
            <h2 className="text-display-sm font-bold mb-2">모바일 시뮬레이션 (390px 고정)</h2>
            <p className="text-body-sm text-foreground/50 mb-8">
              iPhone 14 Pro 기준. CTA 터치 영역 48px 이상, 숫자 가독성, 카드 전체 클릭 범위 확인
            </p>
            <div className="mx-auto w-[390px] rounded-[36px] border-[10px] border-foreground/80 bg-background p-3 shadow-card-lg">
              <div className="h-[600px] overflow-y-auto rounded-[24px] bg-background p-4">
                <div className="space-y-6">
                  <NativeAdCard variant="humidifier-safe" placement="inline" />
                  <NativeAdCard variant="air-baby" placement="inline" />
                  <div className="grid grid-cols-1 gap-3">
                    <NativeAdCard variant="humidifier-review" placement="sidebar" />
                    <NativeAdCard variant="air-compact" placement="sidebar" />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
