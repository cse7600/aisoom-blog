/**
 * 개발용 프리뷰 — 네이티브 광고 컴포넌트 UI 확인
 * /preview/native-ads 에서 접근
 */

"use client";

import { useState } from "react";
import { NativeAdCard, type AdVariant } from "@/components/content/NativeAdCard";
import { Moon, Sun, Smartphone, Monitor } from "lucide-react";

const MOCK_CONTENT = {
  before: `
    <p>개인사업자로 시작해 매출이 늘어나면 자연스럽게 법인 전환을 고민하게 됩니다. 실제로 연 순이익이 8,000만 원을 넘어서는 시점부터 법인세율과 종합소득세율의 역전이 시작됩니다.</p>
    <h2>법인 전환을 고려해야 하는 3가지 신호</h2>
    <p>첫 번째는 매출 증가입니다. 연 매출 5억 원을 넘어서면 부가세 환급, 직원 채용, 복리후생 설계 측면에서 법인이 유리해집니다. 두 번째는 투자 유치입니다. 개인사업자는 지분 구조를 만들기 어렵습니다. 세 번째는 신용 분리입니다. 대표 개인 신용과 사업 신용을 분리해 리스크를 줄일 수 있습니다.</p>
  `,
  middle: `
    <h2>법인 설립 비용은 얼마나 드나요</h2>
    <p>2026년 기준 자본금 1억 원 이하 법인 설립 시 등록면허세 67,500원, 교육세 6,750원, 등기신청 수수료 3,000원이 기본 공과금입니다. 법무사 대행 시 추가로 30~50만 원이 발생합니다.</p>
  `,
  after: `
    <h2>자주 묻는 질문</h2>
    <h3>Q. 법인 전환 후에도 기존 거래처와 계약이 유지되나요?</h3>
    <p>포괄양수도 계약을 활용하면 기존 계약, 직원, 자산을 그대로 법인에 이전할 수 있습니다. 단, 거래처 동의가 필요한 계약은 별도 처리해야 합니다.</p>
    <h3>Q. 법인 설립을 혼자 할 수 있나요?</h3>
    <p>가능합니다. 법원 등기소에 직접 신청하면 공과금만 부담하면 됩니다. 다만 정관 작성, 주주총회 의사록, 등기 신청서 오류 시 보정 명령으로 2~3주 지연이 발생합니다. 법인설립지원센터 같은 온라인 서비스는 체크리스트 방식으로 5영업일 내 완료합니다.</p>
    <h2>정리 — TL;DR</h2>
    <p>연 순이익 8,000만 원 이상이면 법인 전환 검토 시점입니다. 포괄양수도로 공백 없이 전환하고, 등기 실수를 피하려면 전문 서비스를 활용하세요.</p>
  `,
};

const MOCK_CCTV_CONTENT = {
  before: `
    <p>매장 CCTV 설치는 이제 선택이 아닌 필수가 됐습니다. 소상공인 대상 절도 범죄가 2025년 대비 12% 증가했고, 무인 매장 운영이 늘어나면서 원격 감시 수요가 폭증하고 있습니다.</p>
    <h2>업종별 CCTV 구성 가이드</h2>
    <p>카페·편의점 10평 이하: 카운터 1대 + 출입구 1대 + 전체 조망 1대 = 최소 3대. 학원: 복도·교실·출입구 필수 3구간, 음성 녹음 금지. 무인매장: 출입 인증기 + 실내 AI 감지 카메라 + 결제 단말기 앵글이 3점 세트.</p>
  `,
  middle: `
    <h2>CCTV 렌탈 vs 구매, 3년 총비용 비교</h2>
    <p>10평 기준 4대 구성. 구매: 초기 220만 원 + 유지보수 연 10만 원 × 3년 = 250만 원. 렌탈: 월 7만 원 × 36개월 = 252만 원. 3년 총비용은 거의 동일하지만 렌탈은 고장 시 무상 교체·업그레이드 포함.</p>
  `,
  after: `
    <h2>자주 묻는 질문</h2>
    <h3>Q. 직원 동의 없이 CCTV를 설치해도 되나요?</h3>
    <p>매장 보안·안전 목적이면 직원 동의 없이도 설치 가능합니다. 단, 설치 목적·장소·관리책임자를 명시한 안내판을 카메라 근처에 부착해야 합니다. 직원 감시 목적으로 사용하면 개인정보보호법 위반으로 과태료 최대 5,000만 원입니다.</p>
    <h3>Q. 매장 CCTV 영상은 얼마나 보관해야 하나요?</h3>
    <p>법정 의무 보관 기간은 없지만, 분쟁 대비 30일 이상 보관이 권장됩니다. 학원은 아동 안전을 위해 60일 이상 보관하는 것이 표준입니다.</p>
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
          finance
        </span>
        <h1 className="text-display-sm font-bold text-foreground mb-3">{title}</h1>
        <p className="text-body-sm text-foreground/40">
          factnote 편집팀 · 2026년 4월 15일 · 8분 읽기
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
  "corp-cost",
  "corp-time",
  "corp-restart",
  "cctv-theft",
  "cctv-legal",
  "cctv-cost",
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
              고전환 리디자인 — hit-voice 카피 + frontend-architect UI 통합본
            </p>
            <p className="text-body-sm text-amber-700 dark:text-amber-300">
              카드 전체 클릭 가능, heroNumber 대형화, FOMO/손실회피 카피, 모바일 48px+ 터치 타겟.
              robots noindex 적용, 프로덕션 노출되지 않음.
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

          {/* Section 1: 법인설립지원센터 inline ads (본문 맥락) */}
          <section className="mb-16">
            <h2 className="text-display-sm font-bold mb-2">법인설립지원센터 — 본문 맥락 삽입</h2>
            <p className="text-body-sm text-foreground/50 mb-8">
              실제 포스트 중간·섹션 후 삽입. 3가지 각도 (비용·시간·재창업)
            </p>
            <div className={showMobile ? "mx-auto max-w-[390px]" : ""}>
              <MockArticle
                title="【비교】개인사업자 vs 법인사업자, 순이익 얼마부터 법인이 유리한가 (2026년 기준)"
                content={MOCK_CONTENT}
                adVariants={["corp-cost", "corp-time", "corp-restart"]}
              />
            </div>
          </section>

          <hr className="border-border my-12" />

          {/* Section 2: 키퍼메이트 inline ads */}
          <section className="mb-16">
            <h2 className="text-display-sm font-bold mb-2">키퍼메이트(CCTV) — 본문 맥락 삽입</h2>
            <p className="text-body-sm text-foreground/50 mb-8">
              3가지 각도 (도난 손실·법률·비용 효율)
            </p>
            <div className={showMobile ? "mx-auto max-w-[390px]" : ""}>
              <MockArticle
                title="【비교】매장 CCTV 설치비용 vs 렌탈 — 3년 총비용 손익분기 계산"
                content={MOCK_CCTV_CONTENT}
                adVariants={["cctv-theft", "cctv-legal", "cctv-cost"]}
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
                  <NativeAdCard variant="corp-cost" placement="inline" />
                  <NativeAdCard variant="cctv-theft" placement="inline" />
                  <div className="grid grid-cols-1 gap-3">
                    <NativeAdCard variant="corp-time" placement="sidebar" />
                    <NativeAdCard variant="cctv-legal" placement="sidebar" />
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
