/**
 * Phase 8.8 사전 각본 오케스트레이터
 *
 * 기존 슬롯별 Gemini 반복 호출을 제거하고,
 * 포스트 1개당 Gemini 1회 호출로 전체 스레드 각본(JSON)을 받는다.
 * 각본 → 검증 → 타임스탬프 할당 → DB 배치 삽입 순으로 진행.
 */

import { generateText } from "./gemini";
import type { PostRow } from "./db";
import {
  insertDiscussion,
  insertReply,
  getPersonaRecentHistory,
  insertPersonaHistory,
  markLongtailConsumed,
} from "./discussion-db";
import type {
  PersonaRow,
  PersonaHistoryEntry,
  Sentiment,
  ReplyType,
  LongtailTarget,
  PersonaBehaviorType,
  QualityTierName,
  ResponseModelName,
  GenerationPhase,
  ThreadTemplateName,
} from "./discussion-types";
import {
  isCasualRole,
  type ThreadTemplate,
  type ThreadSlot,
} from "./discussion-templates";
import {
  QUALITY_TIERS,
  validateCharCount,
  charCountOf,
  type QualityTier,
} from "./discussion-quality";
import {
  earliestCommentTime,
  scheduleNext,
  pickResponseModel,
  responseDelayMs,
  snapToActiveWindow,
} from "./temporal-engine";

// ─── 타입 ─────────────────────────────────────────────────────────────────

export interface OrchestrationInput {
  post: PostRow;
  template: ThreadTemplate;
  personas: PersonaRow[];
  targetKeywords: string[];
  batchId: string;
  publishedAt: string;
  phase: GenerationPhase;
  longtailTargets: LongtailTarget[];
  maxItems: number;
}

export interface ScriptItem {
  slot_index: number;
  role: string;
  depth: 0 | 1;
  parent_slot_index: number | null;
  persona_id: string;
  content: string;
  sentiment: Sentiment;
  is_question: boolean;
  reply_type?: ReplyType;
  quality_tier: QualityTier;
}

export interface OrchestrationResult {
  batchId: string;
  templateId: ThreadTemplateName;
  commentsCreated: number;
  repliesCreated: number;
  skipped?: string;
  errors: string[];
  scriptItemCount: number;
}

interface SlotPlan {
  slot: ThreadSlot;
  slotIndex: number;
  parentSlotIndex: number | null;
  persona: PersonaRow;
  tier: QualityTier;
  longtailId: string | null;
  longtailQuestion: string | null;
}

// ─── 안전 필터 ────────────────────────────────────────────────────────────

const UNSAFE_PATTERNS: RegExp[] = [
  /010[-\s]?\d{3,4}[-\s]?\d{4}/,
  /\b\d{6}-\d{7}\b/,
  /지금\s*구매/,
  /바로\s*구매/,
  /꼭\s*사세요/,
  /강추합니다/,
  /광고\s*문의/,
];

function isUnsafe(content: string): boolean {
  return UNSAFE_PATTERNS.some((pattern) => pattern.test(content));
}

// ─── 슬롯 → 페르소나 플랜 ────────────────────────────────────────────────

function authorityMatches(slot: ThreadSlot, persona: PersonaRow): boolean {
  if (slot.authority === "any") return true;
  return slot.authority.includes(persona.authority_level);
}

function behaviorMatches(slot: ThreadSlot, persona: PersonaRow): boolean {
  if (!slot.behaviorFilter || slot.behaviorFilter.length === 0) return true;
  return slot.behaviorFilter.includes(persona.behavior_type);
}

/**
 * lurker는 대댓글(depth=1) 배정 확률을 10% 이하로 낮춘다.
 */
function lurkerReplyGate(slot: ThreadSlot, persona: PersonaRow): boolean {
  if (persona.behavior_type !== "lurker") return true;
  if (slot.depth === 0) return true;
  return Math.random() < 0.1;
}

