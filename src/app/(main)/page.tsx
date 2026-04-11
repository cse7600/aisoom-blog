import type { Metadata } from "next";
import {
  getFeaturedPosts,
  getRecentPosts,
  getCategories,
  getPostCountsByCategory,
  getPublishedPostCount,
} from "@/lib/db";
import { FeaturedPostCard } from "@/components/content/FeaturedPostCard";
import { PostCard } from "@/components/content/PostCard";
import { CategoryNavBar } from "@/components/content/CategoryNavBar";
import SubscribeForm from "@/components/newsletter/SubscribeForm";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildWebSiteJsonLd, buildOrganizationJsonLd } from "@/lib/seo";
import { SITE_CONFIG, SEO_DEFAULTS } from "@/lib/constants";
import Link from "next/link";

export const revalidate = 60;

export const metadata: Metadata = {
  title: SEO_DEFAULTS.defaultTitle,
  description: SEO_DEFAULTS.defaultDescription,
  alternates: { canonical: SITE_CONFIG.url },
  openGraph: {
    type: "website",
    url: SITE_CONFIG.url,
    title: SEO_DEFAULTS.defaultTitle,
    description: SEO_DEFAULTS.defaultDescription,
    siteName: SITE_CONFIG.name,
  },
};

export default async function HomePage() {
  const [featured, recent, categories, counts, totalCount] = await Promise.all([
    getFeaturedPosts(1),
    getRecentPosts(8),
    getCategories(),
    getPostCountsByCategory(),
    getPublishedPostCount(),
  ]);

  const featuredPost = featured[0];
  const categoryMap = Object.fromEntries(categories.map((c) => [c.slug, c.name]));
  const websiteJsonLd = buildWebSiteJsonLd();
  const organizationJsonLd = buildOrganizationJsonLd();

  return (
    <>
      <JsonLd structuredData={websiteJsonLd} />
      <JsonLd structuredData={organizationJsonLd} />

      {/* 히어로 섹션 — 사이트 H1은 항상 존재 (SEO) */}
      <section className="pt-10 md:pt-14 pb-4 md:pb-6">
        <div className="mx-auto max-w-content px-4 sm:px-6 text-center">
          <h1 className="sr-only">{SITE_CONFIG.name} — {SITE_CONFIG.tagline}</h1>
          <p className="text-display-sm md:text-display-md font-bold text-foreground mb-3">
            사기 전에 한 번, {SITE_CONFIG.name}
          </p>
          <p className="text-body-md md:text-body-lg text-foreground/60 max-w-narrow mx-auto">
            직접 비교하고 테스트한 것만. 광고 없이, 뻔한 추천 없이.
          </p>
        </div>
      </section>

      {featuredPost && (
        <section className="py-6 md:py-10" aria-label="오늘의 추천 글">
          <div className="mx-auto max-w-content px-4 sm:px-6">
            <FeaturedPostCard
              post={featuredPost}
              categoryName={categoryMap[featuredPost.category]}
            />
          </div>
        </section>
      )}

      {/* 카테고리 네비게이션 바 */}
      {categories.length > 0 && (
        <CategoryNavBar
          categories={categories}
          counts={counts}
          totalCount={totalCount}
        />
      )}

      {/* 최신 글 그리드 */}
      {recent.length > 0 && (
        <section className="py-10 md:py-14">
          <div className="mx-auto max-w-content px-4 sm:px-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-heading-lg font-bold text-foreground">최신 글</h2>
              <Link
                href="/posts"
                className="text-body-sm font-medium text-primary hover:text-primary-hover transition-colors"
              >
                전체보기 →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {recent.map((post, i) => (
                <PostCard
                  key={post.id}
                  post={post}
                  categoryName={categoryMap[post.category]}
                  priority={i < 2}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 카테고리 둘러보기 */}
      {categories.length > 0 && (
        <section className="py-10 md:py-14 bg-surface-2">
          <div className="mx-auto max-w-content px-4 sm:px-6">
            <h2 className="text-heading-lg font-bold text-foreground mb-6">카테고리</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/${cat.slug}`}
                  className="group flex flex-col items-center justify-center p-5 bg-surface-1 border border-border rounded-card shadow-card-sm hover:shadow-card-md hover:border-primary/30 transition-all text-center"
                >
                  <span className="text-heading-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    {cat.name}
                  </span>
                  {cat.description && (
                    <span className="text-caption text-foreground/40 mt-1 line-clamp-2">
                      {cat.description}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 뉴스레터 구독 */}
      <section className="py-14">
        <div className="mx-auto max-w-content px-4 sm:px-6">
          <div className="max-w-xl mx-auto">
            <SubscribeForm variant="card" source="homepage" />
          </div>
        </div>
      </section>
    </>
  );
}
