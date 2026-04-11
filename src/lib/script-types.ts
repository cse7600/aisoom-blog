/**
 * Phase 9.1 자율 각본 스케줄링 — 타입 정의
 * DB 행, JSON 파일 포맷, 큐 구조체를 모두 여기서 선언.
 */

import type { CommunityCategorySlug } from "./community-types";

export type ScriptStatus =
  | "draft"
  | "ready"
  | "scheduled"
  | "posted"
  | "archived";

export type ScriptSource = "manual" | "generator" | "import";

export type ScriptCommentStatus = "draft" | "ready" | "scheduled" | "posted";

export type CueType = "post" | "comment";

export type CueStatus = "queued" | "firing" | "fired" | "failed" | "skipped";

export type ScriptSentiment = "positive" | "neutral" | "critical";

/** community_scripts 행 */
export interface ScriptRow {
  id: string;
  script_code: string;
  category: CommunityCategorySlug;
  title: string;
  body: string;
  author_persona_id: string;
  target_keyword: string | null;
  thumb_variant: string;
  status: ScriptStatus;
  planned_post_date: string | null;
  posted_post_id: string | null;
  source: ScriptSource;
  tags: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** community_script_comments 행 */
export interface ScriptCommentRow {
  id: string;
  script_id: string;
  parent_script_comment_id: string | null;
  sequence: number;
  commenter_persona_id: string;
  content: string;
  delay_minutes: number;
  sentiment: ScriptSentiment;
  status: ScriptCommentStatus;
  posted_comment_id: string | null;
  created_at: string;
}

/** community_script_cues 행 */
export interface CueRow {
  id: string;
  script_id: string;
  cue_type: CueType;
  script_comment_id: string | null;
  persona_id: string;
  fire_at: string;
  status: CueStatus;
  fired_at: string | null;
  error: string | null;
  attempt: number;
  created_at: string;
}

/** JSON 파일 포맷 (로컬 편집용) */
export interface ScriptJsonComment {
  sequence: number;
  persona: string;
  content: string;
  delay_minutes: number;
  sentiment?: ScriptSentiment;
  parent_sequence?: number;
}

export interface ScriptJsonFile {
  script_code: string;
  category: CommunityCategorySlug;
  title: string;
  body: string;
  author_persona: string;
  target_keyword?: string;
  thumb_variant?: string;
  planned_post_date?: string;
  tags?: string[];
  notes?: string;
  comments: ScriptJsonComment[];
}

/** Insert 파라미터 */
export interface InsertScriptRowParams {
  script_code: string;
  category: CommunityCategorySlug;
  title: string;
  body: string;
  author_persona_id: string;
  target_keyword?: string | null;
  thumb_variant?: string;
  status?: ScriptStatus;
  planned_post_date?: string | null;
  source?: ScriptSource;
  tags?: string[];
  notes?: string | null;
}

export interface InsertScriptCommentRowParams {
  script_id: string;
  parent_script_comment_id?: string | null;
  sequence: number;
  commenter_persona_id: string;
  content: string;
  delay_minutes: number;
  sentiment?: ScriptSentiment;
  status?: ScriptCommentStatus;
}

export interface InsertCueParams {
  script_id: string;
  cue_type: CueType;
  script_comment_id?: string | null;
  persona_id: string;
  fire_at: string;
}

/** 페르소나 경량 정보 (플래너 의존) */
export interface PersonaLite {
  id: string;
  nickname: string;
  active_hours: number[];
  active_weekdays: number[];
}

/** 큐 엔진 실행 컨텍스트 */
export interface ScriptQueueContext {
  nowUtc: Date;
  dryRun: boolean;
}

/** Cue fire 결과 */
export interface CueFireResult {
  cueId: string;
  scriptId: string;
  cueType: CueType;
  success: boolean;
  error?: string;
  insertedId?: string;
}

/** 운영 상수 */
export const SCRIPT_LIMITS = {
  MAX_POSTS_PER_DAY: 5,
  MAX_COMMENTS_PER_DAY: 30,
  MAX_REPLIES_PER_DAY: 10,
  PERSONA_COOLDOWN_HOURS: 12,
  MIN_CUE_INTERVAL_MS: 5 * 60 * 1000,
  MIN_POST_INTERVAL_MS: 2 * 60 * 60 * 1000,
  MAX_FIRE_PER_RUN: 20,
  MAX_ATTEMPTS: 3,
} as const;
