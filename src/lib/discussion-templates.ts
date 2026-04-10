/**
 * Phase 8.6 쓰레드 템플릿 정의 (Phase 8.8 잡담/무반응/웃음 슬롯 추가)
 * 포스트 댓글 쓰레드의 구조적 다양성을 보장한다.
 */

import type { QualityTier } from "./discussion-quality";
import type { PersonaBehaviorType } from "./discussion-types";

export type ThreadTemplateId =
  | "expert_qa"
  | "experience_share"
  | "quick_opinion"
  | "deep_debate"
  | "bootstrap_silent"
  | "casual_chatter";

export type AuthorityLevel = "low" | "mid" | "high" | "expert";
export type AuthorityFilter = AuthorityLevel[] | "any";

/**
 * Phase 8.8 슬롯 역할 확장:
 * - chatty_digress: 주제에서 벗어난 잡담/일상 얘기
 * - lurker_silent: 존재만 하고 대댓글 안 다는 유형 (top-level 한 줄)
 * - lol_react: 앞 댓글(특히 chatty)에 ㅋㅋ류로 반응
 */
export interface ThreadSlot {
  role: string;
  authority: AuthorityFilter;
  depth: 0 | 1;
  qualityTier: QualityTier;
  /** 특정 behavior_type 페르소나만 받도록 제한 */
  behaviorFilter?: PersonaBehaviorType[];
  /** depth=1일 때 어떤 부모 슬롯 role에 붙을지 힌트 */
  parentRoleHint?: string;
  /** 주제 관련성 허용 하한 (0~1). 낮을수록 잡담 허용. 기본 0.7 */
  topicRelevance?: number;
}

export interface ThreadTemplate {
  id: ThreadTemplateId;
  weight: number;
  slots: ThreadSlot[];
  onlyIfPostAgeDaysLt?: number;
}

