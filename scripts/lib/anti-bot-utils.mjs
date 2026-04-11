/**
 * 어뷰징 탐지 회피 유틸리티
 *
 * 목표: inject/seed 스크립트가 남기는 패턴을 실제 유저 트래픽처럼 보이게 만든다.
 *   1) IP hash 다양화 (한국 ISP 대역 기반)
 *   2) 타임스탬프 한국 활성 시간대(08~24) + 가우시안 스파이크
 *   3) 포스트별 댓글 자연 분산 (7~30일 랜덤 윈도우)
 *   4) view_count 점진 증가 시뮬레이션
 *
 * 모든 함수는 순수 함수 — 외부 상태 변경 없음.
 */

import crypto from "node:crypto";

// ─── IP hash 다양화 ───────────────────────────────────────────────────────
// 실제 한국 ISP 대역 (KT / SK / LG / 알뜰모바일 / 모바일 5G).
// 정확한 IP를 찍지 않고 대역 prefix만 활용해 salt+hash 생성.
const KR_IP_PREFIXES = [
  // KT 가정/기업
  "121.158", "121.167", "14.32", "14.33", "211.216", "211.217",
  "58.78", "58.79", "118.235", "118.236", "125.191", "125.242",
  // SK Broadband / SKT
  "175.207", "175.223", "211.36", "211.37", "223.38", "223.39",
  "106.101", "106.102", "115.138", "115.139", "203.236", "203.249",
  // LG U+
  "39.113", "39.114", "117.111", "117.123", "211.234", "211.235",
  "182.162", "182.163", "1.224", "1.241", "218.36", "218.37",
  // 알뜰/모바일 5G 대역
  "27.122", "27.160", "175.194", "175.195", "61.84", "61.85",
  "210.103", "210.124", "220.116", "220.117",
];

const UA_POOL = [
  "ios-safari-17", "android-chrome-121", "desktop-chrome-122",
  "desktop-edge-121", "desktop-safari-17", "android-samsung-internet-23",
  "ios-chrome-121", "android-chrome-120", "desktop-firefox-122",
];

/**
 * 가짜 IP hash 생성. 대역 prefix + 랜덤 호스트 + UA 시그널을 섞어 SHA-256.
 * @param {number} seed 선택적 시드 (결정적 출력이 필요할 때)
 * @returns {string} 64자 16진 hex
 */
