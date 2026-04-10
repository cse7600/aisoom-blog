/**
 * Phase 8.5 AI 토론 생성 엔진
 * Gemini API로 페르소나 기반 댓글/대댓글을 생성한다.
 */

import { generateText } from "./gemini";
import {
  insertDiscussion,
  insertReply,
  selectPersonasForPost,
  upsertGenerationLog,
} from "./discussion-db";
import type {
  PersonaRow,
  ReplyType,
  Sentiment,
  DiscussionWithReplies,
} from "./discussion-types";
import type { PostRow } from "./db";

const PROMPT_VERSION = "v1";
const MAX_PARSE_RETRY = 3;

const UNSAFE_PATTERNS: RegExp[] = [
  /010[-\s]?\d{3,4}[-\s]?\d{4}/,
  /\b\d{6}-\d{7}\b/,
  /지금\s*구매/,
  /바로\s*구매/,
  /꼭\s*사세요/,
  /강추합니다/,
  /광고\s*문의/,
];

interface GeneratedComment {
  content: string;
  sentiment: Sentiment;
  is_question: boolean;
}

interface GeneratedReply {
  content: string;
  sentiment: Sentiment;
  reply_type: ReplyType;
}

interface GenerationInput {
  post: PostRow;
  targetKeywords?: string[];
  commentCount?: number;
  replyRatio?: number;
}

interface GenerationResult {
  batchId: string;
  commentsCreated: number;
  repliesCreated: number;
  errors: string[];
}

// ─── 프롬프트 빌더 ────────────────────────────────────────────────────────

function buildPersonaBlock(persona: PersonaRow): string {
  return [
    `- 닉네임: ${persona.nickname}`,
    `- 나이대: ${persona.age_group}`,
    `- 직업: ${persona.occupation ?? "일반"}`,
    `- 관심사: ${persona.interests.join(", ")}`,
    `- 말투 특징: ${persona.tone_keywords.join(", ")}`,
    `- 자주 쓰는 표현: ${persona.sample_phrases.join(" / ")}`,
    `- 이모지 사용: ${persona.emoji_level}`,
    `- 오타 빈도: ${persona.typo_rate}`,
    `- 기본 성향: ${persona.sentiment_bias}`,
  ].join("\n");
}

function buildPostExcerpt(post: PostRow): string {
  const source = post.content ?? post.description ?? "";
  const stripped = source.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return stripped.slice(0, 800);
}

const COMMENT_RULES = [
  "## 절대 규칙",
  "- 마케팅 언어, 광고 톤 절대 사용하지 마세요",
  '- "추천합니다", "강추", "꼭 해보세요" 같은 홍보성 표현 금지',
  "- 실제 한국 커뮤니티(클리앙, 뽐뿌, 디시)에서 볼 법한 날것의 어투",
  "- 문법적으로 완벽하지 않아도 됨",
  "- 100자~300자 사이",
  "- 전화번호/이메일 등 개인정보 절대 포함 금지",
].join("\n");

function buildPostInfoBlock(post: PostRow): string {
  return [
    "## 포스트 정보",
    `- 제목: ${post.title}`,
    `- 카테고리: ${post.category}`,
    `- 요약: ${post.description ?? ""}`,
    `- 본문 일부: ${buildPostExcerpt(post)}`,
    `- SEO 키워드: ${post.keywords.join(", ")}`,
  ].join("\n");
}

export function buildCommentPrompt(
  post: PostRow,
  persona: PersonaRow,
  targetKeywords: string[]
): string {
  return [
    "당신은 한국 인터넷 커뮤니티 사용자입니다.",
    "아래 블로그 포스트를 읽고, 주어진 페르소나로 자연스러운 댓글을 작성하세요.",
    "",
    COMMENT_RULES,
    "",
    "## 페르소나",
    buildPersonaBlock(persona),
    "",
    buildPostInfoBlock(post),
    "",
    "## 타겟 long-tail 키워드 (자연스럽게 포함)",
    targetKeywords.join(", "),
    "",
    "## 출력 형식 (JSON only, 다른 설명 금지)",
    '{"content":"댓글 내용","sentiment":"positive|neutral|negative","is_question":true|false}',
  ].join("\n");
}

