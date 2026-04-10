#!/usr/bin/env node
/**
 * 콘텐츠 큐 자동 보충 스크립트
 *
 * 1. 각 어필리에이트의 미발행 초안 수를 Supabase에서 조회
 * 2. 임계치 미달이면 topic-queue.json에서 pending 주제를 꺼내 generate-content.mjs 호출
 * 3. --force 모드: 큐 상태 무관하게 각 어필리에이트 N편씩 강제 생성
 * 4. --dry 모드: 현재 큐 상태만 출력
 *
 * Usage:
 *   node scripts/research-and-queue.mjs                   # 미발행 < 3편이면 1편씩 채움
 *   node scripts/research-and-queue.mjs --target 5        # 미발행 < 5편이면 채움
 *   node scripts/research-and-queue.mjs --force --count 2 # 강제로 각 어필리에이트 2편씩
 *   node scripts/research-and-queue.mjs --dry             # 큐 상태 출력만
 *   node scripts/research-and-queue.mjs --auto-release    # 생성 후 바로 발행
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const DEFAULT_TARGET_UNPUBLISHED = 3;

// ─── env ────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.+)$/);
    if (match) {
      const key = match[1].trim();
      if (!process.env[key]) {
        process.env[key] = match[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  }
}

// ─── affiliates.json ────────────────────────────────────────────────────

function loadAffiliates() {
  const filePath = path.join(ROOT, "content-input", "affiliates.json");
  return JSON.parse(fs.readFileSync(filePath, "utf-8")).affiliates ?? [];
}

// ─── topic-queue.json ───────────────────────────────────────────────────

function loadQueue() {
  const queuePath = path.join(ROOT, "content-input", "topic-queue.json");
  if (!fs.existsSync(queuePath)) {
    throw new Error(`topic-queue.json 없음: ${queuePath}`);
  }
  return JSON.parse(fs.readFileSync(queuePath, "utf-8"));
}

// ─── Supabase 발행 slug 조회 ────────────────────────────────────────────

async function fetchPublishedSlugs() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.warn("  [WARN] Supabase env 없음 — 발행 여부 확인 스킵");
    return new Set();
  }

  const endpoint = `${supabaseUrl}/rest/v1/posts?select=slug&status=eq.published`;
  const response = await fetch(endpoint, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!response.ok) {
    console.warn(`  [WARN] Supabase 조회 실패 ${response.status} — 발행 여부 확인 스킵`);
    return new Set();
  }
  const rows = await response.json();
  return new Set(rows.map((r) => r.slug));
}

// ─── 로컬 마크다운 파일 스캔 ────────────────────────────────────────────

function scanLocalMarkdown(affiliate) {
  const dirPath = path.join(ROOT, affiliate.contentDir);
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const raw = fs.readFileSync(path.join(dirPath, f), "utf-8");
      const slugMatch = raw.match(/^slug:\s*["']?([^"'\n]+)["']?/m);
      return { filename: f, slug: slugMatch ? slugMatch[1].trim() : null };
    });
}

// ─── 큐 상태 분석 ────────────────────────────────────────────────────────

async function analyzeQueue(affiliates, queue, publishedSlugs) {
  const report = [];

  for (const aff of affiliates) {
    const localFiles = scanLocalMarkdown(aff);
    const unpublishedLocal = localFiles.filter((f) => f.slug && !publishedSlugs.has(f.slug));
    const topics = queue.queue[aff.name] ?? [];
    const pendingTopics = topics.filter((t) => t.status === "pending");
    const generatedTopics = topics.filter((t) => t.status === "generated");

    report.push({
      name: aff.name,
      totalLocal: localFiles.length,
      unpublishedLocal: unpublishedLocal.length,
      pendingTopics: pendingTopics.length,
      generatedTopics: generatedTopics.length,
      pending: pendingTopics,
    });
  }

  return report;
}

// ─── generate-content 호출 ──────────────────────────────────────────────

function runGenerate({ affiliate, autoRelease }) {
  const flags = ["--from-queue", `--affiliate ${affiliate}`];
  if (autoRelease) flags.push("--auto-release");
  const cmd = `node scripts/generate-content.mjs ${flags.join(" ")}`;
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
}

// ─── CLI ────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : null;
  };
  return {
    force: args.includes("--force"),
    dry: args.includes("--dry"),
    autoRelease: args.includes("--auto-release"),
    target: parseInt(get("--target") || String(DEFAULT_TARGET_UNPUBLISHED), 10),
    count: parseInt(get("--count") || "1", 10),
  };
}

async function main() {
  loadEnv();
  const opts = parseArgs();

  console.log(`\n${"═".repeat(60)}`);
  console.log(`콘텐츠 큐 보충 ${opts.force ? "[FORCE]" : ""}${opts.dry ? "[DRY]" : ""}`);
  console.log(`${"═".repeat(60)}`);

  const affiliates = loadAffiliates();
  const queue = loadQueue();
  const publishedSlugs = await fetchPublishedSlugs();

  const report = await analyzeQueue(affiliates, queue, publishedSlugs);

  console.log(`\n현재 상태:`);
  for (const row of report) {
    console.log(
      `  [${row.name}] 로컬 ${row.totalLocal}편 / 미발행 ${row.unpublishedLocal}편 / 큐 pending ${row.pendingTopics}개 / generated ${row.generatedTopics}개`
    );
  }

  if (opts.dry) {
    console.log(`\n[DRY] 생성 없이 종료.`);
    return;
  }

  const tasks = [];

  for (const row of report) {
    let needed = 0;
    if (opts.force) {
      needed = opts.count;
    } else if (row.unpublishedLocal < opts.target) {
      needed = Math.min(opts.target - row.unpublishedLocal, row.pendingTopics);
    }

    if (needed === 0) {
      console.log(`  [${row.name}] 충분함 (미발행 ${row.unpublishedLocal} ≥ 목표 ${opts.target})`);
      continue;
    }

    const available = Math.min(needed, row.pendingTopics);
    if (available < needed) {
      console.log(
        `  [${row.name}] 큐 부족: 필요 ${needed}편 / pending ${row.pendingTopics}편 — pending ${available}편만 생성`
      );
    }

    for (let i = 0; i < available; i++) {
      tasks.push({ affiliate: row.name });
    }
  }

  if (tasks.length === 0) {
    console.log(`\n추가 생성 필요 없음. 종료.`);
    return;
  }

  console.log(`\n생성 대기: ${tasks.length}편`);

  for (const task of tasks) {
    try {
      runGenerate({ affiliate: task.affiliate, autoRelease: opts.autoRelease });
    } catch (err) {
      console.error(`  [실패] ${task.affiliate}: ${err.message}`);
    }
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`큐 보충 완료: ${tasks.length}편 처리`);
  console.log(`${"═".repeat(60)}`);
}

main().catch((err) => {
  console.error(`\n오류: ${err.message}`);
  process.exit(1);
});
