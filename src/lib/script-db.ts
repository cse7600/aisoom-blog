/**
 * Phase 9.1 자율 각본 DB 접근 레이어
 * 모든 쓰기/읽기는 service_role 클라이언트 사용.
 */

import { createServiceClient } from "./supabase";
import type {
  ScriptRow,
  ScriptCommentRow,
  CueRow,
  CueStatus,
  InsertScriptRowParams,
  InsertScriptCommentRowParams,
  InsertCueParams,
  PersonaLite,
  ScriptJsonFile,
} from "./script-types";

const SCRIPT_COLUMNS =
  "id,script_code,category,title,body,author_persona_id,target_keyword,thumb_variant,status,planned_post_date,posted_post_id,source,tags,notes,created_at,updated_at";

const SCRIPT_COMMENT_COLUMNS =
  "id,script_id,parent_script_comment_id,sequence,commenter_persona_id,content,delay_minutes,sentiment,status,posted_comment_id,created_at";

const CUE_COLUMNS =
  "id,script_id,cue_type,script_comment_id,persona_id,fire_at,status,fired_at,error,attempt,created_at";

// ─── Script 조회 ─────────────────────────────────────────────────────────

export async function listScriptsByDate(date: string): Promise<ScriptRow[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("community_scripts")
    .select(SCRIPT_COLUMNS)
    .eq("planned_post_date", date)
    .eq("status", "ready")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[script-db] listScriptsByDate:", error.message);
    return [];
  }
  return (data ?? []) as ScriptRow[];
}

export async function listCommentsByScriptId(
  scriptId: string
): Promise<ScriptCommentRow[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("community_script_comments")
    .select(SCRIPT_COMMENT_COLUMNS)
    .eq("script_id", scriptId)
    .order("sequence", { ascending: true });
  if (error) {
    console.error("[script-db] listCommentsByScriptId:", error.message);
    return [];
  }
  return (data ?? []) as ScriptCommentRow[];
}

export async function getScriptByCode(
  scriptCode: string
): Promise<ScriptRow | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("community_scripts")
    .select(SCRIPT_COLUMNS)
    .eq("script_code", scriptCode)
    .maybeSingle();
  if (error) {
    console.error("[script-db] getScriptByCode:", error.message);
    return null;
  }
  return (data as ScriptRow) ?? null;
}

// ─── Cue 조회 ───────────────────────────────────────────────────────────

export async function fetchDueCuesDb(limit: number): Promise<CueRow[]> {
  const db = createServiceClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await db
    .from("community_script_cues")
    .select(CUE_COLUMNS)
    .eq("status", "queued")
    .lte("fire_at", nowIso)
    .order("fire_at", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("[script-db] fetchDueCuesDb:", error.message);
    return [];
  }
  return (data ?? []) as CueRow[];
}

export async function fetchRecentCuesByPersona(
  personaId: string,
  sinceHours: number
): Promise<CueRow[]> {
  const db = createServiceClient();
  const sinceIso = new Date(Date.now() - sinceHours * 3600 * 1000).toISOString();
  const { data, error } = await db
    .from("community_script_cues")
    .select(CUE_COLUMNS)
    .eq("persona_id", personaId)
    .gte("fire_at", sinceIso)
    .order("fire_at", { ascending: false });
  if (error) {
    console.error("[script-db] fetchRecentCuesByPersona:", error.message);
    return [];
  }
  return (data ?? []) as CueRow[];
}

export async function fetchCueByScriptComment(
  scriptCommentId: string
): Promise<CueRow | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("community_script_cues")
    .select(CUE_COLUMNS)
    .eq("script_comment_id", scriptCommentId)
    .maybeSingle();
  if (error) {
    console.error("[script-db] fetchCueByScriptComment:", error.message);
    return null;
  }
  return (data as CueRow) ?? null;
}

// ─── Cue 쓰기 ───────────────────────────────────────────────────────────

export async function insertCue(
  params: InsertCueParams
): Promise<CueRow | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("community_script_cues")
    .insert({
      script_id: params.script_id,
      cue_type: params.cue_type,
      script_comment_id: params.script_comment_id ?? null,
      persona_id: params.persona_id,
      fire_at: params.fire_at,
      status: "queued",
    })
    .select(CUE_COLUMNS)
    .single();
  if (error) {
    console.error("[script-db] insertCue:", error.message);
    return null;
  }
  return data as CueRow;
}

export async function markCueStatus(
  id: string,
  status: CueStatus,
  errorMessage?: string
): Promise<boolean> {
  const db = createServiceClient();
  const patch: Record<string, unknown> = { status };
  if (status === "fired") patch.fired_at = new Date().toISOString();
  if (errorMessage) patch.error = errorMessage;
  const { error } = await db
    .from("community_script_cues")
    .update(patch)
    .eq("id", id);
  if (error) {
    console.error("[script-db] markCueStatus:", error.message);
    return false;
  }
  return true;
}

export async function incrementCueAttempt(id: string): Promise<void> {
  const db = createServiceClient();
  const { data } = await db
    .from("community_script_cues")
    .select("attempt")
    .eq("id", id)
    .single();
  const current = (data as { attempt: number } | null)?.attempt ?? 0;
  await db
    .from("community_script_cues")
    .update({ attempt: current + 1 })
    .eq("id", id);
}