const REPLY_TYPE_GUIDE = [
  "## 대댓글 유형 (상황에 맞게 선택)",
  "- agree: 동의, 비슷한 경험 공유",
  "- disagree: 다른 관점 제시",
  "- question: 구체적 사항 추가 질문",
  "- supplement: 정보 보충",
].join("\n");

const REPLY_RULES = [
  "## 절대 규칙",
  "- 원 댓글에 자연스럽게 반응",
  "- 지나치게 공손하거나 격식체 사용 금지",
  "- 50자~200자",
  "- 광고/홍보 표현 금지",
].join("\n");

export function buildReplyPrompt(
  post: PostRow,
  persona: PersonaRow,
  originalNickname: string,
  originalContent: string
): string {
  return [
    "당신은 한국 인터넷 커뮤니티 사용자입니다.",
    "아래 댓글을 읽고, 주어진 페르소나로 자연스러운 대댓글을 작성하세요.",
    "",
    `## 원래 포스트\n- 제목: ${post.title}\n- 카테고리: ${post.category}`,
    "",
    `## 원 댓글\n- 작성자: ${originalNickname}\n- 내용: ${originalContent}`,
    "",
    REPLY_TYPE_GUIDE,
    "",
    "## 페르소나",
    buildPersonaBlock(persona),
    "",
    REPLY_RULES,
    "",
    "## 출력 형식 (JSON only)",
    '{"content":"대댓글 내용","sentiment":"positive|neutral|negative","reply_type":"agree|disagree|question|supplement"}',
  ].join("\n");
}

// ─── 파싱 + 필터 ──────────────────────────────────────────────────────────

export function parseCommentResponse(raw: string): GeneratedComment | null {
  const parsed = extractJson(raw);
  if (!parsed) return null;
  if (typeof parsed.content !== "string" || parsed.content.trim().length < 10) {
    return null;
  }
  return {
    content: parsed.content.trim(),
    sentiment: normalizeSentiment(parsed.sentiment),
    is_question: Boolean(parsed.is_question),
  };
}

export function parseReplyResponse(raw: string): GeneratedReply | null {
  const parsed = extractJson(raw);
  if (!parsed) return null;
  if (typeof parsed.content !== "string" || parsed.content.trim().length < 5) {
    return null;
  }
  return {
    content: parsed.content.trim(),
    sentiment: normalizeSentiment(parsed.sentiment),
    reply_type: normalizeReplyType(parsed.reply_type),
  };
}

