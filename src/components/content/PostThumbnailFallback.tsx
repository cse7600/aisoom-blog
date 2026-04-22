import {
  Droplets,
  Wind,
  Baby,
  Home,
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
  humidifier: {
    icon: Droplets,
    bgFrom: "var(--thumb-humidifier-bg-from)",
    bgTo: "var(--thumb-humidifier-bg-to)",
    accent: "var(--thumb-humidifier-accent)",
    ink: "var(--thumb-humidifier-ink)",
    pattern: "var(--thumb-humidifier-pattern)",
  },
  "air-purifier": {
    icon: Wind,
    bgFrom: "var(--thumb-air-purifier-bg-from)",
    bgTo: "var(--thumb-air-purifier-bg-to)",
    accent: "var(--thumb-air-purifier-accent)",
    ink: "var(--thumb-air-purifier-ink)",
    pattern: "var(--thumb-air-purifier-pattern)",
  },
  "baby-care": {
    icon: Baby,
    bgFrom: "var(--thumb-baby-care-bg-from)",
    bgTo: "var(--thumb-baby-care-bg-to)",
    accent: "var(--thumb-baby-care-accent)",
    ink: "var(--thumb-baby-care-ink)",
    pattern: "var(--thumb-baby-care-pattern)",
  },
  lifestyle: {
    icon: Home,
    bgFrom: "var(--thumb-lifestyle-bg-from)",
    bgTo: "var(--thumb-lifestyle-bg-to)",
    accent: "var(--thumb-lifestyle-accent)",
    ink: "var(--thumb-lifestyle-ink)",
    pattern: "var(--thumb-lifestyle-pattern)",
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

const KEYWORD_ICON_OVERRIDES: Array<{ match: RegExp; icon: LucideIcon }> = [
  { match: /가습기|습도|X50V|저온가열|초음파|세균/i, icon: Droplets },
  { match: /공기청정기|HEPA|CADR|필터|먼지/i, icon: Wind },
  { match: /신생아|아기|육아|산후조리원|아이방/i, icon: Baby },
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
