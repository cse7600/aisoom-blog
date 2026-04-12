#!/usr/bin/env node
/**
 * 예약 발행(scheduled) 자동 전환 스크립트
 *
 * status='scheduled' AND published_at <= now() 포스트를 status='published'로 전환.
 *
 * Usage:
 *   node scripts/auto-schedule.mjs          # 예약 해제 실행
 *   node scripts/auto-schedule.mjs --dry    # 대상 확인만 (변경 없음)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ─── env ────────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) throw new Error(".env.local 없음");
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.+)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

// ─── Supabase helpers ───────────────────────────────────────────────────────

function supabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { apikey: key, Authorization: `Bearer ${key}` };
}

function baseUrl() {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/posts`;
}

/** status='scheduled' AND published_at <= now() 포스트 조회 */
async function fetchScheduledDue() {
  const nowIso = new Date().toISOString();
  const url =
    `${baseUrl()}?status=eq.scheduled&published_at=lte.${encodeURIComponent(nowIso)}` +
    `&select=id,slug,title,category,published_at&order=published_at.asc`;

  const res = await fetch(url, { headers: supabaseHeaders() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase GET ${res.status}: ${body}`);
  }
  return res.json();
}

/** 여러 id를 한 번에 status='published'로 PATCH */
async function publishByIds(ids) {
  const filter = `id=in.(${ids.join(",")})`;
  const res = await fetch(`${baseUrl()}?${filter}`, {
    method: "PATCH",
    headers: {
      ...supabaseHeaders(),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ status: "published" }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase PATCH ${res.status}: ${body}`);
  }
  return res.json();
}

// ─── schedule-log ───────────────────────────────────────────────────────────

function logPath() {
  return path.join(ROOT, "content-input", "schedule-log.json");
}

function loadLog() {
  if (!fs.existsSync(logPath())) return [];
  try {
    return JSON.parse(fs.readFileSync(logPath(), "utf-8"));
  } catch {
    return [];
  }
}

function saveLog(entries) {
  fs.writeFileSync(logPath(), JSON.stringify(entries, null, 2));
}

// ─── main ───────────────────────────────────────────────────────────────────

async function main() {
  loadEnv();

  const isDry = process.argv.includes("--dry");

  console.log(`\n${"=".repeat(60)}`);
  console.log(`예약 발행 전환${isDry ? " [DRY RUN]" : ""}`);
  console.log(`현재 시각: ${new Date().toISOString()}`);
  console.log(`${"=".repeat(60)}`);

  const duePosts = await fetchScheduledDue();

  if (duePosts.length === 0) {
    console.log("\n전환 대상 없음. 종료.");
    return;
  }

  console.log(`\n전환 대상: ${duePosts.length}편`);
  console.log(`${"─".repeat(60)}`);

  for (const post of duePosts) {
    console.log(`  [${post.category}] ${post.title}`);
    console.log(`    slug: ${post.slug}`);
    console.log(`    published_at: ${post.published_at}`);
  }

  if (isDry) {
    console.log(`\n[DRY RUN] 변경 없이 종료.`);
    return;
  }

  // 일괄 전환
  const ids = duePosts.map(p => p.id);
  const updated = await publishByIds(ids);

  console.log(`\n${updated.length}편 published 전환 완료.`);

  // 로그 기록
  const log = loadLog();
  const entry = {
    executedAt: new Date().toISOString(),
    count: updated.length,
    posts: duePosts.map(p => ({
      slug: p.slug,
      title: p.title,
      published_at: p.published_at,
    })),
  };
  log.push(entry);

  // 최근 100건만 유지
  if (log.length > 100) log.splice(0, log.length - 100);
  saveLog(log);

  console.log(`로그 저장: content-input/schedule-log.json`);
  console.log(`\n${"=".repeat(60)}`);
}

main().catch((err) => {
  console.error(`auto-schedule 오류: ${err.message}`);
  process.exit(1);
});
