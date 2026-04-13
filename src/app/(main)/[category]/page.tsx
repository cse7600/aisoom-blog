import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getCategoryBySlug,
  getPostsByCategory,
  getCategories,
  getPostCountsByCategory,
  getPublishedPostCount,
  getTagsByCategory,
} from "@/lib/db";
import { PostCard } from "@/components/content/PostCard";
import { CategoryNavBar } from "@/components/content/CategoryNavBar";
import { Breadcrumb } from "@/components/seo/Breadcrumb";
import { JsonLd } from "@/components/seo/JsonLd";
import { generateCategoryMetadata } from "@/lib/seo";
import { SITE_CONFIG } from "@/lib/constants";

interface CategoryPageProps {
  params: { category: string };
}

export const revalidate = 60;

// 정적 세그먼트(`/posts` 전체보기, `/community` 등)와 충돌 방지용 reserved 슬러그
const RESERVED_SLUGS = new Set(["posts", "community", "preview"]);

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories
    .filter((c) => !RESERVED_SLUGS.has(c.slug))
    .map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const cat = await getCategoryBySlug(params.category);
  if (!cat) return {};
  return generateCategoryMetadata(cat.name, cat.description ?? "", cat.slug);
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const [cat, posts, categories, counts, totalCount, tags] = await Promise.all([
    getCategoryBySlug(params.category),
    getPostsByCategory(params.category, 20),
    getCategories(),
    getPostCountsByCategory(),
    getPublishedPostCount(),
    getTagsByCategory(params.category),
  ]);

  if (!cat) notFound();

  const categoryCount = counts[cat.slug] ?? posts.length;
  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: cat.name,
    description: cat.description ?? "",
    url: `${SITE_CONFIG.url}/${cat.slug}`,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_CONFIG.name,
      url: SITE_CONFIG.url,
    },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: categoryCount,
      itemListElement: posts.map((post, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
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
        activeSlug={cat.slug}
      />

      <div className="mx-auto max-w-content px-4 sm:px-6 py-8">
        <Breadcrumb items={[{ name: cat.name, url: `/${cat.slug}` }]} />

        <header className="mb-8">
          <div className="flex flex-wrap items-baseline gap-3 mb-2">
            <h1 className="text-display-sm md:text-display-md font-bold text-foreground">
              {cat.name}
            </h1>
            <span className="text-body-md text-foreground/50">
              <strong className="text-foreground">{categoryCount}</strong>개의 글
            </span>
          </div>
          {cat.description && (
            <p className="text-body-lg text-foreground/50">{cat.description}</p>
          )}
        </header>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {tags.slice(0, 12).map(({ tag, count }) => (
              <Link
                key={tag}
                href={`/${cat.slug}/tag/${encodeURIComponent(tag)}`}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-body-sm bg-surface-secondary text-foreground/70 hover:text-foreground hover:bg-surface-tertiary transition-colors"
              >
                #{tag}
                <span className="text-foreground/40">{count}</span>
              </Link>
            ))}
          </div>
        )}

        {posts.length === 0 ? (
          <p className="text-body-md text-foreground/40 py-16 text-center">
            곧 찐 비교, 찐 추천이 시작됩니다.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {posts.map((post, i) => (
              <PostCard
                key={post.id}
                post={post}
                categoryName={cat.name}
                priority={i < 3}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