// ─── Script 쓰기 ───────────────────────────────────────────────────────

export async function insertScriptRow(
  params: InsertScriptRowParams
): Promise<ScriptRow | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("community_scripts")
    .insert({
      script_code: params.script_code,
      category: params.category,
      title: params.title,
      body: params.body,
      author_persona_id: params.author_persona_id,
      target_keyword: params.target_keyword ?? null,
      thumb_variant: params.thumb_variant ?? "default",
      status: params.status ?? "ready",
      planned_post_date: params.planned_post_date ?? null,
      source: params.source ?? "manual",
      tags: params.tags ?? [],
      notes: params.notes ?? null,
    })
    .select(SCRIPT_COLUMNS)
    .single();
  if (error) {
    console.error("[script-db] insertScriptRow:", error.message);
    return null;
  }
  return data as ScriptRow;
}

export async function insertScriptCommentRow(
  params: InsertScriptCommentRowParams
): Promise<ScriptCommentRow | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("community_script_comments")
    .insert({
      script_id: params.script_id,
      parent_script_comment_id: params.parent_script_comment_id ?? null,
      sequence: params.sequence,
      commenter_persona_id: params.commenter_persona_id,
      content: params.content,
      delay_minutes: params.delay_minutes,
      sentiment: params.sentiment ?? "neutral",
      status: params.status ?? "ready",
    })
    .select(SCRIPT_COMMENT_COLUMNS)
    .single();
  if (error) {
    console.error("[script-db] insertScriptCommentRow:", error.message);
    return null;
  }
  return data as ScriptCommentRow;
}

export async function markScriptAsPosted(
  scriptId: string,
  communityPostId: string
): Promise<void> {
  const db = createServiceClient();
  await db
    .from("community_scripts")
    .update({ status: "posted", posted_post_id: communityPostId })
    .eq("id", scriptId);
}

export async function markScriptCommentAsPosted(
  scriptCommentId: string,
  communityCommentId: string
): Promise<void> {
  const db = createServiceClient();
  await db
    .from("community_script_comments")
    .update({ status: "posted", posted_comment_id: communityCommentId })
    .eq("id", scriptCommentId);
}

// ─── 페르소나 조회 (script-queue 의존) ─────────────────────────────────

export async function fetchPersonasLite(): Promise<Map<string, PersonaLite>> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("discussion_personas")
    .select("id,nickname,active_hours,active_weekdays")
    .eq("active", true);
  if (error) {
    console.error("[script-db] fetchPersonasLite:", error.message);
    return new Map();
  }
  const map = new Map<string, PersonaLite>();
  for (const row of (data ?? []) as PersonaLite[]) {
    map.set(row.id, {
      id: row.id,
      nickname: row.nickname,
      active_hours: row.active_hours ?? [],
      active_weekdays: row.active_weekdays ?? [],
    });
  }
  return map;
}

export async function lookupPersonaIdByNickname(
  nickname: string
): Promise<string | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("discussion_personas")
    .select("id")
    .eq("nickname", nickname)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return (data as { id: string }).id;
}

// ─── JSON → DB 일괄 삽입 ───────────────────────────────────────────────

export async function insertScriptFromJson(
  file: ScriptJsonFile
): Promise<{ scriptId: string; commentIds: string[] } | null> {
  const authorId = await lookupPersonaIdByNickname(file.author_persona);
  if (!authorId) {
    console.error(
      `[script-db] insertScriptFromJson: author persona not found: ${file.author_persona}`
    );
    return null;
  }
  const existing = await getScriptByCode(file.script_code);
  if (existing) {
    console.warn(`[script-db] script already exists: ${file.script_code}`);
    return { scriptId: existing.id, commentIds: [] };
  }
  const script = await insertScriptRow({
    script_code: file.script_code,
    category: file.category,
    title: file.title,
    body: file.body,
    author_persona_id: authorId,
    target_keyword: file.target_keyword ?? null,
    thumb_variant: file.thumb_variant ?? "default",
    planned_post_date: file.planned_post_date ?? null,
    source: "import",
    tags: file.tags ?? [],
    notes: file.notes ?? null,
  });
  if (!script) return null;
  const commentIds = await insertScriptCommentsBatch(script.id, file.comments);
  return { scriptId: script.id, commentIds };
}

async function insertScriptCommentsBatch(
  scriptId: string,
  comments: ScriptJsonFile["comments"]
): Promise<string[]> {
  const results: string[] = [];
  const sequenceToId = new Map<number, string>();
  for (const commentSpec of comments) {
    const personaId = await lookupPersonaIdByNickname(commentSpec.persona);
    if (!personaId) {
      console.error(
        `[script-db] commenter persona not found: ${commentSpec.persona}`
      );
      continue;
    }
    const parentId =
      commentSpec.parent_sequence !== undefined
        ? sequenceToId.get(commentSpec.parent_sequence) ?? null
        : null;
    const row = await insertScriptCommentRow({
      script_id: scriptId,
      parent_script_comment_id: parentId,
      sequence: commentSpec.sequence,
      commenter_persona_id: personaId,
      content: commentSpec.content,
      delay_minutes: commentSpec.delay_minutes,
      sentiment: commentSpec.sentiment ?? "neutral",
    });
    if (row) {
      results.push(row.id);
      sequenceToId.set(commentSpec.sequence, row.id);
    }
  }
  return results;
}
