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
export type ReplyType = "agree" | "disagree" | "question" | "supplement";
export type GenerationStatus = "pending" | "completed" | "failed";

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
