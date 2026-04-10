/**
 * Phase 8.5 토론 시스템 DB 쿼리 함수
 * 모든 쓰기는 service_role 클라이언트 사용
 */

import { createServiceClient } from "./supabase";
import type {
  PersonaRow,
  PersonaBehaviorType,
  PostDiscussionRow,
  DiscussionReplyRow,
  DiscussionWithReplies,
  DiscussionReplyWithPersona,
  InsertDiscussionParams,
  InsertReplyParams,
  PostNeedingDiscussion,
  PersonaHistoryEntry,
  InsertPersonaHistoryParams,
  LongtailTarget,
} from "./discussion-types";

/**
 * Phase 8.8: behavior_type 컬럼이 마이그레이션되기 전 레거시 row 보호.
 * DB에 컬럼이 없거나 null이면 'normal'로 간주한다.
 */
function normalizePersona(row: Record<string, unknown>): PersonaRow {
  const raw = row.behavior_type as string | null | undefined;
  const behavior: PersonaBehaviorType =
    raw === "chatty" || raw === "lurker" || raw === "lol_reactor" ? raw : "normal";
  return { ...(row as unknown as PersonaRow), behavior_type: behavior };
}

function normalizePersonas(rows: unknown[] | null): PersonaRow[] {
  if (!rows) return [];
  return rows.map((row) => normalizePersona(row as Record<string, unknown>));
}

// ─── 조회 ─────────────────────────────────────────────────────────────────

export async function getDiscussionsByPostSlug(
  postSlug: string
): Promise<DiscussionWithReplies[]> {
  const db = createServiceClient();
  const { data: discussions, error } = await db
    .from("post_discussions")
    .select("*, persona:discussion_personas(*)")
    .eq("post_slug", postSlug)
    .eq("published", true)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[discussion-db] getDiscussionsByPostSlug:", error.message);
    return [];
  }
  if (!discussions || discussions.length === 0) return [];

  const replyMap = await loadReplyMap(discussions.map((row) => row.id as string));
  return discussions.map((row) => ({
    ...(row as PostDiscussionRow & { persona: PersonaRow }),
    replies: replyMap.get(row.id as string) ?? [],
  }));
}

async function loadReplyMap(
  discussionIds: string[]
): Promise<Map<string, DiscussionReplyWithPersona[]>> {
  const result = new Map<string, DiscussionReplyWithPersona[]>();
  if (discussionIds.length === 0) return result;

  const db = createServiceClient();
  const { data, error } = await db
    .from("discussion_replies")
    .select("*, persona:discussion_personas(*)")
    .in("discussion_id", discussionIds)
    .eq("published", true)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[discussion-db] loadReplyMap:", error.message);
    return result;
  }
  for (const row of (data ?? []) as DiscussionReplyWithPersona[]) {
    const bucket = result.get(row.discussion_id) ?? [];
    bucket.push(row);
    result.set(row.discussion_id, bucket);
  }
  return result;
}

