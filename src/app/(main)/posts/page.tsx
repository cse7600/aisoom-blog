import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  getCategories,
  getPostCountsByCategory,
  getPublishedPostCount,
  getRecentPosts,
} from "@/lib/db";
import { PostCard } from "@/components/content/PostCard";
import { CategoryNavBar } from "@/components/content/CategoryNavBar";
import { Breadcrumb } from "@/components/seo/Breadcrumb";
import { JsonLd } from "@/components/seo/JsonLd";
import { SITE_CONFIG } from "@/lib/constants";

export const revalidate = 60;

const PAGE_SIZE = 20;

export const metadata: Metadata = {
  title: "전체 글 목록 - 정확한 정보, 팩트노트",
  description:
    "팩트노트에 발행된 모든 글을 최신순으로 확인하세요. CCTV·법인설립·전자책·식자재 등 카테고리별 비교·검증 콘텐츠를 한 곳에서.",
  alternates: { canonical: `${SITE_CONFIG.url}/posts` },
  openGraph: {
    type: "website",
    title: `전체 글 목록 | ${SITE_CONFIG.name}`,
    description: "팩트노트 발행 콘텐츠 전체 목록. 최신순 정렬.",
    url: `${SITE_CONFIG.url}/posts`,
    siteName: SITE_CONFIG.name,
  },
};

interface AllPostsPageProps {
  searchParams: { page?: string };
}

function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "1", 10);
  if (Number.isNaN(n) || n < 1) return 1;
  return n;
}

export default async function AllPostsPage({ searchParams }: AllPostsPageProps) {
  const currentPage = parsePage(searchParams.page);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const [totalCount, categories, counts, posts] = await Promise.all([
    getPublishedPostCount(),
    getCategories(),
    getPostCountsByCategory(),
    getRecentPosts(PAGE_SIZE, offset),
  ]);

  const categoryMap = Object.fromEntries(categories.map((c) => [c.slug, c.name]));
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "전체 글 목록",
    description: "팩트노트 발행 콘텐츠 전체 목록",
    url: `${SITE_CONFIG.url}/posts`,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_CONFIG.name,
      url: SITE_CONFIG.url,
    },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: totalCount,
      itemListElement: posts.map((post, idx) => ({
        "@type": "ListItem",
        position: offset + idx + 1,
        url: `${SITE_CONFIG.url}/${post.category}/${post.slug}`,
        name: post.title,
      })),
    },
  };

  return (
    <>
      <JsonLd structuredData={collectionJsonLd} />

      <CategoryNavBar
        categories={categories}
        counts={counts}
        totalCount={totalCount}
        activeSlug="all"
      />

      <div className="mx-auto max-w-content px-4 sm:px-6 py-8">
        <Breadcrumb items={[{ name: "전체 글 목록", url: "/posts" }]} />

        <header className="mb-8">
          <h1 className="text-display-sm md:text-display-md font-bold text-foreground mb-2">
            전체 글 목록
          </h1>
          <p className="text-body-md text-foreground/60">
            지금까지 발행된 <strong className="text-foreground">{totalCount}</strong>개의 글.
            광고 없이, 뻔한 추천 없이.
          </p>
        </header>

        {posts.length === 0 ? (
          <p className="text-body-md text-foreground/40 py-16 text-center">
            곧 찐 비교, 찐 추천이 시작됩니다.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {posts.map((post, i) => (
                <PostCard
                  key={post.id}
                  post={post}
                  categoryName={categoryMap[post.category]}
                  priority={i < 3}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <nav
                aria-label="페이지 이동"
                className="mt-12 flex items-center justify-between gap-4"
              >
                <PaginationLink
                  href={hasPrev ? `/posts?page=${currentPage - 1}` : null}
                  direction="prev"
                />
                <p className="text-body-sm text-foreground/60">
                  {currentPage} / {totalPages} 페이지
                </p>
                <PaginationLink
                  href={hasNext ? `/posts?page=${currentPage + 1}` : null}
                  direction="next"
                />
              </nav>
            )}
          </>
        )}
      </div>
    </>
  );
}

function PaginationLink({
  href,
  direction,
}: {
  href: string | null;
  direction: "prev" | "next";
}) {
  const label = direction === "prev" ? "이전" : "다음";
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  const baseClass =
    "inline-flex items-center gap-1.5 px-4 py-2 text-body-sm font-medium rounded-button border transition-all";

  if (!href) {
    return (
      <span
        className={`${baseClass} border-border text-foreground/30 cursor-not-allowed`}
        aria-disabled="true"
      >
        {direction === "prev" && <Icon className="w-4 h-4" />}
        {label}
        {direction === "next" && <Icon className="w-4 h-4" />}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={`${baseClass} border-border text-foreground hover:border-primary hover:text-primary`}
    >
      {direction === "prev" && <Icon className="w-4 h-4" />}
      {label}
      {direction === "next" && <Icon className="w-4 h-4" />}
    </Link>
  );
}
