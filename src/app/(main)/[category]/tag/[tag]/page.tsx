import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCategoryBySlug,
  getPostsByCategoryAndTag,
  getCategories,
  getPostCountsByCategory,
  getPublishedPostCount,
} from "@/lib/db";
import { PostCard } from "@/components/content/PostCard";
import { CategoryNavBar } from "@/components/content/CategoryNavBar";
import { Breadcrumb } from "@/components/seo/Breadcrumb";
import { JsonLd } from "@/components/seo/JsonLd";
import { SITE_CONFIG } from "@/lib/constants";

interface TagPageProps {
  params: { category: string; tag: string };
}

export const revalidate = 3600;

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const cat = await getCategoryBySlug(params.category);
  if (!cat) return {};
  const decodedTag = decodeURIComponent(params.tag);
  const title = `${decodedTag} — ${cat.name} | ${SITE_CONFIG.name}`;
  const description = `${cat.name} 카테고리의 ${decodedTag} 관련 글 모음. 아이숨 비교 & 검증.`;
  const url = `${SITE_CONFIG.url}/${params.category}/tag/${params.tag}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title,
      description,
      url,
      siteName: SITE_CONFIG.name,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      site: SITE_CONFIG.twitterHandle,
    },
  };
}

export default async function TagPage({ params }: TagPageProps) {
  const decodedTag = decodeURIComponent(params.tag);

  const [cat, posts, categories, counts, totalCount] = await Promise.all([
    getCategoryBySlug(params.category),
    getPostsByCategoryAndTag(params.category, decodedTag, 20),
    getCategories(),
    getPostCountsByCategory(),
    getPublishedPostCount(),
  ]);

  if (!cat) notFound();

  const tagJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${decodedTag} — ${cat.name}`,
    description: `${cat.name} 카테고리의 ${decodedTag} 관련 글 모음`,
    url: `${SITE_CONFIG.url}/${params.category}/tag/${params.tag}`,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_CONFIG.name,
      url: SITE_CONFIG.url,
    },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: posts.length,
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
      <JsonLd structuredData={tagJsonLd} />

      <CategoryNavBar
        categories={categories}
        counts={counts}
        totalCount={totalCount}
        activeSlug={cat.slug}
      />

      <div className="mx-auto max-w-content px-4 sm:px-6 py-8">
        <Breadcrumb
          items={[
            { name: cat.name, url: `/${cat.slug}` },
            { name: decodedTag },
          ]}
        />

        <header className="mb-8">
          <div className="flex flex-wrap items-baseline gap-3 mb-2">
            <h1 className="text-display-sm md:text-display-md font-bold text-foreground">
              {decodedTag}
            </h1>
            <span className="text-body-md text-foreground/50">
              <strong className="text-foreground">{posts.length}</strong>개의 글
            </span>
          </div>
          <p className="text-body-lg text-foreground/50">
            {cat.name} · {decodedTag} 관련 찐 비교 & 추천
          </p>
          <Link
            href={`/${cat.slug}`}
            className="inline-block mt-2 text-body-sm text-foreground/40 hover:text-foreground/70 transition-colors"
          >
            ← {cat.name} 전체 보기
          </Link>
        </header>

        {posts.length === 0 ? (
          <p className="text-body-md text-foreground/40 py-16 text-center">
            이 태그의 글이 아직 없습니다.
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
