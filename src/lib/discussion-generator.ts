/**
 * Phase 8.8 AI 토론 생성 엔진 (오케스트레이터 래퍼)
 *
 * Phase 8.6까지는 슬롯별로 Gemini를 반복 호출했지만,
 * Phase 8.8부터는 discussion-orchestrator가 포스트당 Gemini 1회 호출로
 * 전체 스레드 각본을 받아 일괄 저장한다.
 *
 * 이 파일은 얇은 래퍼 역할만 수행한다:
 *  - 부트스트랩/dead-day/URL cap 판단
 *  - 페르소나 선발 + 템플릿 선택
 *  - 오케스트레이터 호출
 *  - generation_log 기록
 */

import {
  getDiscussionCount,
  getPersonas,
  selectPersonasForPost,
  upsertGenerationLog,
  getTodayUrlCount,
  getLongtailTargets,
} from "./discussion-db";
import type {
  DiscussionWithReplies,
  GenerationPhase,
  ThreadTemplateName,
  LongtailTarget,
  PersonaRow,
} from "./discussion-types";
import type { PostRow } from "./db";
import {
  THREAD_TEMPLATES,
  selectTemplate,
  weightedRandom,
  type ThreadTemplate,
} from "./discussion-templates";
import {
  isDeadDay,
  shouldBurst,
  planBurst,
} from "./temporal-engine";
import {
  postAgeDays,
  decideGeneration,
  computeGenerationPhase,
  maxCommentsForPostAge,
  DAILY_URL_CAP,
} from "./bootstrap-protocol";
import { generateFullScript } from "./discussion-orchestrator";

const PROMPT_VERSION = "v8.8";

interface GenerationInput {
  post: PostRow;
  targetKeywords?: string[];
  dailyUrlCount?: number;
}

interface GenerationResult {
  batchId: string;
  commentsCreated: number;
  repliesCreated: number;
  templateId: ThreadTemplateName;
  skipped?: string;
  errors: string[];
}

interface ResolvedConfig {
  post: PostRow;
  template: ThreadTemplate;
  targetKeywords: string[];
  batchId: string;
  publishedAt: string;
  ageDays: number;
  phase: GenerationPhase;
  dailyUrlCount: number;
  longtailTargets: LongtailTarget[];
}

async function resolveConfig(input: GenerationInput): Promise<ResolvedConfig> {
  const { post } = input;
  const publishedAt = post.published_at ?? post.created_at;
  const ageDays = postAgeDays(publishedAt);
  const template = selectTemplate(ageDays);
  const [longtailTargets, dailyUrlCount] = await Promise.all([
    getLongtailTargets(post.slug),
    input.dailyUrlCount !== undefined
      ? Promise.resolve(input.dailyUrlCount)
      : getTodayUrlCount(),
  ]);
  return {
    post,
    template,
    targetKeywords: input.targetKeywords ?? deriveKeywords(post),
    batchId: `batch_${Date.now()}_${post.slug}`,
    publishedAt,
    ageDays,
    phase: computeGenerationPhase(ageDays),
    dailyUrlCount,
    longtailTargets,
  };
}

function emptyResult(
  batchId: string,
  templateId: ThreadTemplateName,
  errors: string[],
  skipped?: string
): GenerationResult {
  return { batchId, commentsCreated: 0, repliesCreated: 0, templateId, skipped, errors };
}

async function pickTemplatePersonas(
  template: ThreadTemplate,
  postSlug: string
): Promise<PersonaRow[]> {
  const needed = template.slots.length + 4;
  const selected = await selectPersonasForPost(postSlug, needed);
  if (selected.length >= template.slots.length) return selected;
  const fallback = await getPersonas(true);
  return Array.from(
    new Map([...selected, ...fallback].map((row) => [row.id, row])).values()
  );
}

function computeMaxItems(remaining: number): number {
  if (!shouldBurst()) return remaining;
  const burst = planBurst();
  return Math.min(burst.count, remaining);
}

export async function generateDiscussionsForPost(
  input: GenerationInput
): Promise<GenerationResult> {
  const config = await resolveConfig(input);
  if (isDeadDay(new Date())) {
    return emptyResult(config.batchId, config.template.id, [], "dead-day");
  }
  const existingCount = await getDiscussionCount(config.post.slug);
  const decision = decideGeneration({
    ageDays: config.ageDays,
    existingCommentCount: existingCount,
    dailyUrlCount: config.dailyUrlCount,
  });
  if (!decision.allowed) {
    return emptyResult(config.batchId, config.template.id, [], decision.reason);
  }

  const personas = await pickTemplatePersonas(config.template, config.post.slug);
  if (personas.length === 0) {
    return emptyResult(config.batchId, config.template.id, ["no-personas"]);
  }

  await upsertGenerationLog({
    batch_id: config.batchId,
    post_slug: config.post.slug,
    persona_ids: personas.map((persona) => persona.id),
    status: "pending",
    prompt_version: PROMPT_VERSION,
  });

  const maxItems = computeMaxItems(decision.remaining + config.template.slots.length);

  const orchestration = await generateFullScript({
    post: config.post,
    template: config.template,
    personas,
    targetKeywords: config.targetKeywords,
    batchId: config.batchId,
    publishedAt: config.publishedAt,
    phase: config.phase,
    longtailTargets: config.longtailTargets,
    maxItems,
  });

  const totalCreated = orchestration.commentsCreated + orchestration.repliesCreated;
  await upsertGenerationLog({
    batch_id: config.batchId,
    post_slug: config.post.slug,
    persona_ids: personas.map((persona) => persona.id),
    status: totalCreated > 0 ? "completed" : "failed",
    comments_count: orchestration.commentsCreated,
    replies_count: orchestration.repliesCreated,
    keywords_used: config.targetKeywords,
    prompt_version: PROMPT_VERSION,
    error_message: orchestration.errors.length > 0 ? orchestration.errors.join("; ") : null,
    completed_at: new Date().toISOString(),
  });

  return {
    batchId: config.batchId,
    commentsCreated: orchestration.commentsCreated,
    repliesCreated: orchestration.repliesCreated,
    templateId: orchestration.templateId,
    errors: orchestration.errors,
  };
}

// ─── 유틸 ────────────────────────────────────────────────────────────────

function deriveKeywords(post: PostRow): string[] {
  const pool = [...post.keywords, ...post.tags];
  const unique = Array.from(
    new Set(pool.filter((keyword) => keyword && keyword.length > 1))
  );
  return unique.slice(0, 3);
}

export function summarizeExistingDiscussions(
  discussions: DiscussionWithReplies[]
): { commentCount: number; replyCount: number } {
  const commentCount = discussions.length;
  const replyCount = discussions.reduce((acc, row) => acc + row.replies.length, 0);
  return { commentCount, replyCount };
}

export { DAILY_URL_CAP, maxCommentsForPostAge, THREAD_TEMPLATES, weightedRandom };
