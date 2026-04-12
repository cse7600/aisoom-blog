import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import type { CategoryRow } from "@/lib/db";

interface CategoryNavBarProps {
  categories: CategoryRow[];
  counts: Record<string, number>;
  totalCount: number;
  activeSlug?: string | "all";
}

/**
 * 홈/카테고리/전체보기 페이지에서 공용 사용하는 카테고리 네비게이션 바.
 * 첫 항목은 "전체보기" (/posts), 이후 각 카테고리에 포스트 수 표시.
 * 현재 활성 페이지는 primary 색상으로 강조.
 */
export function CategoryNavBar({
  categories,
  counts,
  totalCount,
  activeSlug,
}: CategoryNavBarProps) {
  const isAllActive = activeSlug === "all";

  return (
    <nav
      aria-label="카테고리 네비게이션"
      className="border-y border-border bg-surface-2"
    >
      <div className="mx-auto max-w-content px-4 sm:px-6">
        <ul className="flex items-center gap-1 overflow-x-auto scrollbar-thin py-3">
          <li>
            <Link
              href="/posts"
              aria-current={isAllActive ? "page" : undefined}
              className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 text-body-sm font-medium rounded-full border transition-all min-h-[44px] ${
                isAllActive
                  ? "bg-primary text-white border-primary shadow-card-sm"
                  : "border-border text-foreground/70 hover:text-primary hover:border-primary"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              전체보기
              <span
                className={`text-caption ${
                  isAllActive ? "text-white/80" : "text-foreground/40"
                }`}
              >
                {totalCount}
              </span>
            </Link>
          </li>
          {categories.map((cat) => {
            const isActive = activeSlug === cat.slug;
            const count = counts[cat.slug] ?? 0;
            return (
              <li key={cat.slug}>
                <Link
                  href={`/${cat.slug}`}
                  aria-current={isActive ? "page" : undefined}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 text-body-sm font-medium rounded-full border transition-all min-h-[44px] ${
                    isActive
                      ? "bg-primary text-white border-primary shadow-card-sm"
                      : "border-border text-foreground/70 hover:text-primary hover:border-primary"
                  }`}
                >
                  {cat.name}
                  <span
                    className={`text-caption ${
                      isActive ? "text-white/80" : "text-foreground/40"
                    }`}
                  >
                    {count}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
