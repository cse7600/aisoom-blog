import { getFeaturedPosts, getRecentPosts, getCategories } from "@/lib/db";
import { FeaturedPostCard } from "@/components/content/FeaturedPostCard";
import { PostCard } from "@/components/content/PostCard";
import SubscribeForm from "@/components/newsletter/SubscribeForm";
import Link from "next/link";

export const revalidate = 60;

export default async function HomePage() {
  const [featured, recent, categories] = await Promise.all([
    getFeaturedPosts(1),
    getRecentPosts(8),
    getCategories(),
  ]);

  const featuredPost = featured[0];
  const categoryMap = Object.fromEntries(categories.map((c) => [c.slug, c.name]));

  return (
    <>
      {/* 히어로 섹션 */}
      {featuredPost ? (
        <section className="py-8 md:py-12">
          <div className="mx-auto max-w-content px-4 sm:px-6">
            <FeaturedPostCard
              post={featuredPost}
              categoryName={categoryMap[featuredPost.category]}
            />
          </div>
        </section>
      ) : (
        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-content px-4 sm:px-6 text-center">
            <h1 className="text-display-md md:text-display-lg font-bold text-foreground mb-4">
              구매 전 꼭 확인하세요
            </h1>
            <p className="text-body-lg text-foreground/60 max-w-narrow mx-auto">
              직접 비교하고 테스트한 것만. 광고 없이, 뻔한 추천 없이.
            </p>
          </div>
        </section>
      )}

      {/* 카테고리 바 */}
      {categories.length > 0 && (
        <section className="border-y border-border bg-surface-2">
          <div className="mx-auto max-w-content px-4 sm:px-6">
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin py-3">
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/${cat.slug}`}
                  className="shrink-0 px-4 py-1.5 text-body-sm font-medium rounded-full border border-border text-foreground/60 hover:text-primary hover:border-primary transition-all"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 최신 글 그리드 */}
      {recent.length > 0 && (
        <section className="py-10 md:py-14">
          <div className="mx-auto max-w-content px-4 sm:px-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-heading-lg font-bold text-foreground">최신 글</h2>
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
