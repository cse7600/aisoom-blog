/**
 * Phase 8.6 댓글 품질 5티어 분포
 * 생성된 댓글의 글자수/스타일 다양성을 보장한다.
 */

export type QualityTier = "quick" | "casual" | "normal" | "detailed" | "expert";

export interface QualityTierSpec {
  tier: QualityTier;
  minChars: number;
  maxChars: number;
  baseWeight: number;
  description: string;
  promptStyle: string;
  temperature: number;
  maxOutputTokens: number;
}

export const QUALITY_TIERS: Record<QualityTier, QualityTierSpec> = {
  quick: {
    tier: "quick",
    minChars: 15,
    maxChars: 60,
    baseWeight: 0.25,
    description: "짧은 반응, 한 문장 이내",
    promptStyle: "한 문장으로 짧게 반응하세요. 'ㅋㅋ', '오', '와', '감사' 같은 짧은 감탄 포함 가능.",
    temperature: 0.95,
    maxOutputTokens: 128,
  },
  casual: {
    tier: "casual",
    minChars: 60,
    maxChars: 150,
    baseWeight: 0.35,
    description: "1-2문장 개인 경험 공유",
    promptStyle: "1-2문장으로 자연스럽게 반응하세요. 반말/반존대 섞임 허용.",
    temperature: 0.92,
    maxOutputTokens: 256,
  },
  normal: {
    tier: "normal",
    minChars: 150,
    maxChars: 300,
    baseWeight: 0.20,
    description: "3-5문장 본문 언급 + 개인 의견",
    promptStyle: "3-5문장으로 작성하세요. 본문의 한 지점을 짚고 개인 의견을 더하세요.",
    temperature: 0.90,
    maxOutputTokens: 384,
  },
  detailed: {
    tier: "detailed",
    minChars: 300,
    maxChars: 500,
    baseWeight: 0.15,
    description: "구조 있는 설명 + 1-2개 사례",
    promptStyle: "4-6문장으로 구조적으로 설명하세요. 구체적 사례 1-2개를 포함하세요.",
    temperature: 0.88,
    maxOutputTokens: 640,
  },
  expert: {
    tier: "expert",
    minChars: 500,
    maxChars: 900,
    baseWeight: 0.05,
    description: "수치/법조문/실무 팁 + 단호한 결론",
    promptStyle: "6-10문장으로 작성하세요. 수치·법규·실무 팁을 포함하고 단호한 결론으로 마무리하세요.",
    temperature: 0.85,
    maxOutputTokens: 1024,
  },
};

const TIER_ORDER: QualityTier[] = ["quick", "casual", "normal", "detailed", "expert"];

export function pickQualityTier(weights?: Partial<Record<QualityTier, number>>): QualityTier {
  const effective = TIER_ORDER.map((tier) => ({
    tier,
    weight: weights?.[tier] ?? QUALITY_TIERS[tier].baseWeight,
  }));
  const total = effective.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return "casual";
  const threshold = Math.random() * total;
  let acc = 0;
  for (const entry of effective) {
    acc += entry.weight;
    if (acc >= threshold) return entry.tier;
  }
  return "casual";
}

export interface QualityPromptParams {
  minChars: number;
  maxChars: number;
  promptStyle: string;
  temperature: number;
  maxOutputTokens: number;
}

export function qualityPromptParams(tier: QualityTier): QualityPromptParams {
  const spec = QUALITY_TIERS[tier];
  return {
    minChars: spec.minChars,
    maxChars: spec.maxChars,
    promptStyle: spec.promptStyle,
    temperature: spec.temperature,
    maxOutputTokens: spec.maxOutputTokens,
  };
}

export function validateCharCount(content: string, tier: QualityTier, tolerance = 0.15): boolean {
  const spec = QUALITY_TIERS[tier];
  const length = Array.from(content).length;
  const lower = Math.floor(spec.minChars * (1 - tolerance));
  const upper = Math.ceil(spec.maxChars * (1 + tolerance));
  return length >= lower && length <= upper;
}

export function charCountOf(content: string): number {
  return Array.from(content).length;
}
