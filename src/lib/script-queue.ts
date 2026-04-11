/**
 * Phase 9.1 큐 엔진
 * - planDailyCues: 하루 각본을 cue 로 전개
 * - fireCue: 단일 cue 를 community_posts/comments 로 발행
 *
 * 설계 원칙: temporal-engine + 페르소나 쿨다운 + 하드 캡.
 */

import {
  snapToActiveWindow,
  toKstInfo,
  isDeadDay,
} from "./temporal-engine";
import {
  insertCommunityPost,
  insertCommunityComment,
} from "./community-db";
import {
  listScriptsByDate,
  listCommentsByScriptId,
  insertCue,
  markCueStatus,
  markScriptAsPosted,
  markScriptCommentAsPosted,
  fetchDueCuesDb,
  fetchRecentCuesByPersona,
  incrementCueAttempt,
  fetchPersonasLite,
} from "./script-db";
import { hashPassword } from "./community-auth";
import { SCRIPT_LIMITS } from "./script-types";
import type {
  CueRow,
  CueFireResult,
  PersonaLite,
  ScriptQueueContext,
  ScriptRow,
  ScriptCommentRow,
} from "./script-types";

const AI_DEFAULT_PASSWORD = "ai-persona-no-edit";

// ─── 계획 단계 ─────────────────────────────────────────────────────────

export async function planDailyCues(
  context: ScriptQueueContext
): Promise<{ planned: number; skipped: number }> {
  const kstDate = kstDateString(context.nowUtc);
  if (isDeadDay(context.nowUtc)) {
    console.warn(`[script-queue] dead day ${kstDate}, skipping`);
    return { planned: 0, skipped: 0 };
  }
  const scripts = await listScriptsByDate(kstDate);
  const personas = await fetchPersonasLite();
  const capped = scripts.slice(0, SCRIPT_LIMITS.MAX_POSTS_PER_DAY);
  const postAnchor = initialDayAnchor(context.nowUtc);
  let planned = 0;
  let skipped = 0;
  const assignedPostTimes: Date[] = [];
  for (const script of capped) {
    const result = await planSingleScript(
      script,
      postAnchor,
      assignedPostTimes,
      personas,
      context
    );
    planned += result.created;
    if (result.created === 0) skipped += 1;
  }
  return { planned, skipped };
}

async function planSingleScript(
  script: ScriptRow,
  dayAnchor: Date,
  assignedPostTimes: Date[],
  personas: Map<string, PersonaLite>,
  context: ScriptQueueContext
): Promise<{ created: number }> {
  const postPersona = personas.get(script.author_persona_id);
  if (!postPersona) {
    console.warn(`[script-queue] missing author persona for ${script.script_code}`);
    return { created: 0 };
  }
  const postFireAt = assignPostFireAt(
    postPersona,
    dayAnchor,
    assignedPostTimes
  );
  if (!(await isPersonaCooldownClear(postPersona.id, postFireAt))) {
    console.warn(`[script-queue] cooldown block ${script.script_code}`);
    return { created: 0 };
  }
  const postCue = context.dryRun
    ? null
    : await insertCue({
        script_id: script.id,
        cue_type: "post",
        persona_id: postPersona.id,
        fire_at: postFireAt.toISOString(),
      });
  if (!context.dryRun && !postCue) return { created: 0 };
  assignedPostTimes.push(postFireAt);
  const comments = await listCommentsByScriptId(script.id);
  const commentsCreated = await planCommentCues(
    comments,
    postFireAt,
    personas,
    script.id,
    context
  );
  return { created: 1 + commentsCreated };
}

async function planCommentCues(
  comments: ScriptCommentRow[],
  postFireAt: Date,
  personas: Map<string, PersonaLite>,
  scriptId: string,
  context: ScriptQueueContext
): Promise<number> {
  const assignedTimes: Date[] = [];
  let created = 0;
  for (const comment of comments) {
    const persona = personas.get(comment.commenter_persona_id);
    if (!persona) continue;
    const fireAt = assignCommentFireAt(
      comment,
      postFireAt,
      persona,
      assignedTimes
    );
    if (!(await isPersonaCooldownClear(persona.id, fireAt))) continue;
    if (!context.dryRun) {
      const cue = await insertCue({
        script_id: scriptId,
        cue_type: "comment",
        script_comment_id: comment.id,
        persona_id: persona.id,
        fire_at: fireAt.toISOString(),
      });
      if (!cue) continue;
    }
    assignedTimes.push(fireAt);
    created += 1;
  }
  return created;
}

