#!/usr/bin/env node
/**
 * 완전 자율 콘텐츠 루프 오케스트레이터
 *
 * 1. discover-topics.mjs  — 큐 보충 (커뮤니티·경쟁사 분석)
 * 2. research-and-queue.mjs — 초안 생성 (큐 → 마크다운)
 * 3. auto-publish.mjs     — 발행
 * 4. content-input/loop-log.json 기록
 *
 * Usage:
 *   node scripts/content-loop.mjs                    # 1회 풀 루프
 *   node scripts/content-loop.mjs --dry              # 상태 확인만
 *   node scripts/content-loop.mjs --affiliate 키퍼메이트
 *   node scripts/content-loop.mjs --skip-discover    # 발굴 스텝 생략
 *   node scripts/content-loop.mjs --skip-publish     # 발행 스텝 생략
 *   node scripts/content-loop.mjs --publish-count 2  # 발행 편수
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const LOCK_PATH = path.join(ROOT, ".content-loop.lock");

// ─── 중복 실행 방지 (lock file) ──────────────────────────────────────────────

function acquireLock() {
  if (fs.existsSync(LOCK_PATH)) {
    const lockAge = Date.now() - fs.statSync(LOCK_PATH).mtimeMs;
    if (lockAge < 60 * 60 * 1000) { // 1시간 이내 lock이면 중복 실행
      throw new Error(`이미 실행 중 (lock 나이: ${Math.round(lockAge / 60000)}분). ${LOCK_PATH} 삭제 후 재시도.`);
    }
    console.warn("  [lock] 오래된 lock 파일 감지 — 강제 제거");
  }
  fs.writeFileSync(LOCK_PATH, String(process.pid));
}

function releaseLock() {
  if (fs.existsSync(LOCK_PATH)) fs.unlinkSync(LOCK_PATH);
}

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

// ─── queue 상태 요약 ────────────────────────────────────────────────────

function readQueueSummary(affiliateFilter) {
  const queuePath = path.join(ROOT, "content-input", "topic-queue.json");
  if (!fs.existsSync(queuePath)) {
    return { pending: 0, generated: 0, published: 0, byAffiliate: {} };
  }
  const queue = JSON.parse(fs.readFileSync(queuePath, "utf-8"));
  const summary = { pending: 0, generated: 0, published: 0, byAffiliate: {} };

  for (const [name, list] of Object.entries(queue.queue ?? {})) {
    if (affiliateFilter && name !== affiliateFilter) continue;
    const counts = { pending: 0, generated: 0, published: 0 };
    for (const item of list) {
      if (item.status === "pending") counts.pending++;
      else if (item.status === "generated") counts.generated++;
      else if (item.status === "published") counts.published++;
    }
    summary.byAffiliate[name] = counts;
    summary.pending += counts.pending;
    summary.generated += counts.generated;
    summary.published += counts.published;
  }
  return summary;
}

function printSummary(label, summary) {
  console.log(`\n  [${label}]`);
  for (const [name, counts] of Object.entries(summary.byAffiliate)) {
    console.log(
      `    ${name}: pending ${counts.pending} / generated ${counts.generated} / published ${counts.published}`
    );
  }
}

// ─── 스텝 실행 헬퍼 ──────────────────────────────────────────────────────

/**
 * @param {string} label
 * @param {string[]} argv
 * @returns {{ok:boolean, error?:string}}
 */
function runStep(label, argv) {
  const cmd = argv.join(" ");
  console.log(`\n$ ${cmd}`);
  try {
    execSync(cmd, { cwd: ROOT, stdio: "inherit" });
    return { ok: true };
  } catch (err) {
    console.error(`  [${label}] 실패: ${err.message.slice(0, 200)}`);
    return { ok: false, error: err.message.slice(0, 200) };
  }
}

function stepDiscover(opts) {
  const args = ["node", "scripts/discover-topics.mjs"];
  if (opts.affiliate) args.push("--affiliate", opts.affiliate);
  if (opts.force) args.push("--force");
  if (opts.minScore) args.push("--min-score", String(opts.minScore));
  return runStep("discover", args);
}

