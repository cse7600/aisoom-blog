/**
 * Supabase 쿼리 함수
 * 모든 콘텐츠는 Supabase posts 테이블에서 읽는다
 */

import { createServiceClient } from "./supabase";

// ─── 멀티 테넌트 격리 ──────────────────────────────────────────────────────
// factnote 블로그와 Supabase 인스턴스를 공유하므로 site_id로 필터링한다.
const SITE_ID = (process.env.NEXT_PUBLIC_SITE_ID ?? "carepod").trim();

// ─── DB 행 타입 (Supabase 컬럼 그대로) ──────────────────────────────────────

export interface PostRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  content: string | null;
  category: string;
  tags: string[];
  keywords: string[];
  image_url: string | null;
  author: string;
  status: string;
  featured: boolean;
  view_count: number;
  read_time: number | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  site_id: string;
}

export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
  site_id: string;
}

export interface PostRelationRow {
  post_slug: string;
  related_slug: string;
  relation_type: string;
  sort_order: number;
  site_id: string;
}

// ─── 쿼리 함수 ───────────────────────────────────────────────────────────────

const POST_COLUMNS =
  "id,slug,title,description,category,tags,keywords,image_url,author,status,featured,view_count,read_time,published_at,created_at,updated_at,site_id";

/** 현재 시각 이하의 published_at만 노출 — 미래 예약 포스트 숨김 */
function nowIso() {
  return new Date().toISOString();
}

export async function getFeaturedPosts(limit = 1): Promise<PostRow[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("posts")
    .select(POST_COLUMNS)
    .eq("site_id", SITE_ID)
    .eq("status", "published")
    .lte("published_at", nowIso())
    .eq("featured", true)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[db] getFeaturedPosts:", error.message);
    return [];
  }
  return (data ?? []) as PostRow[];
}

export async function getRecentPosts(limit = 12, offset = 0): Promise<PostRow[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("posts")
    .select(POST_COLUMNS)
    .eq("site_id", SITE_ID)
    .eq("status", "published")
    .lte("published_at", nowIso())
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[db] getRecentPosts:", error.message);
    return [];
  }
  return (data ?? []) as PostRow[];
}

export async function getPostsByCategory(
  categorySlug: string,
  limit = 12,
  offset = 0
): Promise<PostRow[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("posts")
    .select(POST_COLUMNS)
    .eq("site_id", SITE_ID)
    .eq("status", "published")
    .lte("published_at", nowIso())
    .eq("category", categorySlug)
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[db] getPostsByCategory:", error.message);
    return [];
  }
  return (data ?? []) as PostRow[];
}

export async function getPostCountByCategory(categorySlug: string): Promise<number> {
  const db = createServiceClient();
  const { count, error } = await db
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("site_id", SITE_ID)
    .eq("status", "published")
    .lte("published_at", nowIso())
    .eq("category", categorySlug);

  if (error) return 0;
  return count ?? 0;
}

/**
 * 전체 발행 포스트 수
 */
export async function getPublishedPostCount(): Promise<number> {
  const db = createServiceClient();
  const { count, error } = await db
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("site_id", SITE_ID)
    .eq("status", "published")
    .lte("published_at", nowIso());

  if (error) {
    console.error("[db] getPublishedPostCount:", error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * 카테고리별 포스트 수 한 번에 조회 — 전체보기/네비게이션용
 * Returns: { [slug]: count }
 */
export async function getPostCountsByCategory(): Promise<Record<string, number>> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("posts")
    .select("category")
    .eq("site_id", SITE_ID)
    .eq("status", "published")
    .lte("published_at", nowIso());

  if (error) {
    console.error("[db] getPostCountsByCategory:", error.message);
    return {};
  }

  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{ category: string }>) {
    counts[row.category] = (counts[row.category] ?? 0) + 1;
  }
  return counts;
}

export async function getPostBySlug(slug: string): Promise<PostRow | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("posts")
    .select("*")
    .eq("site_id", SITE_ID)
    .eq("status", "published")
    .lte("published_at", nowIso())
    .eq("slug", slug)
    .single();

  if (error) {
    if (error.code !== "PGRST116") {
      console.error("[db] getPostBySlug:", error.message);
    }
    return null;
  }
  return data as PostRow;
}