// ─── 시각 할당 ───────────────────────────────────────────────────────

function assignPostFireAt(
  persona: PersonaLite,
  dayAnchor: Date,
  others: Date[]
): Date {
  let candidate = new Date(dayAnchor.getTime() + jitterMs(2, 5));
  candidate = snapToActiveWindow(
    candidate,
    persona.active_hours,
    persona.active_weekdays
  );
  while (hasConflict(candidate, others, SCRIPT_LIMITS.MIN_POST_INTERVAL_MS)) {
    candidate = new Date(
      candidate.getTime() + SCRIPT_LIMITS.MIN_POST_INTERVAL_MS
    );
    candidate = snapToActiveWindow(
      candidate,
      persona.active_hours,
      persona.active_weekdays
    );
  }
  return candidate;
}

function assignCommentFireAt(
  comment: ScriptCommentRow,
  postFireAt: Date,
  persona: PersonaLite,
  others: Date[]
): Date {
  const base = new Date(
    postFireAt.getTime() + comment.delay_minutes * 60 * 1000
  );
  let candidate = snapToActiveWindow(
    base,
    persona.active_hours,
    persona.active_weekdays
  );
  while (hasConflict(candidate, others, SCRIPT_LIMITS.MIN_CUE_INTERVAL_MS)) {
    candidate = new Date(
      candidate.getTime() + SCRIPT_LIMITS.MIN_CUE_INTERVAL_MS
    );
    candidate = snapToActiveWindow(
      candidate,
      persona.active_hours,
      persona.active_weekdays
    );
  }
  return candidate;
}

function hasConflict(target: Date, others: Date[], minMs: number): boolean {
  for (const other of others) {
    if (Math.abs(target.getTime() - other.getTime()) < minMs) return true;
  }
  return false;
}

async function isPersonaCooldownClear(
  personaId: string,
  targetFireAt: Date
): Promise<boolean> {
  const recent = await fetchRecentCuesByPersona(
    personaId,
    SCRIPT_LIMITS.PERSONA_COOLDOWN_HOURS
  );
  const cooldownMs = SCRIPT_LIMITS.PERSONA_COOLDOWN_HOURS * 3600 * 1000;
  for (const cue of recent) {
    const cueTime = new Date(cue.fire_at).getTime();
    if (Math.abs(cueTime - targetFireAt.getTime()) < cooldownMs) return false;
  }
  return true;
}

function initialDayAnchor(nowUtc: Date): Date {
  const kst = toKstInfo(nowUtc);
  const base = new Date(nowUtc);
  base.setUTCHours(base.getUTCHours() + (9 - kst.hour));
  const hourShift = 8 + Math.floor(Math.random() * 3);
  base.setUTCHours(hourShift - 9, Math.floor(Math.random() * 60), 0, 0);
  return base;
}

function jitterMs(minHours: number, maxHours: number): number {
  const delta = maxHours - minHours;
  return (minHours + Math.random() * delta) * 3600 * 1000;
}

function kstDateString(utc: Date): string {
  const kst = new Date(utc.getTime() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10);
}

// ─── Fire 단계 ────────────────────────────────────────────────────────

export async function fetchDueCues(limit: number): Promise<CueRow[]> {
  return fetchDueCuesDb(limit);
}

export async function fireCue(cue: CueRow): Promise<CueFireResult> {
  await markCueStatus(cue.id, "firing");
  try {
    if (cue.cue_type === "post") return await firePostCue(cue);
    return await fireCommentCue(cue);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await incrementCueAttempt(cue.id);
    await markCueStatus(cue.id, "failed", message);
    return {
      cueId: cue.id,
      scriptId: cue.script_id,
      cueType: cue.cue_type,
      success: false,
      error: message,
    };
  }
}

