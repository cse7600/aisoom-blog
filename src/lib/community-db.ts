/**
 * Phase 9.0 소통 커뮤니티 DB 쿼리 함수
 * 모든 쓰기는 service_role 클라이언트 사용
 */

import { createServiceClient } from "./supabase";
import type {
  CommunityPostRow,
  CommunityPostPublic,
  CommunityCommentRow,
  CommunityCommentPublic,
  CommunityCommentThread,
  CommunityListFilter,
  CommunityListResult,
  CommunityPostDetail,
  InsertCommunityPostParams,
  InsertCommunityCommentParams,
  CommunityCategorySlug,
} from "./community-types";

const POST_PUBLIC_COLUMNS =
  "id,category,title,content,nickname,view_count,comment_count,like_count,bookmark_count,is_hot,is_ai_generated,persona_id,image_url,created_at,updated_at";

const COMMENT_PUBLIC_COLUMNS =
  "id,post_id,parent_id,nickname,content,is_ai_generated,persona_id,created_at";

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 60;

// ─── 목록 ─────────────────────────────────────────────────────────────────

export async function listCommunityPosts(
  filter: CommunityListFilter = {}
): Promise<CommunityListResult> {
  const db = createServiceClient();
  const pageSize = clampPageSize(filter.pageSize);
  const page = Math.max(1, filter.page ?? 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = db
    .from("community_posts")
    .select(POST_PUBLIC_COLUMNS, { count: "exact" });

  if (filter.category && filter.category !== "all") {
    query = query.eq("category", filter.category);
  }
  if (filter.search && filter.search.trim()) {
    query = query.ilike("title", `%${filter.search.trim()}%`);
  }

  const sort = filter.sort ?? "recent";
  if (sort === "popular") {
    query = query
      .order("view_count", { ascending: false })
      .order("created_at", { ascending: false });
  } else if (sort === "comments") {
    query = query
      .order("comment_count", { ascending: false })
      .order("created_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, count, error } = await query.range(from, to);
  if (error) {
    console.error("[community-db] listCommunityPosts:", error.message);
    return { posts: [], total: 0, page, pageSize };
  }
  return {
    posts: (data ?? []) as CommunityPostPublic[],
    total: count ?? 0,
    page,
    pageSize,
  };
}

function clampPageSize(value: number | undefined): number {
  if (!value || value <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(value, MAX_PAGE_SIZE);
}

// ─── 상세 ─────────────────────────────────────────────────────────────────

export async function getCommunityPostById(
  postId: string
): Promise<CommunityPostPublic | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("community_posts")
    .select(POST_PUBLIC_COLUMNS)
    .eq("id", postId)
    .maybeSingle();

  if (error) {
    console.error("[community-db] getCommunityPostById:", error.message);
    return null;
  }
  return (data as CommunityPostPublic) ?? null;
}

export async function getCommunityPostDetail(
  postId: string
): Promise<CommunityPostDetail | null> {
  const post = await getCommunityPostById(postId);
  if (!post) return null;
  const comments = await listCommunityComments(postId);
  return { post, comments };
}

export async function incrementCommunityPostView(
  postId: string
): Promise<void> {
  const db = createServiceClient();
  const { data } = await db
    .from("community_posts")
    .select("view_count")
    .eq("id", postId)
    .maybeSingle();
  const current = Number((data as { view_count?: number } | null)?.view_count ?? 0);
  const { error } = await db
    .from("community_posts")
    .update({ view_count: current + 1 })
    .eq("id", postId);
  if (error) {
    console.error("[community-db] incrementCommunityPostView:", error.message);
  }
}

export async function incrementCommunityPostLike(postId: string): Promise<void> {
  const db = createServiceClient();
  const { data } = await db
    .from("community_posts")
    .select("like_count")
    .eq("id", postId)
    .maybeSingle();
  const current = Number((data as { like_count?: number } | null)?.like_count ?? 0);
  const { error } = await db
    .from("community_posts")
    .update({ like_count: current + 1 })
    .eq("id", postId);
  if (error) {
    console.error("[community-db] incrementCommunityPostLike:", error.message);
  }
}

export async function incrementCommunityPostBookmark(postId: string): Promise<void> {
  const db = createServiceClient();
  const { data } = await db
    .from("community_posts")
    .select("bookmark_count")
    .eq("id", postId)
    .maybeSingle();
  const current = Number((data as { bookmark_count?: number } | null)?.bookmark_count ?? 0);
  const { error } = await db
    .from("community_posts")
    .update({ bookmark_count: current + 1 })
    .eq("id", postId);
  if (error) {
    console.error("[community-db] incrementCommunityPostBookmark:", error.message);
  }
}

// ─── 댓글 ─────────────────────────────────────────────────────────────────

export async function listCommunityComments(
  postId: string
): Promise<CommunityCommentThread[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("community_comments")
    .select(COMMENT_PUBLIC_COLUMNS)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[community-db] listCommunityComments:", error.message);
    return [];
  }
  return buildCommentTree((data ?? []) as CommunityCommentPublic[]);
}

function buildCommentTree(
  rows: CommunityCommentPublic[]
): CommunityCommentThread[] {
  const parents: CommunityCommentThread[] = [];
  const childMap = new Map<string, CommunityCommentPublic[]>();

  for (const row of rows) {
    if (row.parent_id) {
      const bucket = childMap.get(row.parent_id) ?? [];
      bucket.push(row);
      childMap.set(row.parent_id, bucket);
    } else {
      parents.push({ ...row, replies: [] });
    }
  }
  for (const parent of parents) {
    parent.replies = childMap.get(parent.id) ?? [];
  }
  return parents;
}

// ─── 쓰기 ─────────────────────────────────────────────────────────────────

export async function insertCommunityPost(
  params: InsertCommunityPostParams
): Promise<CommunityPostRow | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("community_posts")
    .insert({
      category: params.category,
      title: params.title,
      content: params.content,
      nickname: params.nickname,
      password_hash: params.password_hash,
      ip_hash: params.ip_hash,
      image_url: params.image_url ?? null,
      is_ai_generated: params.is_ai_generated ?? false,
      persona_id: params.persona_id ?? null,
      created_at: params.created_at ?? new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    console.error("[community-db] insertCommunityPost:", error.message);
    return null;
  }
  return data as CommunityPostRow;
}

export async function updateCommunityPost(
  postId: string,
  patch: {
    title?: string;
    content?: string;
    category?: CommunityCategorySlug;
    image_url?: string | null;
  }
): Promise<boolean> {
  const db = createServiceClient();
  const { error } = await db
    .from("community_posts")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", postId);
  if (error) {
    console.error("[community-db] updateCommunityPost:", error.message);
    return false;
  }
  return true;
}

export async function deleteCommunityPost(postId: string): Promise<boolean> {
  const db = createServiceClient();
  const { error } = await db
    .from("community_posts")
    .delete()
    .eq("id", postId);
  if (error) {
    console.error("[community-db] deleteCommunityPost:", error.message);
    return false;
  }
  return true;
}

export async function getCommunityPostHash(
  postId: string
): Promise<{ password_hash: string } | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("community_posts")
    .select("password_hash")
    .eq("id", postId)
    .maybeSingle();
  if (error || !data) return null;
  return data as { password_hash: string };
}

export async function insertCommunityComment(
  params: InsertCommunityCommentParams
): Promise<CommunityCommentRow | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("community_comments")
    .insert({
      post_id: params.post_id,
      parent_id: params.parent_id,
      nickname: params.nickname,
      password_hash: params.password_hash,
      content: params.content,
      ip_hash: params.ip_hash,
      is_ai_generated: params.is_ai_generated ?? false,
      persona_id: params.persona_id ?? null,
      created_at: params.created_at ?? new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) {
    console.error("[community-db] insertCommunityComment:", error.message);
    return null;
  }
  return data as CommunityCommentRow;
}

export async function deleteCommunityComment(
  commentId: string
): Promise<boolean> {
  const db = createServiceClient();
  const { error } = await db
    .from("community_comments")
    .delete()
    .eq("id", commentId);
  if (error) {
    console.error("[community-db] deleteCommunityComment:", error.message);
    return false;
  }
  return true;
}

export async function getCommunityCommentHash(
  commentId: string
): Promise<{ password_hash: string; post_id: string } | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("community_comments")
    .select("password_hash,post_id")
    .eq("id", commentId)
    .maybeSingle();
  if (error || !data) return null;
  return data as { password_hash: string; post_id: string };
}