export async function getRelatedPosts(
  currentSlug: string,
  categorySlug: string,
  limit = 3
): Promise<PostRow[]> {
  const db = createServiceClient();

  // 1순위: post_relations 테이블에서 명시적 관계
  const { data: relations } = await db
    .from("post_relations")
    .select("related_slug")
    .eq("site_id", SITE_ID)
    .eq("post_slug", currentSlug)
    .order("sort_order")
    .limit(limit);

  if (relations && relations.length > 0) {
    const slugs = relations.map((r: { related_slug: string }) => r.related_slug);
    const { data } = await db
      .from("posts")
      .select(POST_COLUMNS)
      .eq("site_id", SITE_ID)
      .eq("status", "published")
      .in("slug", slugs);
    if (data && data.length > 0) return data as PostRow[];
  }

  // 2순위: 같은 카테고리 최신 글
  const { data, error } = await db
    .from("posts")
    .select(POST_COLUMNS)
    .eq("site_id", SITE_ID)
    .eq("status", "published")
    .lte("published_at", nowIso())
    .eq("category", categorySlug)
    .neq("slug", currentSlug)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []) as PostRow[];
}

export async function getCategories(): Promise<CategoryRow[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("categories")
    .select("*")
    .eq("site_id", SITE_ID)
    .eq("active", true)
    .order("sort_order");

  if (error) {
    console.error("[db] getCategories:", error.message);
    return [];
  }
  return (data ?? []) as CategoryRow[];
}

export async function getCategoryBySlug(slug: string): Promise<CategoryRow | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("categories")
    .select("*")
    .eq("site_id", SITE_ID)
    .eq("slug", slug)
    .eq("active", true)
    .single();

  if (error) return null;
  return data as CategoryRow;
}

export async function getAllPublishedSlugs(): Promise<
  { slug: string; category: string; updated_at: string }[]
> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("posts")
    .select("slug,category,updated_at")
    .eq("site_id", SITE_ID)
    .eq("status", "published")
    .lte("published_at", nowIso())
    .order("published_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as { slug: string; category: string; updated_at: string }[];
}

/**
 * 카테고리 + 태그로 필터된 포스트 목록
 */
export async function getPostsByCategoryAndTag(
  categorySlug: string,
  tag: string,
  limit = 20,
  offset = 0
): Promise<PostRow[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("posts")
    .select(POST_COLUMNS)
    .eq("site_id", SITE_ID)
    .eq("status", "published")
    .lte("published_at", nowIso())
    .eq("category", categorySlug)
    .contains("tags", [tag])
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[db] getPostsByCategoryAndTag:", error.message);
    return [];
  }
  return (data ?? []) as PostRow[];
}

/**
 * 카테고리의 태그 목록 + 각 태그별 포스트 수 (상위 20개)
 */
export async function getTagsByCategory(
  categorySlug: string
): Promise<Array<{ tag: string; count: number }>> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("posts")
    .select("tags")
    .eq("site_id", SITE_ID)
    .eq("status", "published")
    .lte("published_at", nowIso())
    .eq("category", categorySlug);

  if (error || !data) return [];

  const tagCount: Record<string, number> = {};
  for (const row of data as { tags: string[] }[]) {
    for (const tag of row.tags ?? []) {
      tagCount[tag] = (tagCount[tag] ?? 0) + 1;
    }
  }

  return Object.entries(tagCount)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

/**
 * 조회수 증가 — fire-and-forget, 에러 무시
 */
export async function incrementViewCount(slug: string): Promise<void> {
  const db = createServiceClient();
  await db.rpc("increment_view_count", { post_slug: slug }).then(
    () => {},
    () => {}
  );
}
