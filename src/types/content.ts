export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface Author {
  id: string;
  name: string;
  bio: string;
  avatarUrl: string;
}

export interface PostMeta {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  categoryId: string;
  category: Category;
  tags: Tag[];
  author: Author;
  thumbnailUrl: string;
  ogImageUrl: string;
  publishedAt: string;
  updatedAt: string;
  readingTimeMinutes: number;
  viewCount: number;
  isFeatured: boolean;
  seoScore: number;
}

export interface Post extends PostMeta {
  content: string;
  tableOfContents: TableOfContentsItem[];
  relatedPosts: PostMeta[];
  affiliateLinks: AffiliateLink[];
  externalReferences: ExternalReference[];
}

export interface TableOfContentsItem {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface AffiliateLink {
  id: string;
  postId: string;
  label: string;
  url: string;
  platform: AffiliatePlatform;
  productName: string;
  productImage: string;
  price: number | null;
  discountPrice: number | null;
  clickCount: number;
  conversionCount: number;
}

export type AffiliatePlatform =
  | "coupang"
  | "naver"
  | "amazon"
  | "financial"
  | "other";

export interface ExternalReference {
  id: string;
  title: string;
  url: string;
  domain: string;
  description: string;
}

export interface Keyword {
  id: string;
  keyword: string;
  monthlySearchVolume: number;
  competitionScore: number;
  cpcEstimate: number;
  trendDirection: "up" | "down" | "stable";
  source: "google" | "naver" | "both";
  categoryId: string;
  recommendedScore: number;
  createdAt: string;
}

export interface SiteAnalytics {
  totalViews: number;
  totalPosts: number;
  totalAffiliateClicks: number;
  totalConversions: number;
  averageSeoScore: number;
  topCategories: CategoryStats[];
  topPosts: PostMeta[];
}

export interface CategoryStats {
  category: Category;
  postCount: number;
  totalViews: number;
  averageSeoScore: number;
}
