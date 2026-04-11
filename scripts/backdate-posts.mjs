#!/usr/bin/env node
/**
 * 게시글 published_at 백데이트 재배분 스크립트
 *
 * 목적:
 *   모든 published 게시글이 하루에 몰려 있는 상황을
 *   주 2회 (화/금) 자연 발행 패턴으로 과거에 재분산한다.
 *
 * 알고리즘:
 *   1. status='published' 게시글 전부 조회
 *   2. created_at 오름차순 정렬 (먼저 만든 글이 더 오래된 날짜를 받음)
 *   3. 가장 최근 글 = 오늘로부터 7일 전에 가장 가까운 화/금 슬롯
 *   4. 거기서부터 과거로 화→금→화→금 역순으로 슬롯 배정
 *   5. 시간은 10:00~14:00 랜덤 (KST 기준)
 *   6. created_at 도 published_at 과 동일하게 맞춤 (포스트 목록 정렬 일관성)
 *
 * 사용법:
 *   node scripts/backdate-posts.mjs --dry-run
 *   node scripts/backdate-posts.mjs
 *   node scripts/backdate-posts.mjs --seed=42     # 시간 랜덤 시드 고정
 *   node scripts/backdate-posts.mjs --keep-created # created_at 은 그대로 두기
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ─── env 로드 ────────────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) throw new Error(".env.local 없음");
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.+)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

// ─── 시드 기반 의사난수 (재현성 확보) ─────────────────────────────────────
function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

// ─── 날짜 유틸 ──────────────────────────────────────────────────────────────
const KST_OFFSET_MIN = 9 * 60;

/** KST 기준 Y-M-D 객체 생성 */
function kstDate(year, month, day, hour, minute, second) {
  // UTC 로 환산: KST = UTC+9
  const utcMs = Date.UTC(year, month - 1, day, hour - 9, minute, second);
  return new Date(utcMs);
}

/** Date → KST 해석 후 요일 (0=일..6=토) */
function kstWeekday(date) {
  const kstMs = date.getTime() + KST_OFFSET_MIN * 60 * 1000;
  return new Date(kstMs).getUTCDay();
}

