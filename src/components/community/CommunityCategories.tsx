"use client";

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import { COMMUNITY_CATEGORIES } from "@/lib/community-types";

interface CommunityCategoriesProps {
  totalCount?: number;
}

export function CommunityCategories({ totalCount }: CommunityCategoriesProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const currentCategory = searchParams?.get("cat") ?? "all";
  const currentSort = searchParams?.get("sort") ?? "recent";

  return (
    <div className="community-categories">
      <nav className="community-categories__tabs" aria-label="카테고리">
        {COMMUNITY_CATEGORIES.map((category) => {
          const active = currentCategory === category.slug;
          const href = buildCategoryHref(pathname, category.slug, currentSort);
          return (
            <Link
              key={category.slug}
              href={href}
              className={
                active
                  ? "community-categories__tab community-categories__tab--active"
                  : "community-categories__tab"
              }
              aria-current={active ? "page" : undefined}
            >
              {category.name}
            </Link>
          );
        })}
      </nav>
      <div className="community-categories__meta">
        {typeof totalCount === "number" && (
          <span className="community-categories__count">
            전체 {totalCount.toLocaleString("ko-KR")}건
          </span>
        )}
        <SortSelect current={currentSort} pathname={pathname ?? "/community"} category={currentCategory} />
      </div>
    </div>
  );
}

function buildCategoryHref(
  pathname: string | null,
  slug: string,
  sort: string
): string {
  const base = pathname ?? "/community";
  const params = new URLSearchParams();
  if (slug !== "all") params.set("cat", slug);
  if (sort !== "recent") params.set("sort", sort);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

interface SortSelectProps {
  current: string;
  pathname: string;
  category: string;
}

function SortSelect({ current, pathname, category }: SortSelectProps) {
  const options: Array<{ value: string; label: string }> = [
    { value: "recent", label: "최신순" },
    { value: "popular", label: "조회순" },
    { value: "comments", label: "댓글순" },
  ];
  return (
    <div className="community-categories__sort" role="group" aria-label="정렬">
      {options.map((option) => {
        const active = option.value === current;
        const params = new URLSearchParams();
        if (category !== "all") params.set("cat", category);
        if (option.value !== "recent") params.set("sort", option.value);
        const href = params.toString() ? `${pathname}?${params.toString()}` : pathname;
        return (
          <Link
            key={option.value}
            href={href}
            className={
              active
                ? "community-categories__sort-item community-categories__sort-item--active"
                : "community-categories__sort-item"
            }
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
