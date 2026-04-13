import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPostBySlug, getRelatedPosts, getCategoryBySlug, incrementViewCount } from "@/lib/db";
import { Breadcrumb } from "@/components/seo/Breadcrumb";
import { ShareButtons } from "@/components/content/ShareButtons";
import { FloatingShareBar } from "@/components/content/FloatingShareBar";
import { ArticleTableOfContents } from "@/components/content/ArticleTableOfContents";
import { InlineTableOfContents } from "@/components/content/InlineTableOfContents";
import { RelatedPostsSection } from "@/components/content/RelatedPostsSection";
import { DiscussionSection } from "@/components/discussion/DiscussionSection";
import { DiscussionSkeleton } from "@/components/discussion/DiscussionSkeleton";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  generatePostMetadata,
  buildArticleJsonLd,
  buildFaqJsonLd,
  extractFaqFromHtml,
} from "@/lib/seo";
import { SITE_CONFIG } from "@/lib/constants";
import { formatDate, calculateReadingTime } from "@/lib/utils";
import Image from "next/image";

interface PostPageProps {
  params: { category: string; slug: string };
}

export const revalidate = 300;

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const post = await getPostBySlug(params.slug);
  if (!post || post.category !== params.category) return {};
  return generatePostMetadata({
    title: post.title,
    description: post.description ?? "",
    slug: post.slug,
    category: post.category,
    imageUrl: post.image_url ?? undefined,
    publishedAt: post.published_at ?? post.created_at,
    updatedAt: post.updated_at,
    keywords: post.keywords,
    author: post.author,
  });
}

export default async function PostPage({ params }: PostPageProps) {
  const post = await getPostBySlug(params.slug);
  if (!post || post.category !== params.category) notFound();

  const [related, cat] = await Promise.all([
    getRelatedPosts(post.slug, post.category, 3),
    getCategoryBySlug(post.category),
  ]);

  void incrementViewCount(post.slug);

  const readTime = post.read_time ?? (post.content ? calculateReadingTime(post.content) : null);
  const postUrl = `${SITE_CONFIG.url}/${post.category}/${post.slug}`;
  // 페이지 헤더에 <h1>이 이미 존재하므로 본문 H1 태그를 H2로 변환
  const contentHtml = (post.content ?? "")
    .replace(/<h1(\s[^>]*)?>/gi, "<h2$1>")
    .replace(/<\/h1>/gi, "</h2>");
  const plainTextLength = contentHtml.replace(/<[^>]+>/g, "").length;
  const authorProfileUrl = post.author
    ? `${SITE_CONFIG.url}/community/users/${encodeURIComponent(post.author)}`
    : undefined;

  const articleJsonLd = buildArticleJsonLd({
    title: post.title,
    description: post.description ?? "",
    imageUrl: post.image_url ?? SITE_CONFIG.ogImage,
    publishedAt: post.published_at ?? post.created_at,
    updatedAt: post.updated_at,
    author: post.author,
    authorUrl: authorProfileUrl,
    url: postUrl,
    wordCount: plainTextLength > 0 ? plainTextLength : undefined,
    keywords: post.keywords ?? undefined,
    categoryName: cat?.name,
  });

  const faqItems = extractFaqFromHtml(contentHtml);
  const faqJsonLd = faqItems.length >= 2 ? buildFaqJsonLd(faqItems) : null;

  return (
    <>
      <JsonLd structuredData={articleJsonLd} />
      {faqJsonLd && <JsonLd structuredData={faqJsonLd} />}

      <FloatingShareBar
        url={postUrl}
        title={post.title}
        description={post.description ?? ""}
        imageUrl={post.image_url ?? undefined}
      />

      <div className="mx-auto max-w-content px-4 sm:px-6 py-8">
        <Breadcrumb
          items={[
            { name: cat?.name ?? post.category, url: `/${post.category}` },
            { name: post.title },
          ]}
        />

        {/* 2-column 레이아웃: 본문 + 사이드바 TOC */}
        <div className="flex gap-10 justify-center">

          {/* 메인 콘텐츠 */}
          <article className="max-w-narrow w-full min-w-0">

            {/* 헤더 */}
            <header className="mb-8">
              <span className="inline-block px-2.5 py-1 text-caption font-medium bg-primary text-white rounded-badge mb-4">
                {cat?.name ?? post.category}
              </span>
              <h1 className="text-display-sm md:text-display-md font-bold text-foreground mb-4 text-balance">
                {post.title}
              </h1>
              {post.description && (
                <p className="text-body-lg text-foreground/60 mb-5">{post.description}</p>
              )}
              <div className="flex items-center gap-4 text-body-sm text-foreground/40 pb-6 border-b border-border">
                <span>{post.author}</span>
                <span>{formatDate(post.published_at ?? post.created_at)}</span>
                {readTime && <span>{readTime}분 읽기</span>}
              </div>
            </header>

            {/* 대표 이미지 */}
            {post.image_url && (
              <div className="relative aspect-[16/9] rounded-card overflow-hidden mb-8">
                <Image
                  src={post.image_url}
                  alt={post.title}
                  fill
                  className="object-cover"
                  priority
                  sizes="(max-width: 720px) 100vw, 720px"
                />
              </div>
            )}

            {/* 모바일 인라인 목차 */}
            {contentHtml && (
              <InlineTableOfContents contentHtml={contentHtml} />
            )}

            {/* 본문 */}
            {contentHtml ? (
              <div
                className="prose-content"
                dangerouslySetInnerHTML={{ __html: contentHtml }}
              />
            ) : (
              <p className="text-body-md text-foreground/40 py-12 text-center">
                콘텐츠 준비 중입니다.
              </p>
            )}

            {/* 공유 */}
            <div className="mt-10 pt-6 border-t border-border">
              <ShareButtons
                url={postUrl}
                title={post.title}
                description={post.description ?? ""}
              />
            </div>
          </article>

          {/* 데스크탑 사이드바 TOC */}
          {contentHtml && (
            <ArticleTableOfContents contentHtml={contentHtml} />
          )}
        </div>

        {/* 토론 (AI 페르소나) */}
        <Suspense fallback={<DiscussionSkeleton />}>
          <DiscussionSection
            postSlug={post.slug}
            postTitle={post.title}
            postUrl={postUrl}
            postPublishedAt={post.published_at ?? post.created_at}
            postUpdatedAt={post.updated_at}
            postAuthor={post.author}
          />
        </Suspense>

        {/* 관련 글 */}
        <div className="max-w-narrow mx-auto">
          <RelatedPostsSection
            posts={related}
            categoryName={cat?.name}
          />
        </div>
      </div>
    </>
  );
}