async function firePostCue(cue: CueRow): Promise<CueFireResult> {
  const script = await loadScript(cue.script_id);
  if (!script) return fail(cue, "script not found");
  const persona = await loadPersona(cue.persona_id);
  if (!persona) return fail(cue, "persona not found");
  const post = await insertCommunityPost({
    category: script.category,
    title: script.title,
    content: script.body,
    nickname: persona.nickname,
    password_hash: hashPassword(AI_DEFAULT_PASSWORD),
    ip_hash: null,
    is_ai_generated: true,
    persona_id: persona.id,
    created_at: cue.fire_at,
  });
  if (!post) return fail(cue, "insertCommunityPost failed");
  await markScriptAsPosted(script.id, post.id);
  await markCueStatus(cue.id, "fired");
  return {
    cueId: cue.id,
    scriptId: cue.script_id,
    cueType: "post",
    success: true,
    insertedId: post.id,
  };
}

async function fireCommentCue(cue: CueRow): Promise<CueFireResult> {
  if (!cue.script_comment_id) return fail(cue, "script_comment_id missing");
  const scriptComment = await loadScriptComment(cue.script_comment_id);
  if (!scriptComment) return fail(cue, "script_comment not found");
  const script = await loadScript(cue.script_id);
  if (!script || !script.posted_post_id)
    return fail(cue, "parent post not yet published");
  const persona = await loadPersona(cue.persona_id);
  if (!persona) return fail(cue, "persona not found");
  const parentCommentId = await resolveParentCommentId(
    scriptComment.parent_script_comment_id
  );
  const comment = await insertCommunityComment({
    post_id: script.posted_post_id,
    parent_id: parentCommentId,
    nickname: persona.nickname,
    password_hash: hashPassword(AI_DEFAULT_PASSWORD),
    content: scriptComment.content,
    ip_hash: null,
    is_ai_generated: true,
    persona_id: persona.id,
    created_at: cue.fire_at,
  });
  if (!comment) return fail(cue, "insertCommunityComment failed");
  await markScriptCommentAsPosted(scriptComment.id, comment.id);
  await markCueStatus(cue.id, "fired");
  return {
    cueId: cue.id,
    scriptId: cue.script_id,
    cueType: "comment",
    success: true,
    insertedId: comment.id,
  };
}

async function fail(cue: CueRow, message: string): Promise<CueFireResult> {
  await incrementCueAttempt(cue.id);
  await markCueStatus(cue.id, "failed", message);
  return {
    cueId: cue.id,
    scriptId: cue.script_id,
    cueType: cue.cue_type,
    success: false,
    error: message,
  };
}

// ─── DB 경량 헬퍼 ──────────────────────────────────────────────────────

async function loadScript(scriptId: string): Promise<ScriptRow | null> {
  const { createServiceClient } = await import("./supabase");
  const db = createServiceClient();
  const { data } = await db
    .from("community_scripts")
    .select("*")
    .eq("id", scriptId)
    .maybeSingle();
  return (data as ScriptRow) ?? null;
}

async function loadScriptComment(
  id: string
): Promise<ScriptCommentRow | null> {
  const { createServiceClient } = await import("./supabase");
  const db = createServiceClient();
  const { data } = await db
    .from("community_script_comments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as ScriptCommentRow) ?? null;
}

async function loadPersona(id: string): Promise<PersonaLite | null> {
  const { createServiceClient } = await import("./supabase");
  const db = createServiceClient();
  const { data } = await db
    .from("discussion_personas")
    .select("id,nickname,active_hours,active_weekdays")
    .eq("id", id)
    .maybeSingle();
  return (data as PersonaLite) ?? null;
}

async function resolveParentCommentId(
  parentScriptCommentId: string | null
): Promise<string | null> {
  if (!parentScriptCommentId) return null;
  const { createServiceClient } = await import("./supabase");
  const db = createServiceClient();
  const { data } = await db
    .from("community_script_comments")
    .select("posted_comment_id")
    .eq("id", parentScriptCommentId)
    .maybeSingle();
  return (data as { posted_comment_id: string | null } | null)?.posted_comment_id ?? null;
}
