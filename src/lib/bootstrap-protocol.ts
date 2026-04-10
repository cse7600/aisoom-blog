/**
 * Phase 8.6 부트스트랩 프로토콜
 * Firefly 필터(URL 생성 속도) 회피를 위한 댓글 수 제한 로직.
 */

export function postAgeDays(publishedAt: Date | string): number {
  const base = typeof publishedAt === "string" ? new Date(publishedAt) : publishedAt;
  const diff = Date.now() - base.getTime();
  return Math.max(diff / (24 * 60 * 60 * 1000), 0);
}

/**
 * 포스트 연령(일)에 따른 최대 허용 댓글 수.
 */
export function maxCommentsForPostAge(ageDays: number): number {
  if (ageDays < 1) return 0;
  if (ageDays < 7) return 1;
  if (ageDays < 14) return 2;
  if (ageDays < 30) return 4;
  return 9;
}

/**
 * 부트스트랩 기간 동안 bootstrap_silent 템플릿 선택 확률.
 */
export function bootstrapSilentProbability(ageDays: number): number {
  if (ageDays < 7) return 0.5;
  if (ageDays < 14) return 0.2;
  return 0.0;
}

export type GenerationPhase = "pending" | "bootstrap" | "growing" | "mature";

export function computeGenerationPhase(ageDays: number): GenerationPhase {
  if (ageDays < 1) return "pending";
  if (ageDays < 7) return "bootstrap";
  if (ageDays < 30) return "growing";
  return "mature";
}

/**
 * 일일 URL 생성 하드캡. 이 값을 초과하면 생성 중단해야 한다.
 */
export const DAILY_URL_CAP = 200;

export interface BootstrapDecision {
  allowed: boolean;
  remaining: number;
  reason?: string;
}

export interface BootstrapDecisionInput {
  ageDays: number;
  existingCommentCount: number;
  dailyUrlCount: number;
}

export function decideGeneration(input: BootstrapDecisionInput): BootstrapDecision {
  if (input.dailyUrlCount >= DAILY_URL_CAP) {
    return {
      allowed: false,
      remaining: 0,
      reason: `daily-cap-exceeded:${input.dailyUrlCount}/${DAILY_URL_CAP}`,
    };
  }
  const max = maxCommentsForPostAge(input.ageDays);
  const remaining = max - input.existingCommentCount;
  if (remaining <= 0) {
    return {
      allowed: false,
      remaining: 0,
      reason: `post-at-cap:${input.existingCommentCount}/${max}`,
    };
  }
  return { allowed: true, remaining };
}
