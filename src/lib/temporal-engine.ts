/**
 * Phase 8.6 시간 패턴 엔진
 * Poisson 분포 + KST 가중치 + 3 응답 모델로 봇 탐지 회피.
 */

export type ResponseModel = "immediate" | "contemplated" | "revisit";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * KST 시간대별 댓글 밀도 가중치 (24시간, UTC 오프셋 +9 기준).
 * 새벽 시간은 낮게, 점심·저녁은 높게.
 */
export const KST_HOUR_WEIGHTS: readonly number[] = [
  0.20, 0.10, 0.05, 0.05, 0.05, 0.10,
  0.30, 0.50, 0.80, 1.00, 1.00, 1.10,
  1.40, 1.20, 0.90, 0.80, 0.90, 1.00,
  1.30, 1.50, 1.40, 1.20, 0.90, 0.50,
];

/**
 * B2B: 월화수목금 밀집, 주말 급감.
 * 배열 인덱스는 Date.getDay() (일=0).
 */
export const B2B_WEEKDAY_WEIGHTS: readonly number[] = [0.3, 1.0, 1.0, 1.0, 1.0, 1.0, 0.4];

/**
 * B2C: 평일/주말 균일, 주말 약간 상승.
 */
export const B2C_WEEKDAY_WEIGHTS: readonly number[] = [0.9, 0.8, 0.8, 0.8, 0.8, 0.9, 1.1];

/**
 * Poisson 프로세스의 다음 이벤트까지의 간격 (ms).
 * lambdaPerHour: 시간당 기대 이벤트 수.
 */
export function nextInterval(lambdaPerHour: number): number {
  if (lambdaPerHour <= 0) return DAY_MS;
  const u = Math.max(Math.random(), 1e-9);
  return (-Math.log(u) / lambdaPerHour) * HOUR_MS;
}

export function randomBetween(minMs: number, maxMs: number): number {
  return Math.floor(minMs + Math.random() * (maxMs - minMs));
}

/**
 * 응답 모델 선택: 즉시 30%, 숙고 50%, 재방문 20%.
 */
export function pickResponseModel(): ResponseModel {
  const roll = Math.random();
  if (roll < 0.30) return "immediate";
  if (roll < 0.80) return "contemplated";
  return "revisit";
}

export function responseDelayMs(model: ResponseModel): number {
  switch (model) {
    case "immediate":
      return randomBetween(5 * 60_000, 2 * HOUR_MS);
    case "contemplated":
      return randomBetween(3 * HOUR_MS, 18 * HOUR_MS);
    case "revisit":
      return randomBetween(24 * HOUR_MS, 5 * DAY_MS);
  }
}

/**
 * 포스트 발행 후 첫 댓글까지 최소 24시간 지연.
 */
export function earliestCommentTime(postPublishedAt: Date): Date {
  const delayMs = randomBetween(24 * HOUR_MS, 72 * HOUR_MS);
  return new Date(postPublishedAt.getTime() + delayMs);
}

export interface KstTimeInfo {
  hour: number;
  weekday: number;
}

export function toKstInfo(date: Date): KstTimeInfo {
  const kst = new Date(date.getTime() + 9 * HOUR_MS);
  return {
    hour: kst.getUTCHours(),
    weekday: kst.getUTCDay(),
  };
}

export interface WeightLookup {
  hourWeight: number;
  weekdayWeight: number;
  combined: number;
}

export function lookupWeights(date: Date, isB2B: boolean): WeightLookup {
  const info = toKstInfo(date);
  const hourWeight = KST_HOUR_WEIGHTS[info.hour] ?? 0.1;
  const weekdayTable = isB2B ? B2B_WEEKDAY_WEIGHTS : B2C_WEEKDAY_WEIGHTS;
  const weekdayWeight = weekdayTable[info.weekday] ?? 0.5;
  return {
    hourWeight,
    weekdayWeight,
    combined: hourWeight * weekdayWeight,
  };
}

/**
 * 주어진 시작 시각부터 KST 가중치를 존중하는 다음 댓글 시각을 계산한다.
 * 가중치가 낮은 시간대면 포아송 간격을 그만큼 길게 늘려준다.
 */
export interface ScheduleNextOptions {
  from: Date;
  lambdaPerHour: number;
  isB2B: boolean;
  jitter?: number;
}

export function scheduleNext(options: ScheduleNextOptions): Date {
  const { from, lambdaPerHour, isB2B } = options;
  const jitter = options.jitter ?? 0.4;
  const weights = lookupWeights(from, isB2B);
  const effectiveLambda = Math.max(lambdaPerHour * weights.combined, 0.01);
  const baseInterval = nextInterval(effectiveLambda);
  const noise = 1 + (Math.random() * 2 - 1) * jitter;
  return new Date(from.getTime() + baseInterval * noise);
}

/**
 * 페르소나의 active_hours/active_weekdays를 존중하도록 시각을 스냅한다.
 */
export function snapToActiveWindow(
  candidate: Date,
  activeHours: number[],
  activeWeekdays: number[]
): Date {
  const info = toKstInfo(candidate);
  const hourOk = activeHours.length === 0 || activeHours.includes(info.hour);
  const weekdayOk = activeWeekdays.length === 0 || activeWeekdays.includes(info.weekday);
  if (hourOk && weekdayOk) return candidate;

  const snapped = new Date(candidate.getTime());
  const fallbackHour = activeHours[Math.floor(Math.random() * Math.max(activeHours.length, 1))] ?? 12;
  const kst = new Date(snapped.getTime() + 9 * HOUR_MS);
  kst.setUTCHours(fallbackHour, Math.floor(Math.random() * 60), 0, 0);
  return new Date(kst.getTime() - 9 * HOUR_MS);
}

/**
 * Burst: 특정 포스트에서 2-4시간 내 3-5개 연속 댓글을 생성할 확률.
 */
export function shouldBurst(): boolean {
  return Math.random() < 0.10;
}

export interface BurstPlan {
  count: number;
  windowMs: number;
}

export function planBurst(): BurstPlan {
  const count = 3 + Math.floor(Math.random() * 3);
  const windowMs = randomBetween(2 * HOUR_MS, 4 * HOUR_MS);
  return { count, windowMs };
}

/**
 * 오늘이 "dead day" 인지 결정 (주 1회, 평균적으로 14%).
 * 시드를 날짜로 삼아 전체 시스템이 같은 답을 내도록 보장.
 */
export function isDeadDay(date: Date): boolean {
  const info = toKstInfo(date);
  const kstDateStr = new Date(date.getTime() + 9 * HOUR_MS).toISOString().slice(0, 10);
  const seed = kstDateStr.split("").reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7);
  const bucket = Math.abs(seed) % 7;
  return bucket === info.weekday;
}