function stepRefill(opts) {
  const args = ["node", "scripts/research-and-queue.mjs"];
  if (opts.target) args.push("--target", String(opts.target));
  if (opts.affiliate) args.push("--affiliate", opts.affiliate);
  return runStep("refill", args);
}

function stepPublish(opts) {
  const args = ["node", "scripts/auto-publish.mjs"];
  if (opts.publishCount) args.push("--count", String(opts.publishCount));
  return runStep("publish", args);
}

// ─── loop-log.json 기록 ─────────────────────────────────────────────────

function appendLoopLog(entry) {
  const logPath = path.join(ROOT, "content-input", "loop-log.json");
  let log = { runs: [] };
  if (fs.existsSync(logPath)) {
    try {
      log = JSON.parse(fs.readFileSync(logPath, "utf-8"));
      if (!Array.isArray(log.runs)) log.runs = [];
    } catch (err) {
      console.warn(`  [WARN] loop-log.json 파싱 실패 — 새로 생성: ${err.message.slice(0, 80)}`);
      log = { runs: [] };
    }
  }
  log.runs.push(entry);
  if (log.runs.length > 100) log.runs = log.runs.slice(-100);
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
}

// ─── CLI ────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : null;
  };
  return {
    affiliate: get("--affiliate"),
    dry: args.includes("--dry"),
    force: args.includes("--force"),
    skipDiscover: args.includes("--skip-discover"),
    skipRefill: args.includes("--skip-refill"),
    skipPublish: args.includes("--skip-publish"),
    publishCount: parseInt(get("--publish-count") || "1", 10),
    target: parseInt(get("--target") || "3", 10),
    minScore: parseInt(get("--min-score") || "20", 10),
  };
}

async function main() {
  loadEnv();
  const opts = parseArgs();
  const startedAt = new Date().toISOString();

  console.log(`\n${"═".repeat(60)}`);
  console.log(`콘텐츠 루프 ${opts.dry ? "[DRY]" : ""}${opts.affiliate ? ` [${opts.affiliate}]` : ""}`);
  console.log(`  ${startedAt}`);
  console.log(`${"═".repeat(60)}`);

  const before = readQueueSummary(opts.affiliate);
  printSummary("시작 상태", before);

  if (opts.dry) {
    console.log(`\n[DRY] 실행 없이 종료.`);
    return;
  }

  acquireLock();
  process.on("exit", releaseLock);
  process.on("SIGINT", () => { releaseLock(); process.exit(0); });
  process.on("SIGTERM", () => { releaseLock(); process.exit(0); });

  const steps = [];

  if (!opts.skipDiscover) {
    const res = stepDiscover(opts);
    steps.push({ step: "discover", ...res });
  } else {
    console.log(`\n[skip] discover`);
  }

  if (!opts.skipRefill) {
    const res = stepRefill(opts);
    steps.push({ step: "refill", ...res });
  } else {
    console.log(`\n[skip] refill`);
  }

  if (!opts.skipPublish) {
    const res = stepPublish(opts);
    steps.push({ step: "publish", ...res });
  } else {
    console.log(`\n[skip] publish`);
  }

  const after = readQueueSummary(opts.affiliate);
  printSummary("종료 상태", after);

  const finishedAt = new Date().toISOString();

  console.log(`\n${"═".repeat(60)}`);
  console.log(`루프 요약`);
  console.log(`${"═".repeat(60)}`);
  console.log(
    `  pending    ${before.pending} → ${after.pending} (${signed(after.pending - before.pending)})`
  );
  console.log(
    `  generated  ${before.generated} → ${after.generated} (${signed(after.generated - before.generated)})`
  );
  console.log(
    `  published  ${before.published} → ${after.published} (${signed(after.published - before.published)})`
  );
  for (const s of steps) {
    console.log(`  ${s.step}: ${s.ok ? "OK" : `FAIL — ${s.error}`}`);
  }

  appendLoopLog({
    startedAt,
    finishedAt,
    affiliate: opts.affiliate ?? "(all)",
    before,
    after,
    steps,
  });
  console.log(`\n  로그 기록: content-input/loop-log.json`);
}

function signed(n) {
  return n >= 0 ? `+${n}` : `${n}`;
}

main().catch((err) => {
  console.error(`\n오류: ${err.message}`);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
