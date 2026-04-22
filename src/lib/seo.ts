import type { Metadata } from "next";
import { SITE_CONFIG, SEO_DEFAULTS } from "./constants";
import type {
  JsonLdArticle,
  JsonLdBreadcrumb,
  JsonLdFaq,
  JsonLdWebSite,
} from "@/types/seo";

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
      site: SITE_CONFIG.twitterHandle,
    },
  };
}

/** 카테고리 슬러그별 SEO 최적화 기본 description — DB 값이 없을 때 fallback */
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  humidifier:
    "초음파·저온가열·가열식 가습기 방식 비교. 세균·위생·전기료 수치 기반 실사용 리뷰. 케어팟 X50V 전문.",
  "air-purifier":
    "HEPA13 필터, CADR, 소음 수치로 공기청정기 비교. 신생아·육아 가정 특화 리뷰.",
  "baby-care":
    "신생아·영유아 방 공기 환경 세팅 가이드. 가습기·공기청정기 배치, 습도 기준, 위생 관리.",
  lifestyle:
    "실내 공기질 관리, 가습기 세척 방법, 겨울철 건조 증상 대처법. 육아 가정 생활 정보.",
};

export function generateCategoryMetadata(
  categoryName: string,
  categoryDescription: string,
  categorySlug: string
): Metadata {
  const title = `${categoryName} - 찐 비교 & 추천`;
  const url = `${SITE_CONFIG.url}/${categorySlug}`;
  const description =
    categoryDescription ||
    CATEGORY_DESCRIPTIONS[categorySlug] ||
    SEO_DEFAULTS.defaultDescription;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title: `${title} | ${SITE_CONFIG.name}`,
      description,
      url,
      siteName: SITE_CONFIG.name,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${SITE_CONFIG.name}`,
      description,
      site: SITE_CONFIG.twitterHandle,
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
  wordCount?: number;
  keywords?: string[];
  categoryName?: string;
  authorUrl?: string;
}

/**
 * BlogPosting JSON-LD — AEO/GEO 최적화를 위해
 * inLanguage, wordCount, articleSection, keywords, isPartOf 포함
 */
export function buildArticleJsonLd(input: ArticleJsonLdInput): JsonLdArticle {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: input.title.slice(0, 110),
    description: input.description,
    image: input.imageUrl,
    datePublished: input.publishedAt,
    dateModified: input.updatedAt,
    inLanguage: SITE_CONFIG.language,
    ...(input.wordCount ? { wordCount: input.wordCount } : {}),
    ...(input.categoryName ? { articleSection: input.categoryName } : {}),
    ...(input.keywords && input.keywords.length > 0
      ? { keywords: input.keywords.join(", ") }
      : {}),
    author: {
      "@type": "Person",
      name: input.author,
      ...(input.authorUrl ? { url: input.authorUrl } : {}),
    },
    publisher: {
      "@type": "Organization",
      name: SITE_CONFIG.name,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_CONFIG.url}/logo.png`,
      },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": input.url },
    isPartOf: {
      "@type": "WebSite",
      name: SITE_CONFIG.name,
      url: SITE_CONFIG.url,
    },
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

/**
 * Organization JSON-LD — E-E-A-T 신호 강화용.
 * publisher 단독 메타보다 별도 Organization 개체로 선언하는 편이 GEO에 유리하다.
 */
export function buildOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_CONFIG.name,
    alternateName: SITE_CONFIG.nameEn,
    url: SITE_CONFIG.url,
    logo: `${SITE_CONFIG.url}/logo.png`,
    description: SEO_DEFAULTS.defaultDescription,
    sameAs: [] as string[],
  } as const;
}

/**
 * FAQPage JSON-LD — AEO(Answer Engine Optimization)의 핵심.
 * Q&A 배열을 그대로 넘기면 schema.org 호환 객체를 생성한다.
 */
export interface FaqItem {
  question: string;
  answer: string;
}

export function buildFaqJsonLd(items: FaqItem[]): JsonLdFaq {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: entry.answer,
      },
    })),
  };
}

/**
 * HowTo JSON-LD — 구매 가이드·비교 체크리스트 류 콘텐츠에 적합.
 * 단계별 name/text를 넘기면 HowToStep 배열을 자동 생성.
 */
export interface HowToStep {
  name: string;
  text: string;
  url?: string;
}

export function buildHowToJsonLd(params: {
  name: string;
  description: string;
  steps: HowToStep[];
  totalTime?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: params.name,
    description: params.description,
    ...(params.totalTime ? { totalTime: params.totalTime } : {}),
    step: params.steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
      ...(step.url ? { url: step.url } : {}),
    })),
  } as const;
}

/**
 * HTML 본문에서 FAQ 섹션을 자동 추출한다.
 * h2/h3이 "자주 묻는 질문", "FAQ", "Q&A" 등을 포함하는 경우
 * 그 하위의 strong/b/h4 질문 + 이어지는 텍스트를 Q/A 쌍으로 파싱.
 * 실패 시 빈 배열을 반환하므로 FAQ가 없는 포스트에도 안전하다.
 */
export function extractFaqFromHtml(html: string): FaqItem[] {
  if (!html) return [];

  // FAQ 섹션 위치 탐지
  const faqHeadingMatch = html.match(
    /<h[2-4][^>]*>[^<]*(?:자주\s*묻는\s*질문|FAQ|Q\s*&\s*A|자주하는\s*질문|Q&A)[^<]*<\/h[2-4]>/i
  );
  if (!faqHeadingMatch) return [];

  const startIdx = (faqHeadingMatch.index ?? 0) + faqHeadingMatch[0].length;
  const afterFaq = html.slice(startIdx);

  // 다음 h2/h1을 종료 경계로 삼는다
  const nextHeading = afterFaq.search(/<h[12][\s>]/i);
  const faqBody = nextHeading === -1 ? afterFaq : afterFaq.slice(0, nextHeading);

  // 패턴 1: <h3>/<h4> 질문 + 다음 <p> 답변
  const pairs: FaqItem[] = [];
  const headingRegex = /<h[3-5][^>]*>([\s\S]*?)<\/h[3-5]>\s*([\s\S]*?)(?=<h[3-5]|$)/gi;
  let headingMatch: RegExpExecArray | null;
  while ((headingMatch = headingRegex.exec(faqBody)) !== null) {
    const rawQuestion = headingMatch[1] ?? "";
    const rawAnswer = headingMatch[2] ?? "";
    const question = stripHtml(rawQuestion).trim();
    const answer = stripHtml(rawAnswer).trim();
    if (question.length > 0 && answer.length > 0) {
      pairs.push({ question, answer });
    }
  }

  if (pairs.length > 0) return pairs;

  // 패턴 2: Q. / A. 텍스트 페어
  const qaRegex = /Q[.:\s]+([^\n]+?)\s*A[.:\s]+([^\n]+?)(?=Q[.:\s]|$)/gi;
  const plain = stripHtml(faqBody);
  let qaMatch: RegExpExecArray | null;
  while ((qaMatch = qaRegex.exec(plain)) !== null) {
    const rawQ = qaMatch[1] ?? "";
    const rawA = qaMatch[2] ?? "";
    pairs.push({
      question: rawQ.trim(),
      answer: rawA.trim(),
    });
  }

  return pairs;
}

function stripHtml(raw: string): string {
  return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function truncateSeoText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3).trimEnd() + "...";
}
