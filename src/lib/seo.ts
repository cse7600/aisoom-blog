import type { Metadata } from "next";
import { SITE_CONFIG, SEO_DEFAULTS } from "./constants";
import type { JsonLdArticle, JsonLdBreadcrumb, JsonLdWebSite } from "@/types/seo";

export interface PostMetaInput {
  title: string;
  description: string;
  slug: string;
  category: string;
  imageUrl?: string;
  publishedAt: string;
  updatedAt: string;
  keywords?: string[];
  author?: string;
}

export function generatePostMetadata(post: PostMetaInput): Metadata {
  const title = truncateSeoText(post.title, SEO_DEFAULTS.maxTitleLength);
  const description = truncateSeoText(post.description, SEO_DEFAULTS.maxDescriptionLength);
  const url = `${SITE_CONFIG.url}/${post.category}/${post.slug}`;
  const image = post.imageUrl ?? SITE_CONFIG.ogImage;

  return {
    title,
    description,
    keywords: post.keywords,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title,
      description,
      url,
      siteName: SITE_CONFIG.name,
      images: [{ url: image, width: 1200, height: 630, alt: post.title }],
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export function generateCategoryMetadata(
  categoryName: string,
  categoryDescription: string,
  categorySlug: string
): Metadata {
  const title = `${categoryName} - 찐 비교 & 추천`;
  const url = `${SITE_CONFIG.url}/${categorySlug}`;

  return {
    title,
    description: categoryDescription,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title: `${title} | ${SITE_CONFIG.name}`,
      description: categoryDescription,
      url,
      siteName: SITE_CONFIG.name,
    },
  };
}

export interface ArticleJsonLdInput {
  title: string;
  description: string;
  imageUrl: string;
  publishedAt: string;
  updatedAt: string;
  author: string;
  url: string;
}

export function buildArticleJsonLd(input: ArticleJsonLdInput): JsonLdArticle {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: input.title,
    description: input.description,
    image: input.imageUrl,
    datePublished: input.publishedAt,
    dateModified: input.updatedAt,
    author: { "@type": "Person", name: input.author },
    publisher: {
      "@type": "Organization",
      name: SITE_CONFIG.name,
      logo: { "@type": "ImageObject", url: `${SITE_CONFIG.url}/logo.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": input.url },
  };
}

export function buildBreadcrumbJsonLd(
  items: Array<{ name: string; url?: string }>
): JsonLdBreadcrumb {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((breadcrumbItem, index) => ({
      "@type": "ListItem" as const,
      position: index + 1,
      name: breadcrumbItem.name,
      item: breadcrumbItem.url ? `${SITE_CONFIG.url}${breadcrumbItem.url}` : undefined,
    })),
  };
}

export function buildWebSiteJsonLd(): JsonLdWebSite {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_CONFIG.name,
    url: SITE_CONFIG.url,
    description: SEO_DEFAULTS.defaultDescription,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_CONFIG.url}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

function truncateSeoText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3).trimEnd() + "...";
}
