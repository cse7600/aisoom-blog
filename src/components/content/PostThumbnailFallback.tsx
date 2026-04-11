import {
  Camera,
  Building2,
  BookOpen,
  UtensilsCrossed,
  Cpu,
  Wallet,
  Heart,
  Home,
  Plane,
  FileText,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

type ThumbVariant = "card" | "featured";

interface PostThumbnailFallbackProps {
  categorySlug: string;
  categoryName: string;
  title: string;
  tags?: string[];
  keywords?: string[];
  readTime?: number | null;
  variant?: ThumbVariant;
}

interface ThumbStyle {
  icon: LucideIcon;
  bgFrom: string;
  bgTo: string;
  accent: string;
  ink: string;
  pattern: string;
}

const CATEGORY_STYLES: Record<string, ThumbStyle> = {
  tech: {
    icon: Cpu,
    bgFrom: "var(--thumb-tech-bg-from)",
    bgTo: "var(--thumb-tech-bg-to)",
    accent: "var(--thumb-tech-accent)",
    ink: "var(--thumb-tech-ink)",
    pattern: "var(--thumb-tech-pattern)",
  },
  finance: {
    icon: Wallet,
    bgFrom: "var(--thumb-finance-bg-from)",
    bgTo: "var(--thumb-finance-bg-to)",
    accent: "var(--thumb-finance-accent)",
    ink: "var(--thumb-finance-ink)",
    pattern: "var(--thumb-finance-pattern)",
  },
  beauty: {
    icon: Heart,
    bgFrom: "var(--thumb-beauty-bg-from)",
    bgTo: "var(--thumb-beauty-bg-to)",
    accent: "var(--thumb-beauty-accent)",
    ink: "var(--thumb-beauty-ink)",
    pattern: "var(--thumb-beauty-pattern)",
  },
  "home-living": {
    icon: Home,
    bgFrom: "var(--thumb-home-living-bg-from)",
    bgTo: "var(--thumb-home-living-bg-to)",
    accent: "var(--thumb-home-living-accent)",
    ink: "var(--thumb-home-living-ink)",
    pattern: "var(--thumb-home-living-pattern)",
  },
  travel: {
    icon: Plane,
    bgFrom: "var(--thumb-travel-bg-from)",
    bgTo: "var(--thumb-travel-bg-to)",
    accent: "var(--thumb-travel-accent)",
    ink: "var(--thumb-travel-ink)",
    pattern: "var(--thumb-travel-pattern)",
  },
};

const DEFAULT_STYLE: ThumbStyle = {
  icon: FileText,
  bgFrom: "var(--thumb-default-bg-from)",
  bgTo: "var(--thumb-default-bg-to)",
  accent: "var(--thumb-default-accent)",
  ink: "var(--thumb-default-ink)",
  pattern: "var(--thumb-default-pattern)",
};

// 콘텐츠 기반 아이콘 오버라이드 — 제목/태그/키워드에 특정 단어가 있으면 더 구체적인 아이콘 사용
const KEYWORD_ICON_OVERRIDES: Array<{ match: RegExp; icon: LucideIcon }> = [
  { match: /cctv|보안|카메라|감시|매장\s?보안/i, icon: Camera },
  { match: /법인|등기|설립|정관|법인세/i, icon: Building2 },
  { match: /밀리의서재|전자책|독서|책|도서/i, icon: BookOpen },
  { match: /식자재|외식업|식당|레스토랑|음식점|메뉴/i, icon: UtensilsCrossed },
];

function pickIcon(categorySlug: string, title: string, tags: string[], keywords: string[]): LucideIcon {
  const haystack = [title, ...tags, ...keywords].join(" ");
  for (const { match, icon } of KEYWORD_ICON_OVERRIDES) {
    if (match.test(haystack)) return icon;
  }
  return CATEGORY_STYLES[categorySlug]?.icon ?? DEFAULT_STYLE.icon;
}

function getStyle(categorySlug: string): ThumbStyle {
  return CATEGORY_STYLES[categorySlug] ?? DEFAULT_STYLE;
}

export function PostThumbnailFallback({
  categorySlug,
  categoryName,
  title,
  tags = [],
  keywords = [],
  readTime,
  variant = "card",
}: PostThumbnailFallbackProps) {
  const style = getStyle(categorySlug);
  const Icon = pickIcon(categorySlug, title, tags, keywords);

  // 첫 키워드 (콘텐츠 힌트용) — 키워드 > 태그 순
  const hintKeyword = keywords[0] ?? tags[0];

  const iconSize = variant === "featured" ? 72 : 52;
  const titleClamp = variant === "featured" ? "line-clamp-3" : "line-clamp-2";
  const titleSize =
    variant === "featured"
      ? "text-heading-md md:text-heading-lg"
      : "text-body-md";
  const paddingClass = variant === "featured" ? "p-6 md:p-8" : "p-4";

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(135deg, ${style.bgFrom} 0%, ${style.bgTo} 100%)`,
      }}
      aria-hidden="true"
    >
      {/* 도트 그리드 패턴 */}
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage: `radial-gradient(${style.pattern} 1px, transparent 1px)`,
          backgroundSize: "18px 18px",
        }}
      />

      {/* 우상단 장식 원 */}
      <div
        className="absolute -right-10 -top-10 w-40 h-40 rounded-full blur-2xl"
        style={{ backgroundColor: style.pattern }}
      />

      {/* 좌하단 장식 */}
      <div
        className="absolute -left-6 -bottom-6 w-24 h-24 rounded-full blur-xl"
        style={{ backgroundColor: style.pattern }}
      />

      {/* 컨텐츠 레이어 */}
      <div className={`relative h-full flex flex-col justify-between ${paddingClass}`}>
        {/* 상단: 카테고리 뱃지 + 메가 아이콘 */}
        <div className="flex items-start justify-between gap-3">
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 text-caption font-semibold rounded-badge"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.65)",
              color: style.ink,
              backdropFilter: "blur(4px)",
            }}
          >
            <Sparkles className="w-3 h-3" style={{ color: style.accent }} />
            {categoryName}
          </span>
          <Icon
            style={{ color: style.accent }}
            width={iconSize}
            height={iconSize}
            strokeWidth={1.5}
            className="drop-shadow-sm shrink-0"
          />
        </div>

        {/* 하단: 제목 프리뷰 + 메타 */}
        <div className="space-y-2">
          <p
            className={`${titleSize} font-semibold ${titleClamp}`}
            style={{ color: style.ink }}
          >
            {title}
          </p>
          <div
            className="flex items-center gap-2 text-caption font-medium"
            style={{ color: style.accent }}
          >
            {readTime ? <span>{readTime}분 읽기</span> : null}
            {readTime && hintKeyword ? <span aria-hidden="true">·</span> : null}
            {hintKeyword ? (
              <span className="truncate">#{hintKeyword.replace(/\s+/g, "")}</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