export function generateFakeIpHash(seed) {
  const prefix = KR_IP_PREFIXES[pickIndex(KR_IP_PREFIXES.length, seed)];
  const host3 = Math.floor(randWithSeed(seed + 17) * 256);
  const host4 = Math.floor(randWithSeed(seed + 41) * 256);
  const ua = UA_POOL[pickIndex(UA_POOL.length, seed + 99)];
  const salt = process.env.IP_HASH_SALT ?? "grd-community-salt-v2";
  const raw = `${prefix}.${host3}.${host4}|${ua}|${salt}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function pickIndex(length, seed) {
  if (typeof seed === "number") {
    return Math.floor(randWithSeed(seed) * length);
  }
  return Math.floor(Math.random() * length);
}

function randWithSeed(seed) {
  if (typeof seed !== "number") return Math.random();
  // mulberry32 PRNG — 결정적 seed 기반
  let t = (seed | 0) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ─── 한국 활성 시간대 타임스탬프 분산 ─────────────────────────────────────
// 실제 커뮤니티 활동 peak:
//   08~10 (출근 스낵타임)
//   12~14 (점심 브레이크)
//   18~20 (퇴근 직후)
//   21~23 (야간 소비 피크)
// 03~07 은 거의 제로.

const HOUR_WEIGHTS = [
  // 00  01  02  03  04  05  06  07
   0.5, 0.3, 0.2, 0.1, 0.1, 0.1, 0.2, 0.5,
  // 08  09  10  11  12  13  14  15
   2.0, 1.5, 1.3, 1.2, 2.5, 2.3, 1.5, 1.3,
  // 16  17  18  19  20  21  22  23
   1.4, 1.6, 2.2, 2.8, 2.5, 2.7, 2.6, 1.8,
];

const HOUR_CDF = buildCdf(HOUR_WEIGHTS);

function buildCdf(weights) {
  const total = weights.reduce((acc, value) => acc + value, 0);
  const result = new Array(weights.length);
  let running = 0;
  for (let index = 0; index < weights.length; index += 1) {
    running += weights[index] / total;
    result[index] = running;
  }
  return result;
}

/**
 * 활성 시간대 가중치로 랜덤 hour 선택
 */
export function pickActiveHour() {
  const roll = Math.random();
  for (let index = 0; index < HOUR_CDF.length; index += 1) {
    if (roll <= HOUR_CDF[index]) return index;
  }
  return 20;
}

/**
 * 주어진 기준 Date에서 랜덤 활성 시각으로 스냅.
 * 기존 날짜는 유지, 시/분/초만 교체.
 */
export function snapToActiveWindow(date) {
  const result = new Date(date.getTime());
  result.setHours(pickActiveHour());
  result.setMinutes(Math.floor(Math.random() * 60));
  result.setSeconds(Math.floor(Math.random() * 60));
  result.setMilliseconds(Math.floor(Math.random() * 1000));
  return result;
}

/**
 * 포스트 발행 시각을 기준으로 댓글 N개를 자연 분산.
 * 1일차 피크 → 3일차까지 감쇠 → 이후 롱테일.
 *
 * @param {Date} publishedAt 포스트 발행 시각
 * @param {number} count 생성할 타임스탬프 개수
 * @param {object} options maxDays (기본 21), peakBiasDays (기본 3)
 * @returns {Date[]} 오름차순 정렬된 Date 배열
 */
export function distributeCommentTimestamps(publishedAt, count, options = {}) {
  const maxDays = options.maxDays ?? 21;
  const peakBiasDays = options.peakBiasDays ?? 3;
  const base = new Date(publishedAt.getTime());
  const timestamps = [];

  for (let index = 0; index < count; index += 1) {
    // 60%는 peakBiasDays 이내, 30%는 peakBiasDays~maxDays/2, 10%는 maxDays 롱테일
    const bucket = Math.random();
    let dayOffset;
    if (bucket < 0.6) {
      dayOffset = Math.random() * peakBiasDays;
    } else if (bucket < 0.9) {
      dayOffset = peakBiasDays + Math.random() * (maxDays / 2 - peakBiasDays);
    } else {
      dayOffset = maxDays / 2 + Math.random() * (maxDays / 2);
    }
    const candidate = new Date(base.getTime() + dayOffset * 24 * 3600 * 1000);
    timestamps.push(snapToActiveWindow(candidate));
  }

  timestamps.sort((a, b) => a.getTime() - b.getTime());
  return timestamps;
}

/**
 * 대댓글 타임스탬프 — 부모 댓글 작성 후 15분~12시간 사이 랜덤.
 * 80%는 2시간 이내(즉시 반응), 15%는 2~6시간(같은 세션), 5%는 6~12시간(다음 접속).
 */
export function pickReplyTimestamp(parentCreatedAt) {
  const bucket = Math.random();
  let offsetMinutes;
  if (bucket < 0.8) {
    offsetMinutes = 15 + Math.random() * 105; // 15m~2h
  } else if (bucket < 0.95) {
    offsetMinutes = 120 + Math.random() * 240; // 2h~6h
  } else {
    offsetMinutes = 360 + Math.random() * 360; // 6h~12h
  }
  const result = new Date(parentCreatedAt.getTime() + offsetMinutes * 60 * 1000);
  return result;
}

// ─── view_count 점진 시뮬레이션 ───────────────────────────────────────────
/**
 * 포스트 경과일·카테고리 기반 조회수 추정.
 * 트래픽 0인 신규 사이트라는 점을 고려해 낮은 상한을 유지.
 */
export function estimateViewCount(publishedAt, options = {}) {
  const now = Date.now();
  const daysSince = Math.max(0, (now - publishedAt.getTime()) / (24 * 3600 * 1000));
  const baseDaily = options.baseDaily ?? 3; // 1일 평균 방문자
  const decayHalfLife = options.decayHalfLife ?? 5; // 5일마다 반감
  const jitter = 0.6 + Math.random() * 0.8; // 0.6~1.4

  // 정적분 근사: 감쇠 트래픽 누적
  let total = 0;
  for (let day = 0; day <= daysSince; day += 0.5) {
    const decay = Math.pow(0.5, day / decayHalfLife);
    total += baseDaily * decay * 0.5;
  }
  return Math.max(0, Math.floor(total * jitter));
}

// ─── 디버그용 ─────────────────────────────────────────────────────────────
export function sampleDistribution(count = 20) {
  return Array.from({ length: count }, (_, index) => ({
    ipHash: generateFakeIpHash(index).slice(0, 12) + "...",
    hour: pickActiveHour(),
  }));
}