/** KST 기준 YYYY-MM-DD 문자열 */
function kstYmd(date) {
  const kstMs = date.getTime() + KST_OFFSET_MIN * 60 * 1000;
  const d = new Date(kstMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * 오늘(KST) 기준 7일 전 시점에서 가장 가까운 과거 화/금을 찾아서
 * 거기서부터 과거로 화→금→화→금 역순 슬롯 배열을 N개 생성.
 *
 * 주 2회 = 화요일(2), 금요일(5)
 * 화→금 간격 3일, 금→다음주 화 간격 4일
 */
function buildBackdateSlots(count, rng) {
  const TUE = 2;
  const FRI = 5;

  // 기준점: 오늘(KST) 00:00 UTC 등가 Date
  const now = new Date();
  // KST 오늘 자정
  const kstNow = new Date(now.getTime() + KST_OFFSET_MIN * 60 * 1000);
  const todayKst = kstDate(
    kstNow.getUTCFullYear(),
    kstNow.getUTCMonth() + 1,
    kstNow.getUTCDate(),
    0, 0, 0
  );

  // 7일 전 KST 자정
  const anchor = new Date(todayKst.getTime() - 7 * 24 * 60 * 60 * 1000);

  // anchor 이하에서 가장 가까운 화 또는 금 찾기
  let cursor = new Date(anchor);
  for (let i = 0; i < 14; i++) {
    const wd = kstWeekday(cursor);
    if (wd === TUE || wd === FRI) break;
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }

  // cursor 부터 과거로 슬롯 생성
  const slots = [];
  const step = new Date(cursor);
  for (let i = 0; i < count; i++) {
    const wd = kstWeekday(step);
    // KST 10:00~13:59 사이 랜덤 시각
    const hour = 10 + Math.floor(rng() * 4);          // 10,11,12,13
    const minute = Math.floor(rng() * 60);            // 0~59
    const second = Math.floor(rng() * 60);            // 0~59

    const [y, m, d] = kstYmd(step).split("-").map(Number);
    const slotDate = kstDate(y, m, d, hour, minute, second);
    slots.push(slotDate);

    // 다음(더 과거) 슬롯: 화면 금요일이면 3일 전 화요일, 화면 화요일이면 4일 전 금요일
    const delta = wd === FRI ? 3 : 4;
    step.setTime(step.getTime() - delta * 24 * 60 * 60 * 1000);
  }

  // 과거→현재 순으로 뒤집기 (오름차순)
  slots.reverse();
  return slots;
}

// ─── Supabase REST 래퍼 ─────────────────────────────────────────────────────
async function fetchPublishedPosts() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const endpoint = `${url}/rest/v1/posts?select=id,slug,title,status,published_at,created_at&status=eq.published&order=created_at.asc`;

  const res = await fetch(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    throw new Error(`Supabase GET ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function patchPost(id, payload) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const endpoint = `${url}/rest/v1/posts?id=eq.${id}`;

  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Supabase PATCH ${id} ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// ─── main ──────────────────────────────────────────────────────────────────
loadEnv();

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const keepCreated = args.includes("--keep-created");
const seedArg = args.find(a => a.startsWith("--seed="));
const seed = seedArg ? Number(seedArg.split("=")[1]) : 20260412;

console.log(`모드: ${dryRun ? "DRY RUN" : "EXECUTE"}`);
console.log(`시드: ${seed}`);
console.log(`created_at 동기화: ${keepCreated ? "OFF" : "ON"}`);

const posts = await fetchPublishedPosts();
console.log(`\n대상 published 게시글: ${posts.length}편`);

if (posts.length === 0) {
  console.log("대상 없음. 종료.");
  process.exit(0);
}

const rng = createRng(seed);
const slots = buildBackdateSlots(posts.length, rng);

console.log(`\n생성된 슬롯 범위:`);
console.log(`  가장 오래된: ${slots[0].toISOString()} (${kstYmd(slots[0])} KST)`);
console.log(`  가장 최근:  ${slots[slots.length - 1].toISOString()} (${kstYmd(slots[slots.length - 1])} KST)`);

// 배정 테이블 출력
console.log(`\n── 배정 결과 ──────────────────────────────────────────────`);
console.log("idx  slot(KST)              요일  제목");
console.log("───  ─────────────────────  ────  ──────────────────────────");

const weekdayNames = ["일", "월", "화", "수", "목", "금", "토"];
const updates = [];

for (let i = 0; i < posts.length; i++) {
  const post = posts[i];
  const slot = slots[i];
  const ymd = kstYmd(slot);
  const wd = weekdayNames[kstWeekday(slot)];
  const kstMs = slot.getTime() + KST_OFFSET_MIN * 60 * 1000;
  const kd = new Date(kstMs);
  const hhmm = `${String(kd.getUTCHours()).padStart(2, "0")}:${String(kd.getUTCMinutes()).padStart(2, "0")}`;

  const titleShort = (post.title || "").slice(0, 32);
  console.log(
    `${String(i + 1).padStart(3, " ")}  ${ymd} ${hhmm}      ${wd}    ${titleShort}`
  );

  updates.push({
    id: post.id,
    slug: post.slug,
    published_at: slot.toISOString(),
    created_at: slot.toISOString(),
  });
}

// 주별 집계 확인
const weekCounts = {};
for (const u of updates) {
  const d = new Date(u.published_at);
  const kstMs = d.getTime() + KST_OFFSET_MIN * 60 * 1000;
  const kd = new Date(kstMs);
  // ISO 주차 근사: 연-월 단위로 표시
  const key = `${kd.getUTCFullYear()}-${String(kd.getUTCMonth() + 1).padStart(2, "0")}`;
  weekCounts[key] = (weekCounts[key] || 0) + 1;
}

console.log(`\n── 월별 분포 ──`);
Object.entries(weekCounts)
  .sort(([a], [b]) => a.localeCompare(b))
  .forEach(([m, c]) => console.log(`  ${m}: ${c}편`));

if (dryRun) {
  console.log(`\n[DRY RUN] 변경 없이 종료. 실제 실행은 --dry-run 을 빼고 재실행.`);
  process.exit(0);
}

// 실제 PATCH 실행
console.log(`\n── Supabase PATCH 실행 ──`);
let ok = 0;
let fail = 0;
for (const u of updates) {
  const payload = keepCreated
    ? { published_at: u.published_at }
    : { published_at: u.published_at, created_at: u.created_at };
  try {
    await patchPost(u.id, payload);
    ok++;
    process.stdout.write(".");
  } catch (e) {
    fail++;
    console.error(`\n실패 id=${u.id} slug=${u.slug}: ${e.message}`);
  }
}
console.log(`\n\n완료: 성공 ${ok}편 / 실패 ${fail}편`);
