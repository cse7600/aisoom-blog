export interface SeoMeta {
  title: string;
  description: string;
  keywords: string[];
  canonical: string;
  ogImage: string;
  ogType: "article" | "website";
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  section?: string;
  tags?: string[];
}

export interface JsonLdArticle {
  "@context": "https://schema.org";
  "@type": "Article" | "NewsArticle" | "BlogPosting";
  headline: string;
  description: string;
  image: string | string[];
  datePublished: string;
  dateModified: string;
  author: JsonLdAuthor;
  publisher: JsonLdOrganization;
  mainEntityOfPage: {
    "@type": "WebPage";
    "@id": string;
  };
  /** AEO/GEO 강화 필드 */
  inLanguage?: string;
  wordCount?: number;
  articleSection?: string;
  keywords?: string;
  isPartOf?: {
    "@type": "WebSite";
    name: string;
    url: string;
  };
}

export interface JsonLdAuthor {
  "@type": "Person";
  name: string;
  url?: string;
}

export interface JsonLdOrganization {
  "@type": "Organization";
  name: string;
  logo: {
    "@type": "ImageObject";
    url: string;
  };
}

export interface JsonLdBreadcrumb {
  "@context": "https://schema.org";
  "@type": "BreadcrumbList";
  itemListElement: JsonLdBreadcrumbItem[];
}

export interface JsonLdBreadcrumbItem {
  "@type": "ListItem";
  position: number;
  name: string;
  item?: string;
}

export interface JsonLdFaq {
  "@context": "https://schema.org";
  "@type": "FAQPage";
  mainEntity: JsonLdFaqItem[];
}

export interface JsonLdFaqItem {
  "@type": "Question";
  name: string;
  acceptedAnswer: {
    "@type": "Answer";
    text: string;
  };
}

export interface JsonLdWebSite {
  "@context": "https://schema.org";
  "@type": "WebSite";
  name: string;
  url: string;
  description: string;
  potentialAction: {
    "@type": "SearchAction";
    target: {
      "@type": "EntryPoint";
      urlTemplate: string;
    };
    "query-input": string;
  };
}