function extractJson(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeSentiment(value: unknown): Sentiment {
  if (value === "positive" || value === "negative") return value;
  return "neutral";
}

function normalizeReplyType(value: unknown): ReplyType {
  if (value === "disagree" || value === "question" || value === "supplement") {
    return value;
  }
  return "agree";
}

export function isUnsafeContent(content: string): boolean {
  return UNSAFE_PATTERNS.some((pattern) => pattern.test(content));
}

// ─── Gemini 호출 (재시도 포함) ────────────────────────────────────────────

async function generateCommentWithRetry(
  prompt: string
): Promise<GeneratedComment | null> {
  for (let attempt = 0; attempt < MAX_PARSE_RETRY; attempt += 1) {
    const raw = await generateText(prompt, {
      temperature: 0.95,
      maxOutputTokens: 512,
      responseMimeType: "application/json",
    });
    if (!raw) continue;
    const parsed = parseCommentResponse(raw);
    if (!parsed) continue;
    if (isUnsafeContent(parsed.content)) continue;
    return parsed;
  }
  return null;
}

async function generateReplyWithRetry(
  prompt: string
): Promise<GeneratedReply | null> {
  for (let attempt = 0; attempt < MAX_PARSE_RETRY; attempt += 1) {
    const raw = await generateText(prompt, {
      temperature: 0.9,
      maxOutputTokens: 384,
      responseMimeType: "application/json",
    });
    if (!raw) continue;
    const parsed = parseReplyResponse(raw);
    if (!parsed) continue;
    if (isUnsafeContent(parsed.content)) continue;
    return parsed;
  }
  return null;
}

// ─── 타임스탬프 분산 ──────────────────────────────────────────────────────

export function calculateNaturalTimestamp(
  basePublishedAt: string,
  offsetIndex: number
): string {
  const base = new Date(basePublishedAt).getTime();
  const offsetHours = 2 + offsetIndex * 6 + Math.random() * 4;
  const candidate = new Date(base + offsetHours * 60 * 60 * 1000);
  return clampToKstActiveHours(candidate).toISOString();
}

function clampToKstActiveHours(date: Date): Date {
  const kstOffset = 9 * 60 * 60 * 1000;
  const kst = new Date(date.getTime() + kstOffset);
  const hour = kst.getUTCHours();
  if (hour < 8) {
    kst.setUTCHours(8 + Math.floor(Math.random() * 4));
  } else if (hour >= 24) {
    kst.setUTCHours(22);
  }
  return new Date(kst.getTime() - kstOffset);
}

// ─── 오케스트레이션 ──────────────────────────────────────────────────────

interface CreatedCommentRecord {
  id: string;
  persona: PersonaRow;
  content: string;
}

interface ResolvedConfig {
  post: PostRow;
  commentCount: number;
  replyRatio: number;
  targetKeywords: string[];
  batchId: string;
  publishedAt: string;
}

function resolveConfig(input: GenerationInput): ResolvedConfig {
  const { post } = input;
  return {
    post,
    commentCount: input.commentCount ?? pickCommentCount(post),
    replyRatio: input.replyRatio ?? 0.5,
    targetKeywords: input.targetKeywords ?? deriveKeywords(post),
    batchId: `batch_${Date.now()}_${post.slug}`,
    publishedAt: post.published_at ?? post.created_at,
  };
}

export async function generateDiscussionsForPost(
  input: GenerationInput
): Promise<GenerationResult> {
  const config = resolveConfig(input);
  const errors: string[] = [];
  const personas = await selectPersonasForPost(config.post.slug, config.commentCount);
  if (personas.length === 0) {
    return emptyResult(config.batchId, ["no-personas"]);
  }
  await logPending(config, personas);
  const created = await createCommentsForPersonas(
    buildCommentParams(config, personas, errors)
  );
  const replies = await createRepliesForComments(
    buildReplyParams(config, personas.length, created, errors)
  );
  await finalizeGenerationLog({
    config,
    personas,
    commentsCreated: created.length,
    repliesCreated: replies,
    errors,
  });
  return {
    batchId: config.batchId,
    commentsCreated: created.length,
    repliesCreated: replies,
    errors,
  };
}

function emptyResult(batchId: string, errors: string[]): GenerationResult {
  return { batchId, commentsCreated: 0, repliesCreated: 0, errors };
}

async function logPending(
  config: ResolvedConfig,
  personas: PersonaRow[]
): Promise<void> {
  await upsertGenerationLog({
    batch_id: config.batchId,
    post_slug: config.post.slug,
    persona_ids: personas.map((persona) => persona.id),
    status: "pending",
    prompt_version: PROMPT_VERSION,
  });
}

function buildCommentParams(
  config: ResolvedConfig,
  personas: PersonaRow[],
  errors: string[]
): CreateCommentsParams {
  return {
    post: config.post,
    personas,
    targetKeywords: config.targetKeywords,
    batchId: config.batchId,
    publishedAt: config.publishedAt,
    errors,
  };
}

function buildReplyParams(
  config: ResolvedConfig,
  personaCount: number,
  createdComments: CreatedCommentRecord[],
  errors: string[]
): CreateRepliesParams {
  return {
    post: config.post,
    createdComments,
    replyRatio: config.replyRatio,
    targetKeywords: config.targetKeywords,
    batchId: config.batchId,
    publishedAt: config.publishedAt,
    personaOffset: personaCount,
    errors,
  };
}

interface FinalizeLogParams {
  config: ResolvedConfig;
  personas: PersonaRow[];
  commentsCreated: number;
  repliesCreated: number;
  errors: string[];
}

async function finalizeGenerationLog(params: FinalizeLogParams): Promise<void> {
  const { config, personas, commentsCreated, repliesCreated, errors } = params;
  await upsertGenerationLog({
    batch_id: config.batchId,
    post_slug: config.post.slug,
    persona_ids: personas.map((persona) => persona.id),
    status: commentsCreated > 0 ? "completed" : "failed",
    comments_count: commentsCreated,
    replies_count: repliesCreated,
    keywords_used: config.targetKeywords,
    prompt_version: PROMPT_VERSION,
    error_message: errors.length > 0 ? errors.join("; ") : null,
    completed_at: new Date().toISOString(),
  });
}

interface CreateCommentsParams {
  post: PostRow;
  personas: PersonaRow[];
  targetKeywords: string[];
  batchId: string;
  publishedAt: string;
  errors: string[];
}

async function createCommentsForPersonas(
  params: CreateCommentsParams
): Promise<CreatedCommentRecord[]> {
  const created: CreatedCommentRecord[] = [];
  for (let index = 0; index < params.personas.length; index += 1) {
    const persona = params.personas[index];
    if (!persona) continue;
    const record = await writeSingleComment(params, persona, index);
    if (record) created.push(record);
  }
  return created;
}

async function writeSingleComment(
  params: CreateCommentsParams,
  persona: PersonaRow,
  index: number
): Promise<CreatedCommentRecord | null> {
  const { post, targetKeywords, batchId, publishedAt, errors } = params;
  const comment = await generateCommentWithRetry(
    buildCommentPrompt(post, persona, targetKeywords)
  );
  if (!comment) {
    errors.push(`comment-failed:${persona.nickname}`);
    return null;
  }
  const row = await insertDiscussion({
    post_slug: post.slug,
    persona_id: persona.id,
    content: comment.content,
    sentiment: comment.sentiment,
    is_question: comment.is_question,
    target_keyword: targetKeywords[0] ?? null,
    generation_batch: batchId,
    created_at: calculateNaturalTimestamp(publishedAt, index),
  });
  if (!row) {
    errors.push(`insert-failed:${persona.nickname}`);
    return null;
  }
  return { id: row.id, persona, content: comment.content };
}

interface CreateRepliesParams {
  post: PostRow;
  createdComments: CreatedCommentRecord[];
  replyRatio: number;
  targetKeywords: string[];
  batchId: string;
  publishedAt: string;
  personaOffset: number;
  errors: string[];
}

async function createRepliesForComments(
  params: CreateRepliesParams
): Promise<number> {
  const { post, createdComments, replyRatio } = params;
  if (createdComments.length === 0) return 0;

  const replyPool = await selectPersonasForPost(
    post.slug,
    Math.max(2, Math.ceil(createdComments.length * replyRatio) + 2)
  );
  let repliesCreated = 0;

  for (let index = 0; index < createdComments.length; index += 1) {
    if (Math.random() > replyRatio) continue;
    const target = createdComments[index];
    if (!target) continue;
    const replyPersona = replyPool.find((persona) => persona.id !== target.persona.id);
    if (!replyPersona) continue;

    const saved = await writeSingleReply({
      params,
      target,
      replyPersona,
      index,
    });
    if (saved) repliesCreated += 1;
  }
  return repliesCreated;
}

interface WriteSingleReplyInput {
  params: CreateRepliesParams;
  target: CreatedCommentRecord;
  replyPersona: PersonaRow;
  index: number;
}

async function writeSingleReply(input: WriteSingleReplyInput): Promise<boolean> {
  const { params, target, replyPersona, index } = input;
  const { post, targetKeywords, batchId, publishedAt, personaOffset, errors } = params;

  const prompt = buildReplyPrompt(post, replyPersona, target.persona.nickname, target.content);
  const reply = await generateReplyWithRetry(prompt);
  if (!reply) {
    errors.push(`reply-failed:${replyPersona.nickname}`);
    return false;
  }
  const saved = await insertReply({
    discussion_id: target.id,
    persona_id: replyPersona.id,
    content: reply.content,
    sentiment: reply.sentiment,
    target_keyword: targetKeywords[0] ?? null,
    generation_batch: batchId,
    created_at: calculateNaturalTimestamp(publishedAt, personaOffset + index),
  });
  return Boolean(saved);
}

function pickCommentCount(post: PostRow): number {
  const contentLength = (post.content ?? "").length;
  if (contentLength > 6000) return 4;
  if (contentLength > 3000) return 3;
  return 2;
}

function deriveKeywords(post: PostRow): string[] {
  const pool = [...post.keywords, ...post.tags];
  const unique = Array.from(new Set(pool.filter((keyword) => keyword && keyword.length > 1)));
  return unique.slice(0, 3);
}

// ─── 유틸: 이미 존재하는 토론 재사용 ─────────────────────────────────────

export function summarizeExistingDiscussions(
  discussions: DiscussionWithReplies[]
): { commentCount: number; replyCount: number } {
  const commentCount = discussions.length;
  const replyCount = discussions.reduce((acc, row) => acc + row.replies.length, 0);
  return { commentCount, replyCount };
}