function pickSlotPersona(
  slot: ThreadSlot,
  pool: PersonaRow[],
  used: Set<string>
): PersonaRow | null {
  const available = pool.filter((persona) => !used.has(persona.id));
  if (available.length === 0) return null;

  const strictMatches = available.filter(
    (persona) =>
      authorityMatches(slot, persona) &&
      behaviorMatches(slot, persona) &&
      lurkerReplyGate(slot, persona)
  );
  if (strictMatches.length > 0) {
    return strictMatches[Math.floor(Math.random() * strictMatches.length)] ?? null;
  }

  const behaviorOnly = available.filter((persona) => behaviorMatches(slot, persona));
  if (behaviorOnly.length > 0) {
    return behaviorOnly[Math.floor(Math.random() * behaviorOnly.length)] ?? null;
  }

  // behaviorFilter가 있었는데 매칭이 없으면 이 슬롯은 스킵
  if (slot.behaviorFilter && slot.behaviorFilter.length > 0) return null;

  return available[Math.floor(Math.random() * available.length)] ?? null;
}

function pickSlotTier(slot: ThreadSlot): QualityTier {
  return slot.qualityTier;
}

function pickLongtail(
  slot: ThreadSlot,
  longtails: LongtailTarget[]
): LongtailTarget | null {
  if (!slot.role.includes("question") && slot.role !== "questioner") return null;
  return longtails.find((target) => !target.consumed) ?? null;
}

function buildSlotPlans(input: OrchestrationInput): SlotPlan[] {
  const plans: SlotPlan[] = [];
  const used = new Set<string>();
  const longtails = [...input.longtailTargets];

  input.template.slots.forEach((slot, slotIndex) => {
    const persona = pickSlotPersona(slot, input.personas, used);
    if (!persona) return;
    used.add(persona.id);

    const parentSlotIndex = resolveParentSlotIndex(slot, plans);
    const longtail = pickLongtail(slot, longtails);
    if (longtail) longtail.consumed = true;

    plans.push({
      slot,
      slotIndex,
      parentSlotIndex,
      persona,
      tier: pickSlotTier(slot),
      longtailId: longtail?.id ?? null,
      longtailQuestion: longtail?.target_question ?? null,
    });
  });

  return plans;
}

function resolveParentSlotIndex(
  slot: ThreadSlot,
  priorPlans: SlotPlan[]
): number | null {
  if (slot.depth !== 1) return null;
  // parentRoleHint 우선 매칭
  if (slot.parentRoleHint) {
    const match = [...priorPlans]
      .reverse()
      .find((plan) => plan.slot.role === slot.parentRoleHint && plan.slot.depth === 0);
    if (match) return match.slotIndex;
  }
  // fallback: 가장 최근의 top-level 슬롯
  const lastTopLevel = [...priorPlans].reverse().find((plan) => plan.slot.depth === 0);
  return lastTopLevel ? lastTopLevel.slotIndex : null;
}

// ─── Gemini 프롬프트 빌더 ────────────────────────────────────────────────