export async function getDiscussionCount(postSlug: string): Promise<number> {
  const db = createServiceClient();
  const { count, error } = await db
    .from("post_discussions")
    .select("id", { count: "exact", head: true })
    .eq("post_slug", postSlug)
    .eq("published", true);

  if (error) {
    console.error("[discussion-db] getDiscussionCount:", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function getReplyCountForPost(postSlug: string): Promise<number> {
  const db = createServiceClient();
  const { data: discussionIds, error: idError } = await db
    .from("post_discussions")
    .select("id")
    .eq("post_slug", postSlug);

  if (idError || !discussionIds || discussionIds.length === 0) return 0;
  const ids = discussionIds.map((row) => row.id as string);

  const { count, error } = await db
    .from("discussion_replies")
    .select("id", { count: "exact", head: true })
    .in("discussion_id", ids)
    .eq("published", true);

  if (error) return 0;
  return count ?? 0;
}

export async function getPersonaByNickname(
  nickname: string
): Promise<PersonaRow | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("discussion_personas")
    .select("*")
    .eq("nickname", nickname)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    console.error("[discussion-db] getPersonaByNickname:", error.message);
    return null;
  }
  if (!data) return null;
  return normalizePersona(data as Record<string, unknown>);
}

export interface PersonaRecentActivity {
  discussions: PostDiscussionRow[];
  replies: DiscussionReplyRow[];
}

export async function getPersonaRecentActivity(
  personaId: string,
  limit = 20
): Promise<PersonaRecentActivity> {
  const db = createServiceClient();
  const [discussionsResult, repliesResult] = await Promise.all([
    db
      .from("post_discussions")
      .select("*")
      .eq("persona_id", personaId)
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(limit),
    db
      .from("discussion_replies")
      .select("*")
      .eq("persona_id", personaId)
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  if (discussionsResult.error) {
    console.error("[discussion-db] getPersonaRecentActivity(discussions):", discussionsResult.error.message);
  }
  if (repliesResult.error) {
    console.error("[discussion-db] getPersonaRecentActivity(replies):", repliesResult.error.message);
  }
  return {
    discussions: (discussionsResult.data ?? []) as PostDiscussionRow[],
    replies: (repliesResult.data ?? []) as DiscussionReplyRow[],
  };
}

export async function getPersonas(
  onlyActive = true
): Promise<PersonaRow[]> {
  const db = createServiceClient();
  const query = db.from("discussion_personas").select("*").order("nickname");
  const { data, error } = onlyActive
    ? await query.eq("active", true)
    : await query;

  if (error) {
    console.error("[discussion-db] getPersonas:", error.message);
    return [];
  }
  return normalizePersonas(data);
}

// ─── 페르소나 선택 알고리즘 ───────────────────────────────────────────────

export async function selectPersonasForPost(
  postSlug: string,
  count: number
): Promise<PersonaRow[]> {
  const all = await getPersonas(true);
  if (all.length === 0) return [];

  const db = createServiceClient();
  const { data: existing } = await db
    .from("post_discussions")
    .select("persona_id")
    .eq("post_slug", postSlug);

  const usedIds = new Set((existing ?? []).map((row) => row.persona_id as string));
  const available = all.filter((persona) => !usedIds.has(persona.id));
  const pool = available.length >= count ? available : all;

  return pickDiverse(pool, count);
}

function pickDiverse(pool: PersonaRow[], count: number): PersonaRow[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const picked: PersonaRow[] = [];
  const typeCount = new Map<string, number>();

  for (const persona of shuffled) {
    if (picked.length >= count) break;
    const current = typeCount.get(persona.persona_type) ?? 0;
    if (current >= 2) continue;
    picked.push(persona);
    typeCount.set(persona.persona_type, current + 1);
  }

  if (picked.length < count) {
    for (const persona of shuffled) {
      if (picked.length >= count) break;
      if (!picked.some((row) => row.id === persona.id)) picked.push(persona);
    }
  }
  return picked;
}

// ─── 쓰기 ─────────────────────────────────────────────────────────────────

export async function insertDiscussion(
  params: InsertDiscussionParams
): Promise<PostDiscussionRow | null> {
  const db = createServiceClient();
  const charCount = params.char_count ?? Array.from(params.content).length;
  const { data, error } = await db
    .from("post_discussions")
    .insert({
      post_slug: params.post_slug,
      persona_id: params.persona_id,
      content: params.content,
      sentiment: params.sentiment ?? "neutral",
      upvotes: params.upvotes ?? 0,
      is_question: params.is_question ?? false,
      target_keyword: params.target_keyword ?? null,
      generation_batch: params.generation_batch ?? null,
      created_at: params.created_at ?? new Date().toISOString(),
      thread_template: params.thread_template ?? "expert_qa",
      scheduled_generation_at: params.scheduled_generation_at ?? null,
      generation_phase: params.generation_phase ?? "pending",
      longtail_target: params.longtail_target ?? null,
      quality_tier: params.quality_tier ?? "casual",
      char_count: charCount,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[discussion-db] insertDiscussion:", error.message);
    return null;
  }

  await touchPostUpdatedAt(params.post_slug);
  return data as PostDiscussionRow;
}

/**
 * 댓글/대댓글 생성 시 상위 포스트의 updated_at을 갱신해
 * Article JSON-LD의 dateModified가 최신 활동을 반영하도록 한다.
 */
async function touchPostUpdatedAt(postSlug: string): Promise<void> {
  const db = createServiceClient();
  const { error } = await db
    .from("posts")
    .update({ updated_at: new Date().toISOString() })
    .eq("slug", postSlug);

  if (error) {
    console.error("[discussion-db] touchPostUpdatedAt:", error.message);
  }
}

async function touchPostBySlugViaDiscussion(discussionId: string): Promise<void> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("post_discussions")
    .select("post_slug")
    .eq("id", discussionId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[discussion-db] lookup post_slug:", error.message);
    return;
  }
  await touchPostUpdatedAt(data.post_slug as string);
}

export async function insertReply(
  params: InsertReplyParams
): Promise<DiscussionReplyRow | null> {
  const db = createServiceClient();
  const charCount = params.char_count ?? Array.from(params.content).length;
  const { data, error } = await db
    .from("discussion_replies")
    .insert({
      discussion_id: params.discussion_id,
      persona_id: params.persona_id,
      content: params.content,
      sentiment: params.sentiment ?? "neutral",
      upvotes: params.upvotes ?? 0,
      target_keyword: params.target_keyword ?? null,
      generation_batch: params.generation_batch ?? null,
      created_at: params.created_at ?? new Date().toISOString(),
      quality_tier: params.quality_tier ?? "casual",
      char_count: charCount,
      response_model: params.response_model ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[discussion-db] insertReply:", error.message);
    return null;
  }

  await touchPostBySlugViaDiscussion(params.discussion_id);
  return data as DiscussionReplyRow;
}

// ─── 스케줄러용 ───────────────────────────────────────────────────────────

interface PostScanRow {
  slug: string;
  title: string;
  description: string | null;
  content: string | null;
  category: string;
  tags: string[];
  keywords: string[];
  published_at: string | null;
  created_at: string;
}

export async function getPostsNeedingDiscussions(
  limit = 20
): Promise<PostNeedingDiscussion[]> {
  const posts = await fetchRecentPublishedPosts(100);
  if (posts.length === 0) return [];

  const counts = await loadCountsForSlugs(posts.map((row) => row.slug));
  const scored = posts.map((row) => scorePost(row, counts));

  return scored
    .filter((row) => row.priority !== "low" || row.comment_count < 5)
    .sort((a, b) => priorityScore(b.priority) - priorityScore(a.priority))
    .slice(0, limit);
}

async function fetchRecentPublishedPosts(limit: number): Promise<PostScanRow[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("posts")
    .select(
      "slug,title,description,content,category,tags,keywords,published_at,created_at"
    )
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.error("[discussion-db] fetchRecentPublishedPosts:", error?.message);
    return [];
  }
  return data as PostScanRow[];
}

function scorePost(
  row: PostScanRow,
  counts: Map<string, { comments: number; replies: number }>
): PostNeedingDiscussion {
  const publishedAt = row.published_at ?? row.created_at;
  const ageHours = (Date.now() - new Date(publishedAt).getTime()) / (60 * 60 * 1000);
  const counter = counts.get(row.slug) ?? { comments: 0, replies: 0 };
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    content: row.content,
    category: row.category,
    tags: row.tags ?? [],
    keywords: row.keywords ?? [],
    published_at: row.published_at,
    created_at: row.created_at,
    comment_count: counter.comments,
    reply_count: counter.replies,
    priority: computePriority(ageHours, counter.comments, counter.replies),
  };
}

type SlugCountMap = Map<string, { comments: number; replies: number }>;

async function loadCountsForSlugs(slugs: string[]): Promise<SlugCountMap> {
  const result: SlugCountMap = new Map();
  if (slugs.length === 0) return result;

  const discussionToSlug = await accumulateCommentCounts(slugs, result);
  await accumulateReplyCounts(discussionToSlug, result);
  return result;
}

async function accumulateCommentCounts(
  slugs: string[],
  result: SlugCountMap
): Promise<Map<string, string>> {
  const discussionToSlug = new Map<string, string>();
  const db = createServiceClient();
  const { data } = await db
    .from("post_discussions")
    .select("id,post_slug")
    .in("post_slug", slugs);

  for (const row of (data ?? []) as { id: string; post_slug: string }[]) {
    const entry = result.get(row.post_slug) ?? { comments: 0, replies: 0 };
    entry.comments += 1;
    result.set(row.post_slug, entry);
    discussionToSlug.set(row.id, row.post_slug);
  }
  return discussionToSlug;
}

async function accumulateReplyCounts(
  discussionToSlug: Map<string, string>,
  result: SlugCountMap
): Promise<void> {
  const ids = Array.from(discussionToSlug.keys());
  if (ids.length === 0) return;

  const db = createServiceClient();
  const { data } = await db
    .from("discussion_replies")
    .select("discussion_id")
    .in("discussion_id", ids);

  for (const row of (data ?? []) as { discussion_id: string }[]) {
    const slug = discussionToSlug.get(row.discussion_id);
    if (!slug) continue;
    const entry = result.get(slug) ?? { comments: 0, replies: 0 };
    entry.replies += 1;
    result.set(slug, entry);
  }
}

function computePriority(
  ageHours: number,
  commentCount: number,
  replyCount: number
): PostNeedingDiscussion["priority"] {
  if (ageHours >= 6 && commentCount === 0) return "highest";
  if (ageHours >= 24 && commentCount < 2) return "high";
  if (ageHours >= 72 && replyCount === 0 && commentCount >= 1) return "medium";
  if (ageHours >= 168 && commentCount < 5) return "low";
  return "low";
}

function priorityScore(priority: PostNeedingDiscussion["priority"]): number {
  switch (priority) {
    case "highest":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}

export interface UpsertGenerationLogParams {
  batch_id: string;
  post_slug: string;
  persona_ids: string[];
  status: "pending" | "completed" | "failed";
  comments_count?: number;
  replies_count?: number;
  keywords_used?: string[];
  model_used?: string;
  prompt_version?: string;
  error_message?: string | null;
  completed_at?: string | null;
}

// ─── 일일 URL 카운트 ──────────────────────────────────────────────────────────

export async function getTodayUrlCount(): Promise<number> {
  const db = createServiceClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count, error } = await db
    .from("post_discussions")
    .select("id", { count: "exact", head: true })
    .gte("created_at", todayStart.toISOString());

  if (error) {
    console.error("[discussion-db] getTodayUrlCount:", error.message);
    return 0;
  }
  return count ?? 0;
}

// ─── 페르소나 히스토리 ────────────────────────────────────────────────────────

export async function getPersonaRecentHistory(
  personaId: string,
  limit = 5
): Promise<PersonaHistoryEntry[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("persona_history")
    .select("*")
    .eq("persona_id", personaId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[discussion-db] getPersonaRecentHistory:", error.message);
    return [];
  }
  return (data ?? []) as PersonaHistoryEntry[];
}

export async function insertPersonaHistory(
  params: InsertPersonaHistoryParams
): Promise<void> {
  const db = createServiceClient();
  const { error } = await db.from("persona_history").insert({
    persona_id: params.persona_id,
    discussion_id: params.discussion_id,
    post_slug: params.post_slug,
    content_summary: params.content_summary,
    stance: params.stance ?? null,
    topics: params.topics ?? [],
  });

  if (error) {
    console.error("[discussion-db] insertPersonaHistory:", error.message);
  }
}

// ─── 롱테일 타겟 ─────────────────────────────────────────────────────────────

export async function getLongtailTargets(
  postSlug: string
): Promise<LongtailTarget[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("post_longtail_targets")
    .select("*")
    .eq("post_slug", postSlug)
    .eq("consumed", false)
    .order("created_at", { ascending: true })
    .limit(3);

  if (error) {
    console.error("[discussion-db] getLongtailTargets:", error.message);
    return [];
  }
  return (data ?? []) as LongtailTarget[];
}

export async function markLongtailConsumed(id: string): Promise<void> {
  const db = createServiceClient();
  const { error } = await db
    .from("post_longtail_targets")
    .update({ consumed: true })
    .eq("id", id);

  if (error) {
    console.error("[discussion-db] markLongtailConsumed:", error.message);
  }
}

export async function upsertGenerationLog(
  params: UpsertGenerationLogParams
): Promise<void> {
  const db = createServiceClient();
  const row = {
    batch_id: params.batch_id,
    post_slug: params.post_slug,
    persona_ids: params.persona_ids,
    status: params.status,
    comments_count: params.comments_count ?? 0,
    replies_count: params.replies_count ?? 0,
    keywords_used: params.keywords_used ?? [],
    model_used: params.model_used ?? "gemini-2.5-flash-lite",
    prompt_version: params.prompt_version ?? "v1",
    error_message: params.error_message ?? null,
    completed_at: params.completed_at ?? null,
  };
  const { error } = await db
    .from("discussion_generation_log")
    .upsert(row, { onConflict: "batch_id" });
  if (error) {
    console.error("[discussion-db] upsertGenerationLog:", error.message);
  }
}
