/**
 * Phase 8.5 AI 커뮤니티 토론 시스템 타입 정의
 * Supabase 테이블 컬럼과 1:1 매핑
 */

export type PersonaType = "worker" | "student" | "parent" | "business" | "techie";
export type AgeGroup = "20s" | "30s" | "40s" | "50s";
export type EmojiLevel = "none" | "low" | "medium" | "high";
export type TypoRate = "none" | "low" | "medium";
export type SentimentBias = "positive" | "neutral" | "critical";
export type Sentiment = "positive" | "neutral" | "negative";
export type ReplyType =
  | "agree"
  | "disagree"
  | "question"
  | "supplement"
  | "lol"
  | "digress";
export type GenerationStatus = "pending" | "completed" | "failed";
export type AuthorityLevel = "low" | "mid" | "high" | "expert";
export type QualityTierName = "quick" | "casual" | "normal" | "detailed" | "expert";
export type ThreadTemplateName =
  | "expert_qa"
  | "experience_share"
  | "quick_opinion"
  | "deep_debate"
  | "bootstrap_silent"
  | "casual_chatter";
export type GenerationPhase = "pending" | "bootstrap" | "growing" | "mature";
export type ResponseModelName = "immediate" | "contemplated" | "revisit";

/**
 * Phase 8.8: 페르소나 행동 유형
 * normal — 일반 (기존 작동 방식)
 * chatty — 주제 이탈을 즐기는 잡담러
 * lurker — 대댓글 잘 안 달아주는 무반응러
 * lol_reactor — 쓸데없는 멘트에 유독 웃으며 반응하는 유형
 */
export type PersonaBehaviorType = "normal" | "chatty" | "lurker" | "lol_reactor";

export interface PersonaSignaturePatterns {
  openers?: string[];
  closers?: string[];
  quirks?: string[];
  vocabulary_level?: "low" | "mid" | "high";
  typo_rate?: number;
  emoji_rate?: number;
}

export interface PersonaQualityWeights {
  quick?: number;
  casual?: number;
  normal?: number;
  detailed?: number;
  expert?: number;
}

export interface PersonaRow {
  id: string;
  nickname: string;
  persona_type: PersonaType;
  age_group: AgeGroup;
  occupation: string | null;
  interests: string[];
  tone_keywords: string[];
  sample_phrases: string[];
  emoji_level: EmojiLevel;
  typo_rate: TypoRate;
  sentiment_bias: SentimentBias;
  active: boolean;
  post_count: number;
  created_at: string;
  authority_level: AuthorityLevel;
  signature_patterns: PersonaSignaturePatterns;
  bio: string | null;
  expertise_domains: string[];
  quality_weights: PersonaQualityWeights;
  active_hours: number[];
  active_weekdays: number[];
  /** Phase 8.8: 페르소나 행동 유형 (chatty / lurker / lol_reactor / normal) */
  behavior_type: PersonaBehaviorType;
}

export interface PostDiscussionRow {
  id: string;
  post_slug: string;
  persona_id: string;
  content: string;
  sentiment: Sentiment;
  upvotes: number;
  is_question: boolean;
  target_keyword: string | null;
  generation_batch: string | null;
  scheduled_at: string | null;
  published: boolean;
  created_at: string;
  thread_template: ThreadTemplateName;
  scheduled_generation_at: string | null;
  generation_phase: GenerationPhase;
  longtail_target: string | null;
  quality_tier: QualityTierName;
  char_count: number;
}

export interface DiscussionReplyRow {
  id: string;
  discussion_id: string;
  persona_id: string;
  content: string;
  sentiment: Sentiment;
  upvotes: number;
  target_keyword: string | null;
  generation_batch: string | null;
  published: boolean;
  created_at: string;
  quality_tier: QualityTierName;
  char_count: number;
  response_model: ResponseModelName | null;
}

export interface DiscussionReplyWithPersona extends DiscussionReplyRow {
  persona: PersonaRow;
}

export interface DiscussionWithReplies extends PostDiscussionRow {
  persona: PersonaRow;
  replies: DiscussionReplyWithPersona[];
}

export interface InsertDiscussionParams {
  post_slug: string;
  persona_id: string;
  content: string;
  sentiment?: Sentiment;
  upvotes?: number;
  is_question?: boolean;
  target_keyword?: string | null;
  generation_batch?: string | null;
  created_at?: string;
  thread_template?: ThreadTemplateName;
  scheduled_generation_at?: string | null;
  generation_phase?: GenerationPhase;
  longtail_target?: string | null;
  quality_tier?: QualityTierName;
  char_count?: number;
}

export interface InsertReplyParams {
  discussion_id: string;
  persona_id: string;
  content: string;
  sentiment?: Sentiment;
  upvotes?: number;
  target_keyword?: string | null;
  generation_batch?: string | null;
  created_at?: string;
  quality_tier?: QualityTierName;
  char_count?: number;
  response_model?: ResponseModelName | null;
}

export interface GenerationLogRow {
  id: string;
  batch_id: string;
  post_slug: string;
  persona_ids: string[];
  comments_count: number;
  replies_count: number;
  keywords_used: string[];
  model_used: string;
  prompt_version: string | null;
  status: GenerationStatus;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface PostNeedingDiscussion {
  slug: string;
  title: string;
  description: string | null;
  content: string | null;
  category: string;
  tags: string[];
  keywords: string[];
  published_at: string | null;
  created_at: string;
  comment_count: number;
  reply_count: number;
  priority: "highest" | "high" | "medium" | "low";
}

export interface PersonaHistoryEntry {
  id: string;
  persona_id: string;
  discussion_id: string;
  post_slug: string;
  content_summary: string;
  stance: string | null;
  topics: string[];
  created_at: string;
}

export interface InsertPersonaHistoryParams {
  persona_id: string;
  discussion_id: string;
  post_slug: string;
  content_summary: string;
  stance?: string | null;
  topics?: string[];
}

export interface LongtailTarget {
  id: string;
  post_slug: string;
  longtail_keyword: string;
  target_question: string;
  assigned_persona_id: string | null;
  consumed: boolean;
  created_at: string;
}