function stripHtml(source: string): string {
  return source.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function buildPostBlock(post: PostRow): string {
  const excerpt = stripHtml(post.content ?? post.description ?? "").slice(0, 900);
  return [
    `제목: ${post.title}`,
    `카테고리: ${post.category}`,
    `요약: ${post.description ?? ""}`,
    `본문 발췌: ${excerpt}`,
    `SEO 키워드: ${post.keywords.join(", ")}`,
  ].join("\n");
}

function behaviorHintFor(type: PersonaBehaviorType): string {
  switch (type) {
    case "chatty":
      return "잡담러. 포스트 주제에서 살짝 벗어난 일상 얘기/삼천포로 빠져도 된다. 자연스러운 드리프트를 허용.";
    case "lurker":
      return "무반응 눈팅러. 한두 문장 이내로 짧게만 남기고, 깊은 대화는 피한다. 존댓말 단답 위주.";
    case "lol_reactor":
      return "웃음반응러. 'ㅋㅋ', 'ㅇㅈ', '레전드' 같은 짧고 가벼운 공감/웃음 중심. 쓸데없는 잡담에 특히 잘 반응.";
    default:
      return "일반 유저. 포스트 주제에 맞춰 자연스럽게 의견/경험을 공유.";
  }
}

function buildPersonaLine(persona: PersonaRow, historySummary: string): string {
  const openers = (persona.signature_patterns.openers ?? []).join(" / ") || "-";
  const closers = (persona.signature_patterns.closers ?? []).join(" / ") || "-";
  return [
    `  - id: ${persona.id}`,
    `    nickname: ${persona.nickname}`,
    `    behavior_type: ${persona.behavior_type} — ${behaviorHintFor(persona.behavior_type)}`,
    `    authority: ${persona.authority_level}`,
    `    age: ${persona.age_group}, 직업: ${persona.occupation ?? "일반"}`,
    `    bio: ${persona.bio ?? "없음"}`,
    `    말버릇 openers: ${openers}`,
    `    말버릇 closers: ${closers}`,
    `    이모지: ${persona.emoji_level}, 오타: ${persona.typo_rate}, 성향: ${persona.sentiment_bias}`,
    historySummary ? `    최근 발언: ${historySummary}` : "",
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

function buildSlotLine(plan: SlotPlan): string {
  const tier = QUALITY_TIERS[plan.tier];
  const relevance = plan.slot.topicRelevance ?? (isCasualRole(plan.slot.role) ? 0.3 : 0.7);
  const style = tier.promptStyle;
  const parentHint =
    plan.parentSlotIndex !== null ? `parent_slot_index=${plan.parentSlotIndex}` : "root";
  const longtailLine = plan.longtailQuestion
    ? `\n    longtail_question: ${plan.longtailQuestion} (이 질문을 자연스럽게 변형해 포함)`
    : "";
  return [
    `  slot_index=${plan.slotIndex}  role=${plan.slot.role}  depth=${plan.slot.depth}  ${parentHint}`,
    `    persona_id=${plan.persona.id} (${plan.persona.nickname}, ${plan.persona.behavior_type})`,
    `    quality_tier=${plan.tier} (${tier.minChars}~${tier.maxChars}자, ${style})`,
    `    topic_relevance_min=${relevance}`,
    longtailLine,
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

const RULES_BLOCK = [
  "## 절대 규칙",
  "- 마케팅/광고 톤 절대 금지. '추천합니다', '강추', '꼭 해보세요' 금지.",
  "- 한국 커뮤니티(클리앙, 뽐뿌, 디시) 날것의 말투. 완벽한 문법 불필요.",
  "- 전화번호/이메일 등 개인정보 금지.",
  "- 페르소나의 behavior_type에 맞춰 톤/길이/반응 방식을 다르게.",
  "- chatty/lol_reactor는 본문 주제와 70% 미만 관련성도 허용 (오히려 권장).",
  "- lurker는 반드시 짧게. 1~2문장 이내, 단답에 가깝게.",
  "- 광고티가 날 것 같으면 톤을 낮춰 투덜거림/의심/경험담으로 돌릴 것.",
  "- 동일 페르소나의 이전 발언과 말버릇/톤 일관성 유지.",
  "- depth=1 대댓글은 parent_slot_index가 가리키는 댓글에 자연스럽게 이어져야 함.",
].join("\n");

const OUTPUT_SPEC = [
  "## 출력 형식 (JSON only, 다른 설명/코드블록/주석 금지)",
  "{",
  '  "script": [',
  "    {",
  '      "slot_index": 0,',
  '      "role": "<role>",',
  '      "depth": 0,',
  '      "parent_slot_index": null,',
  '      "persona_id": "<uuid>",',
  '      "content": "<실제 댓글 본문>",',
  '      "sentiment": "positive|neutral|negative",',
  '      "is_question": false,',
  '      "reply_type": "agree|disagree|question|supplement|lol|digress"',
  "    }",
  "  ]",
  "}",
  "- script 배열의 길이와 slot_index는 아래 '할당 계획' 슬롯과 정확히 1:1 대응.",
  "- depth=0 항목은 reply_type을 생략하거나 null.",
  "- depth=1 항목은 반드시 reply_type 지정.",
].join("\n");

export async function buildScriptPrompt(input: OrchestrationInput, plans: SlotPlan[]): Promise<string> {
  const personaLines = await Promise.all(
    plans.map(async (plan) => {
      const history = await getPersonaRecentHistory(plan.persona.id, 3);
      const summary = summarizeHistory(history);
      return buildPersonaLine(plan.persona, summary);
    })
  );

  return [
    "당신은 한국 커뮤니티 댓글 스레드를 통째로 연출하는 시나리오 작가다.",
    "아래 포스트에 대한 댓글/대댓글 스레드 전체를 한 번에 써야 한다.",
    "각 슬롯은 특정 페르소나에 미리 배정되어 있으며, 네가 할 일은 각 슬롯의 실제 발화 내용을 만드는 것이다.",
    "",
    "## 포스트",
    buildPostBlock(input.post),
    "",
    "## 타겟 long-tail 키워드 (주제 관련 슬롯에만 자연스럽게 분산 삽입)",
    input.targetKeywords.join(", "),
    "",
    "## 페르소나 정보",
    personaLines.join("\n"),
    "",
    "## 할당 계획 (이 순서/인덱스를 정확히 따를 것)",
    plans.map(buildSlotLine).join("\n"),
    "",
    RULES_BLOCK,
    "",
    OUTPUT_SPEC,
  ].join("\n");
}

function summarizeHistory(history: PersonaHistoryEntry[]): string {
  if (history.length === 0) return "";
  return history
    .slice(0, 3)
    .map((entry) => entry.content_summary.slice(0, 60))
    .join(" | ");
}

// ─── 각본 파싱 ────────────────────────────────────────────────────────────

interface RawScriptEntry {
  slot_index?: number;
  role?: string;
  depth?: number;
  parent_slot_index?: number | null;
  persona_id?: string;
  content?: string;
  sentiment?: string;
  is_question?: boolean;
  reply_type?: string;
}

interface RawScript {
  script?: RawScriptEntry[];
}

function parseScriptJson(raw: string): RawScript | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as RawScript;
  } catch {
    return null;
  }
}

function normalizeSentiment(value: unknown): Sentiment {
  if (value === "positive" || value === "negative") return value;
  return "neutral";
}

function normalizeReplyType(value: unknown): ReplyType {
  if (
    value === "disagree" ||
    value === "question" ||
    value === "supplement" ||
    value === "lol" ||
    value === "digress"
  ) {
    return value;
  }
  return "agree";
}

// ─── Gemini 호출 + 재시도 ────────────────────────────────────────────────

const MAX_PARSE_RETRY = 3;

async function callGeminiForScript(prompt: string, estimatedSlots: number): Promise<string | null> {
  // 슬롯 수에 비례해 출력 토큰 할당
  const perSlotTokens = 220;
  const maxOutputTokens = Math.min(8192, Math.max(1024, perSlotTokens * estimatedSlots + 512));
  for (let attempt = 0; attempt < MAX_PARSE_RETRY; attempt += 1) {
    const raw = await generateText(prompt, {
      temperature: 0.92,
      maxOutputTokens,
      responseMimeType: "application/json",
    });
    if (raw && raw.length > 0) return raw;
  }
  return null;
}

// ─── 각본 검증 ────────────────────────────────────────────────────────────

function validateScriptEntry(
  entry: RawScriptEntry,
  plan: SlotPlan,
  errors: string[]
): ScriptItem | null {
  if (typeof entry.content !== "string" || entry.content.trim().length < 3) {
    errors.push(`slot-${plan.slotIndex}:empty-content`);
    return null;
  }
  const content = entry.content.trim();
  if (isUnsafe(content)) {
    errors.push(`slot-${plan.slotIndex}:unsafe`);
    return null;
  }
  // lurker는 짧아야 함 (60자 이내)
  if (plan.persona.behavior_type === "lurker" && charCountOf(content) > 80) {
    errors.push(`slot-${plan.slotIndex}:lurker-too-long`);
    return null;
  }
  // 일반 슬롯은 품질 티어 기반 검증. 잡담 슬롯/lol은 완화.
  const allowLoose =
    isCasualRole(plan.slot.role) || plan.persona.behavior_type === "lol_reactor";
  if (!allowLoose && !validateCharCount(content, plan.tier, 0.2)) {
    errors.push(`slot-${plan.slotIndex}:char-count`);
    return null;
  }

  return {
    slot_index: plan.slotIndex,
    role: plan.slot.role,
    depth: plan.slot.depth,
    parent_slot_index: plan.parentSlotIndex,
    persona_id: plan.persona.id,
    content,
    sentiment: normalizeSentiment(entry.sentiment),
    is_question: Boolean(entry.is_question),
    reply_type: plan.slot.depth === 1 ? normalizeReplyType(entry.reply_type) : undefined,
    quality_tier: plan.tier,
  };
}

export function validateScript(
  raw: RawScript,
  plans: SlotPlan[]
): { items: ScriptItem[]; errors: string[] } {
  const errors: string[] = [];
  if (!raw.script || !Array.isArray(raw.script)) {
    return { items: [], errors: ["script:not-array"] };
  }
  const byIndex = new Map<number, RawScriptEntry>();
  for (const entry of raw.script) {
    if (typeof entry.slot_index === "number") byIndex.set(entry.slot_index, entry);
  }
  const items: ScriptItem[] = [];
  for (const plan of plans) {
    const entry = byIndex.get(plan.slotIndex);
    if (!entry) {
      errors.push(`slot-${plan.slotIndex}:missing`);
      continue;
    }
    const validated = validateScriptEntry(entry, plan, errors);
    if (validated) items.push(validated);
  }
  return { items, errors };
}

// ─── 타임스탬프 할당 + DB 배치 삽입 ──────────────────────────────────────

interface TimestampContext {
  publishedAt: string;
  lastTopLevel: Date | null;
}

function nextTopLevelTimestamp(
  persona: PersonaRow,
  ctx: TimestampContext
): Date {
  const base =
    ctx.lastTopLevel ?? earliestCommentTime(new Date(ctx.publishedAt));
  const candidate = scheduleNext({
    from: base,
    lambdaPerHour: 0.3,
    isB2B: persona.persona_type === "business",
  });
  return snapToActiveWindow(candidate, persona.active_hours, persona.active_weekdays);
}

function replyTimestamp(parentCreated: Date, persona: PersonaRow): { ts: Date; model: ResponseModelName } {
  const model = pickResponseModel();
  const delay = responseDelayMs(model);
  const ts = snapToActiveWindow(
    new Date(parentCreated.getTime() + delay),
    persona.active_hours,
    persona.active_weekdays
  );
  return { ts, model };
}

interface PersistContext {
  input: OrchestrationInput;
  plansBySlotIndex: Map<number, SlotPlan>;
  /** slot_index → 저장된 top-level discussion id + createdAt */
  topLevelRecords: Map<number, { id: string; createdAt: Date }>;
  commentsCreated: number;
  repliesCreated: number;
  errors: string[];
}

async function persistTopLevelItem(
  item: ScriptItem,
  plan: SlotPlan,
  ctx: PersistContext,
  tsCtx: TimestampContext
): Promise<Date | null> {
  const timestamp = nextTopLevelTimestamp(plan.persona, tsCtx);
  const row = await insertDiscussion({
    post_slug: ctx.input.post.slug,
    persona_id: plan.persona.id,
    content: item.content,
    sentiment: item.sentiment,
    is_question: item.is_question,
    target_keyword: ctx.input.targetKeywords[0] ?? null,
    generation_batch: ctx.input.batchId,
    created_at: timestamp.toISOString(),
    thread_template: ctx.input.template.id,
    generation_phase: ctx.input.phase,
    quality_tier: item.quality_tier as QualityTierName,
    char_count: charCountOf(item.content),
  });
  if (!row) {
    ctx.errors.push(`insert-failed:slot-${item.slot_index}`);
    return null;
  }
  ctx.commentsCreated += 1;
  ctx.topLevelRecords.set(item.slot_index, {
    id: row.id,
    createdAt: new Date(row.created_at),
  });
  await insertPersonaHistory({
    persona_id: plan.persona.id,
    discussion_id: row.id,
    post_slug: ctx.input.post.slug,
    content_summary: item.content.slice(0, 120),
    stance: item.role,
    topics: ctx.input.targetKeywords.slice(0, 3),
  });
  if (plan.longtailId) await markLongtailConsumed(plan.longtailId);
  return timestamp;
}

async function persistReplyItem(
  item: ScriptItem,
  plan: SlotPlan,
  ctx: PersistContext
): Promise<void> {
  if (item.parent_slot_index === null) {
    ctx.errors.push(`reply-no-parent:slot-${item.slot_index}`);
    return;
  }
  const parent = ctx.topLevelRecords.get(item.parent_slot_index);
  if (!parent) {
    ctx.errors.push(`reply-parent-missing:slot-${item.slot_index}`);
    return;
  }
  // lol_reactor는 chatty 또는 다른 lol_reactor 부모에만
  if (plan.persona.behavior_type === "lol_reactor") {
    const parentPlan = ctx.plansBySlotIndex.get(item.parent_slot_index);
    const parentBehavior = parentPlan?.persona.behavior_type;
    if (parentBehavior !== "chatty" && parentBehavior !== "lol_reactor") {
      ctx.errors.push(`lol-reactor-wrong-parent:slot-${item.slot_index}`);
      return;
    }
  }
  const { ts, model } = replyTimestamp(parent.createdAt, plan.persona);
  const saved = await insertReply({
    discussion_id: parent.id,
    persona_id: plan.persona.id,
    content: item.content,
    sentiment: item.sentiment,
    target_keyword: ctx.input.targetKeywords[0] ?? null,
    generation_batch: ctx.input.batchId,
    created_at: ts.toISOString(),
    quality_tier: item.quality_tier as QualityTierName,
    char_count: charCountOf(item.content),
    response_model: model,
  });
  if (!saved) {
    ctx.errors.push(`reply-insert-failed:slot-${item.slot_index}`);
    return;
  }
  ctx.repliesCreated += 1;
  await insertPersonaHistory({
    persona_id: plan.persona.id,
    discussion_id: parent.id,
    post_slug: ctx.input.post.slug,
    content_summary: item.content.slice(0, 120),
    stance: item.reply_type ?? null,
    topics: ctx.input.targetKeywords.slice(0, 3),
  });
}

async function persistScript(
  items: ScriptItem[],
  plans: SlotPlan[],
  input: OrchestrationInput
): Promise<PersistContext> {
  const plansBySlotIndex = new Map(plans.map((plan) => [plan.slotIndex, plan]));
  const ctx: PersistContext = {
    input,
    plansBySlotIndex,
    topLevelRecords: new Map(),
    commentsCreated: 0,
    repliesCreated: 0,
    errors: [],
  };

  const tsCtx: TimestampContext = {
    publishedAt: input.publishedAt,
    lastTopLevel: null,
  };

  // 1차: top-level 먼저 저장 (slot_index 오름차순)
  const topLevels = items
    .filter((item) => item.depth === 0)
    .sort((a, b) => a.slot_index - b.slot_index);
  for (const item of topLevels) {
    if (ctx.commentsCreated + ctx.repliesCreated >= input.maxItems) break;
    const plan = plansBySlotIndex.get(item.slot_index);
    if (!plan) continue;
    const timestamp = await persistTopLevelItem(item, plan, ctx, tsCtx);
    if (timestamp) tsCtx.lastTopLevel = timestamp;
  }

  // 2차: 대댓글 저장
  const replies = items
    .filter((item) => item.depth === 1)
    .sort((a, b) => a.slot_index - b.slot_index);
  for (const item of replies) {
    if (ctx.commentsCreated + ctx.repliesCreated >= input.maxItems) break;
    const plan = plansBySlotIndex.get(item.slot_index);
    if (!plan) continue;
    await persistReplyItem(item, plan, ctx);
  }

  return ctx;
}

// ─── 외부 진입점 ─────────────────────────────────────────────────────────

export async function generateFullScript(
  input: OrchestrationInput
): Promise<OrchestrationResult> {
  const plans = buildSlotPlans(input);
  if (plans.length === 0) {
    return {
      batchId: input.batchId,
      templateId: input.template.id,
      commentsCreated: 0,
      repliesCreated: 0,
      errors: ["no-slot-plans"],
      scriptItemCount: 0,
    };
  }

  const prompt = await buildScriptPrompt(input, plans);
  const raw = await callGeminiForScript(prompt, plans.length);
  if (!raw) {
    return {
      batchId: input.batchId,
      templateId: input.template.id,
      commentsCreated: 0,
      repliesCreated: 0,
      errors: ["gemini-empty"],
      scriptItemCount: 0,
    };
  }

  const parsed = parseScriptJson(raw);
  if (!parsed) {
    return {
      batchId: input.batchId,
      templateId: input.template.id,
      commentsCreated: 0,
      repliesCreated: 0,
      errors: ["script-parse-failed"],
      scriptItemCount: 0,
    };
  }

  const { items, errors: validationErrors } = validateScript(parsed, plans);
  if (items.length === 0) {
    return {
      batchId: input.batchId,
      templateId: input.template.id,
      commentsCreated: 0,
      repliesCreated: 0,
      errors: ["no-valid-items", ...validationErrors],
      scriptItemCount: 0,
    };
  }

  const persistCtx = await persistScript(items, plans, input);

  return {
    batchId: input.batchId,
    templateId: input.template.id,
    commentsCreated: persistCtx.commentsCreated,
    repliesCreated: persistCtx.repliesCreated,
    errors: [...validationErrors, ...persistCtx.errors],
    scriptItemCount: items.length,
  };
}