export const THREAD_TEMPLATES: ThreadTemplate[] = [
  {
    id: "expert_qa",
    weight: 0.28,
    slots: [
      { role: "questioner", authority: ["low", "mid"], depth: 0, qualityTier: "casual" },
      { role: "expert_answer", authority: ["high", "expert"], depth: 0, qualityTier: "expert" },
      { role: "followup_question", authority: ["low", "mid"], depth: 1, qualityTier: "quick", parentRoleHint: "expert_answer" },
      { role: "expert_clarification", authority: ["high", "expert"], depth: 1, qualityTier: "detailed", parentRoleHint: "followup_question" },
      { role: "bystander_appreciation", authority: ["low", "mid"], depth: 0, qualityTier: "quick" },
      { role: "chatty_digress", authority: "any", depth: 0, qualityTier: "casual", behaviorFilter: ["chatty"], topicRelevance: 0.3 },
    ],
  },
  {
    id: "experience_share",
    weight: 0.22,
    slots: [
      { role: "story_opener", authority: "any", depth: 0, qualityTier: "detailed" },
      { role: "me_too", authority: "any", depth: 0, qualityTier: "casual" },
      { role: "contrary_experience", authority: "any", depth: 0, qualityTier: "normal" },
      { role: "mediator", authority: ["high", "expert"], depth: 0, qualityTier: "expert" },
      { role: "chatty_digress", authority: "any", depth: 0, qualityTier: "casual", behaviorFilter: ["chatty"], topicRelevance: 0.3 },
      { role: "followup_thanks", authority: "any", depth: 0, qualityTier: "casual" },
      { role: "question_to_others", authority: "any", depth: 0, qualityTier: "quick" },
    ],
  },
  {
    id: "quick_opinion",
    weight: 0.18,
    slots: [
      { role: "opinion_a", authority: "any", depth: 0, qualityTier: "quick" },
      { role: "opinion_b", authority: "any", depth: 0, qualityTier: "quick" },
      { role: "opinion_c", authority: "any", depth: 0, qualityTier: "casual" },
      { role: "opinion_d", authority: "any", depth: 0, qualityTier: "quick" },
      { role: "lurker_silent", authority: "any", depth: 0, qualityTier: "quick", behaviorFilter: ["lurker"] },
    ],
  },
  {
    id: "deep_debate",
    weight: 0.08,
    slots: [
      { role: "claim", authority: ["high", "expert"], depth: 0, qualityTier: "detailed" },
      { role: "counter_argument", authority: ["high", "expert"], depth: 0, qualityTier: "detailed" },
      { role: "evidence_request", authority: ["mid"], depth: 1, qualityTier: "normal", parentRoleHint: "claim" },
      { role: "source_provided", authority: ["expert"], depth: 1, qualityTier: "expert", parentRoleHint: "evidence_request" },
      { role: "mediation", authority: ["expert"], depth: 0, qualityTier: "expert" },
    ],
  },
  {
    id: "bootstrap_silent",
    weight: 0.09,
    slots: [
      { role: "lonely_opener", authority: ["low", "mid"], depth: 0, qualityTier: "casual" },
    ],
    onlyIfPostAgeDaysLt: 7,
  },
  // Phase 8.8: 잡담 중심 템플릿
  {
    id: "casual_chatter",
    weight: 0.25,
    slots: [
      // 주제 관련 오프너
      { role: "topic_opener", authority: "any", depth: 0, qualityTier: "casual", topicRelevance: 0.8 },
      // 주제 이탈 잡담 1
      { role: "chatty_digress", authority: "any", depth: 0, qualityTier: "casual", behaviorFilter: ["chatty"], topicRelevance: 0.2 },
      // 웃음 반응 (잡담에 붙음)
      { role: "lol_react", authority: "any", depth: 1, qualityTier: "quick", behaviorFilter: ["lol_reactor"], parentRoleHint: "chatty_digress", topicRelevance: 0.1 },
      // 또 다른 잡담 드리프트
      { role: "chatty_drift", authority: "any", depth: 1, qualityTier: "casual", behaviorFilter: ["chatty"], parentRoleHint: "lol_react", topicRelevance: 0.2 },
      // 원래 주제로 살짝 복귀
      { role: "back_to_topic", authority: "any", depth: 0, qualityTier: "normal", topicRelevance: 0.7 },
      // 무반응 lurker의 한마디
      { role: "lurker_silent", authority: "any", depth: 0, qualityTier: "quick", behaviorFilter: ["lurker"] },
      // 웃음 반응 하나 더
      { role: "lol_react", authority: "any", depth: 0, qualityTier: "quick", behaviorFilter: ["lol_reactor"], topicRelevance: 0.3 },
    ],
  },
];

export function weightedRandom<T>(items: T[], weight: (item: T) => number): T {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  if (total <= 0) {
    const fallback = items[0];
    if (!fallback) throw new Error("weightedRandom: empty items");
    return fallback;
  }
  const threshold = Math.random() * total;
  let acc = 0;
  for (const item of items) {
    acc += weight(item);
    if (acc >= threshold) return item;
  }
  const last = items[items.length - 1];
  if (!last) throw new Error("weightedRandom: empty items");
  return last;
}

export function selectTemplate(postAgeDays: number): ThreadTemplate {
  if (postAgeDays < 7) {
    const bootstrap = THREAD_TEMPLATES.find((template) => template.id === "bootstrap_silent");
    if (bootstrap && Math.random() < 0.5) return bootstrap;
  }
  const eligible = THREAD_TEMPLATES.filter(
    (template) => template.id !== "bootstrap_silent"
  );
  return weightedRandom(eligible, (template) => template.weight);
}

export function templateSlotCount(template: ThreadTemplate): number {
  return template.slots.length;
}

/**
 * 슬롯 역할이 잡담 계열인지 여부.
 * 오케스트레이터가 프롬프트에서 주제 관련성 기준을 낮출 때 사용.
 */
export function isCasualRole(role: string): boolean {
  return (
    role === "chatty_digress" ||
    role === "chatty_drift" ||
    role === "lol_react" ||
    role === "lurker_silent"
  );
}
