#!/usr/bin/env node
/**
 * Phase 9.1 각본 검증 스크립트
 * JSON 파일 + DB 상태를 점검해 페르소나/타이밍/분포 통계 출력.
 *
 * 사용:
 *   node scripts/verify-scripts.mjs                # 로컬 JSON 파일 검증
 *   node scripts/verify-scripts.mjs --db           # DB 조회까지 포함
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCRIPTS_DIR = path.join(ROOT, "content-input", "scripts");

const args = parseArgs(process.argv.slice(2));

main().catch((error) => {
  console.error("[verify-scripts] fatal:", error);
  process.exit(1);
});

async function main() {
  const files = fs
    .readdirSync(SCRIPTS_DIR)
    .filter((name) => name.endsWith(".json"));
  console.log(`[verify-scripts] found ${files.length} scripts\n`);
  const aggregated = buildAggregates(files);
  printCategoryTable(aggregated.byCategory);
  printPersonaTable(aggregated.personaUsage, aggregated.totalUses);
  printDelayTable(aggregated.delayBuckets);
  printCommentCountTable(aggregated.commentCounts);
  printWarnings(aggregated.warnings);
  if (args.db) {
    await verifyDb();
  }
}

function buildAggregates(files) {
  const byCategory = new Map();
  const personaUsage = new Map();
  const delayBuckets = new Map();
  const commentCounts = [];
  const warnings = [];
  let totalUses = 0;
  for (const file of files) {
    const spec = JSON.parse(
      fs.readFileSync(path.join(SCRIPTS_DIR, file), "utf-8")
    );
    byCategory.set(spec.category, (byCategory.get(spec.category) ?? 0) + 1);
    track(personaUsage, spec.author_persona);
    commentCounts.push(spec.comments.length);
    totalUses += 1;
    for (const commentSpec of spec.comments) {
      track(personaUsage, commentSpec.persona);
      totalUses += 1;
      bucketDelay(delayBuckets, commentSpec.delay_minutes);
      if (commentSpec.delay_minutes < 5) {
        warnings.push(
          `${spec.script_code} seq=${commentSpec.sequence} delay<5min risk`
        );
      }
    }
    if (spec.comments.length < 3) {
      warnings.push(`${spec.script_code} comments<3`);
    }
  }
  return { byCategory, personaUsage, delayBuckets, commentCounts, warnings, totalUses };
}

function track(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function bucketDelay(map, minutes) {
  let label;
  if (minutes < 60) label = "0-1h";
  else if (minutes < 180) label = "1-3h";
  else if (minutes < 360) label = "3-6h";
  else if (minutes < 720) label = "6-12h";
  else if (minutes < 1440) label = "12-24h";
  else label = "24h+";
  map.set(label, (map.get(label) ?? 0) + 1);
}

function printCategoryTable(byCategory) {
  console.log("=== 카테고리 분포 ===");
  for (const [category, count] of byCategory) {
    console.log(`  ${category.padEnd(10)} ${count}`);
  }
  console.log("");
}

function printPersonaTable(personaUsage, total) {
  console.log("=== 페르소나 사용 횟수 TOP 15 ===");
  const sorted = [...personaUsage.entries()].sort((a, b) => b[1] - a[1]);
  for (const [name, count] of sorted.slice(0, 15)) {
    const pct = ((count / total) * 100).toFixed(1);
    console.log(`  ${name.padEnd(20)} ${count} (${pct}%)`);
  }
  console.log(`  (총 ${sorted.length}명 사용)\n`);
}

function printDelayTable(delayBuckets) {
  console.log("=== 댓글 지연 분포 ===");
  const order = ["0-1h", "1-3h", "3-6h", "6-12h", "12-24h", "24h+"];
  for (const label of order) {
    const count = delayBuckets.get(label) ?? 0;
    console.log(`  ${label.padEnd(8)} ${"#".repeat(Math.min(count, 40))} ${count}`);
  }
  console.log("");
}

function printCommentCountTable(commentCounts) {
  if (commentCounts.length === 0) return;
  const avg =
    commentCounts.reduce((acc, n) => acc + n, 0) / commentCounts.length;
  const min = Math.min(...commentCounts);
  const max = Math.max(...commentCounts);
  console.log("=== 게시글당 댓글 수 ===");
  console.log(`  avg ${avg.toFixed(1)}, min ${min}, max ${max}\n`);
}

function printWarnings(warnings) {
  if (warnings.length === 0) {
    console.log("=== 경고 ===\n  없음\n");
    return;
  }
  console.log("=== 경고 ===");
  for (const warning of warnings) {
    console.log(`  - ${warning}`);
  }
  console.log("");
}

async function verifyDb() {
  console.log("=== DB 검증 (--db) ===");
  try {
    loadEnv(path.join(ROOT, ".env.local"));
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const [{ count: scriptCount }, { count: cueCount }] = await Promise.all([
      supabase.from("community_scripts").select("id", { count: "exact", head: true }),
      supabase.from("community_script_cues").select("id", { count: "exact", head: true }),
    ]);
    console.log(`  community_scripts: ${scriptCount ?? 0}`);
    console.log(`  community_script_cues: ${cueCount ?? 0}`);
  } catch (error) {
    console.error(`  DB 조회 실패: ${error.message}`);
  }
}

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.+)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

function parseArgs(argv) {
  return { db: argv.includes("--db") };
}
