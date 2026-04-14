#!/usr/bin/env node
/**
 * 수기 주제 등록 공식 헬퍼
 *
 * 팀 에이전트가 경쟁사 분석·사용자 요청으로 주제를 만들었을 때 사용.
 * 반드시 이 스크립트를 경유해야 키워드 DB 매핑이 자동 수행된다.
 * topic-queue.json에 직접 수기 INSERT는 금지.
 *
 * Usage:
 *   # JSON 파일 형식:
 *   # [{ "topic": "...", "angle": "...", "keywords": ["...", "..."], "slugHint": "..." }, ...]
 *   node scripts/enqueue-topics.mjs --affiliate 키퍼메이트 --from-file /tmp/topics.json
 *
 *   # 매핑만 확인 (큐 추가 안 함)
 *   node scripts/enqueue-topics.mjs --affiliate 키퍼메이트 --from-file /tmp/topics.json --dry
 *
 *   # score < 20도 강제 등록
 *   node scripts/enqueue-topics.mjs --affiliate 키퍼메이트 --from-file /tmp/topics.json --force-unscored
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadKeywordDB, findBestMatchForTopic } from "./lib/keyword-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

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

// ─── queue I/O ──────────────────────────────────────────────────────────

function loadQueue() {
  const queuePath = path.join(ROOT, "content-input", "topic-queue.json");
  if (!fs.existsSync(queuePath)) {
    return { updatedAt: new Date().toISOString().slice(0, 10), queue: {} };
  }
  return JSON.parse(fs.readFileSync(queuePath, "utf-8"));
}

function saveQueue(queue) {
  const queuePath = path.join(ROOT, "content-input", "topic-queue.json");
  queue.updatedAt = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));
}

// ─── 중복 체크 (discover-topics.mjs와 동일 로직) ────────────────────────

function normalize(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function overlapRatio(a, b) {
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  if (shorter.length < 4) return 0;
  let matches = 0;
  for (let i = 0; i <= shorter.length - 4; i++) {
    if (longer.includes(shorter.slice(i, i + 4))) matches++;
  }
  return matches / Math.max(1, shorter.length - 3);
}

function isDuplicate(topic, existing) {
  const needle = normalize(topic);
  if (!needle) return true;
  for (const prev of existing) {
    const hay = normalize(prev);
    if (!hay) continue;
    if (hay.includes(needle) || needle.includes(hay)) return true;
    if (overlapRatio(needle, hay) >= 0.7) return true;
  }
  return false;
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
    fromFile: get("--from-file"),
    dry: args.includes("--dry"),
    forceUnscored: args.includes("--force-unscored"),
    minScore: parseInt(get("--min-score") || "20", 10),
  };
}

async function main() {
  loadEnv();
  const opts = parseArgs();

  if (!opts.affiliate || !opts.fromFile) {
    console.error(`
사용법:
  node scripts/enqueue-topics.mjs --affiliate <이름> --from-file <JSON 경로> [--dry] [--force-unscored]

JSON 형식:
  [
    { "topic": "...", "angle": "...", "keywords": ["...", "..."], "slugHint": "..." }
  ]
`);
    process.exit(1);
  }

  if (!fs.existsSync(opts.fromFile)) {
    throw new Error(`파일 없음: ${opts.fromFile}`);
  }

  const input = JSON.parse(fs.readFileSync(opts.fromFile, "utf-8"));
  if (!Array.isArray(input)) {
    throw new Error("JSON은 주제 배열이어야 한다.");
  }

  const db = loadKeywordDB(ROOT);
  const queue = loadQueue();
  const existing = (queue.queue[opts.affiliate] ?? []).map((t) => t.topic);
  const now = new Date().toISOString();

  console.log(`\n${"═".repeat(60)}`);
  console.log(`주제 등록 [${opts.affiliate}]${opts.dry ? " [DRY]" : ""}`);
  console.log(`  DB 키워드: ${db.size}개 / 입력 주제: ${input.length}개 / min-score: ${opts.minScore}`);
  console.log(`${"═".repeat(60)}\n`);

  let accepted = 0;
  let rejectedScore = 0;
  let rejectedDup = 0;
  const toAppend = [];

  for (const item of input) {
    if (!item.topic) {
      console.warn(`  [skip] topic 필드 없음: ${JSON.stringify(item).slice(0, 80)}`);
      continue;
    }

    if (isDuplicate(item.topic, existing)) {
      console.log(`  [중복] ${item.topic}`);
      rejectedDup++;
      continue;
    }

    const keywords = Array.isArray(item.keywords) ? item.keywords : [];
    const match = findBestMatchForTopic(db, {
      topic: item.topic,
      tags: keywords,
      keywords,
    });
    const score = match?.score ?? 0;

    if (!opts.forceUnscored && score < opts.minScore) {
      console.log(
        `  [미달] ${item.topic} → score ${score} < ${opts.minScore}` +
          (match ? ` (매칭: ${match.keyword})` : " (DB 매칭 실패)")
      );
      rejectedScore++;
      continue;
    }

    const entry = {
      topic: item.topic,
      angle: item.angle ?? "",
      keywords,
      slugHint: item.slugHint ?? "",
      status: "pending",
      discoveredAt: now,
      source: item.source ?? "manual-enqueue",
      rationale: item.rationale ?? "",
      opportunityScore: score,
      bestMatch: match,
    };

    const matchInfo = match
      ? `[${match.keyword} total=${match.total} comp=${match.comp} score=${match.score}]`
      : "[매칭 실패, force-unscored]";
    console.log(`  [추가] ${item.topic} ${matchInfo}`);

    toAppend.push(entry);
    existing.push(item.topic);
    accepted++;
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`결과: 추가 ${accepted} / 중복 ${rejectedDup} / 점수 미달 ${rejectedScore}`);
  console.log(`${"═".repeat(60)}`);

  if (opts.dry) {
    console.log(`\n[DRY] 큐 저장 없이 종료`);
    return;
  }

  if (toAppend.length > 0) {
    if (!queue.queue[opts.affiliate]) queue.queue[opts.affiliate] = [];
    queue.queue[opts.affiliate].push(...toAppend);
    saveQueue(queue);
    console.log(`\n  topic-queue.json 업데이트 완료`);
  }
}

main().catch((err) => {
  console.error(`\n오류: ${err.message}`);
  process.exit(1);
});
