#!/usr/bin/env node
/**
 * Phase 9.1 각본 대량 생성기
 * content-input/scripts/ 디렉토리에 초기 50개 JSON 파일을 생성.
 *
 * 사용:
 *   node scripts/generate-scripts.mjs
 *   node scripts/generate-scripts.mjs --start-date=2026-04-15
 *   node scripts/generate-scripts.mjs --force   # 이미 있어도 덮어쓰기
 *
 * 생성 후:
 *   node scripts/import-scripts.mjs             # DB 적재
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SCRIPT_SEEDS } from "./data/script-seeds.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "content-input", "scripts");

const args = parseArgs(process.argv.slice(2));
const startDate = args.startDate
  ? new Date(args.startDate)
  : addDaysKst(new Date(), 1);

main();

function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }
  let written = 0;
  let skipped = 0;
  for (const [index, seed] of SCRIPT_SEEDS.entries()) {
    const fileName = `${seed.script_code}.json`;
    const target = path.join(OUT_DIR, fileName);
    if (fs.existsSync(target) && !args.force) {
      skipped += 1;
      continue;
    }
    const plannedDate = formatKstDate(addDaysKst(startDate, Math.floor(index / 2)));
    const spec = buildSpec(seed, plannedDate);
    fs.writeFileSync(target, JSON.stringify(spec, null, 2), "utf-8");
    written += 1;
  }
  console.log(
    `[generate-scripts] written=${written}, skipped=${skipped}, total=${SCRIPT_SEEDS.length}`
  );
  console.log(`[generate-scripts] out: ${OUT_DIR}`);
}

function buildSpec(seed, plannedDate) {
  return {
    script_code: seed.script_code,
    category: seed.category,
    title: seed.title,
    body: seed.body,
    author_persona: seed.author_persona,
    target_keyword: seed.target_keyword ?? null,
    thumb_variant: seed.thumb_variant ?? "default",
    planned_post_date: plannedDate,
    tags: seed.tags ?? [],
    notes: seed.notes ?? null,
    comments: seed.comments,
  };
}

function addDaysKst(base, days) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function formatKstDate(date) {
  const kst = new Date(date.getTime() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10);
}

function parseArgs(argv) {
  const parsed = { startDate: null, force: false };
  for (const arg of argv) {
    if (arg === "--force") parsed.force = true;
    else if (arg.startsWith("--start-date="))
      parsed.startDate = arg.slice("--start-date=".length);
  }
  return parsed;
}
