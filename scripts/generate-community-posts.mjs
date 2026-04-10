#!/usr/bin/env node
/**
 * Phase 9.0 소통 커뮤니티 AI 시딩 CLI
 *
 * Usage:
 *   node scripts/generate-community-posts.mjs                       # 카테고리별 3개 + 댓글 3개
 *   node scripts/generate-community-posts.mjs --per-category 5       # 카테고리당 N개
 *   node scripts/generate-community-posts.mjs --comments 4           # 게시글당 댓글 N개
 *   node scripts/generate-community-posts.mjs --category free,qna    # 특정 카테고리만
 *   node scripts/generate-community-posts.mjs --dry-run              # DB 쓰기 없이 확인만
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

loadEnv();

const args = parseArgs(process.argv.slice(2));
const PER_CATEGORY = clampInt(args["per-category"], 3, 1, 10);
const COMMENTS_PER_POST = clampInt(args.comments, 3, 0, 8);
const DRY_RUN = Boolean(args["dry-run"]);
const CATEGORY_FILTER = parseCategoryFilter(args.category);

async function main() {
  const { runCommunitySeed } = await loadModule("src/lib/community-seed.ts");

  process.stdout.write(
    `[generate-community-posts] per-category=${PER_CATEGORY} comments=${COMMENTS_PER_POST} dry-run=${DRY_RUN}\n`
  );

  const outcome = await runCommunitySeed({
    postsPerCategory: PER_CATEGORY,
    commentsPerPost: COMMENTS_PER_POST,
    dryRun: DRY_RUN,
    categories: CATEGORY_FILTER,
  });

  process.stdout.write(
    `[generate-community-posts] posts=${outcome.postsCreated} comments=${outcome.commentsCreated} errors=${outcome.errors.length}\n`
  );
  if (outcome.errors.length > 0) {
    for (const err of outcome.errors) {
      process.stdout.write(`  - ${err}\n`);
    }
  }
}

function parseCategoryFilter(raw) {
  if (!raw || typeof raw !== "string") return undefined;
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts : undefined;
}

function clampInt(raw, fallback, min, max) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.+)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      index += 1;
    }
  }
  return out;
}

async function loadModule(relPath) {
  const tsxLoader = await import("tsx/esm/api").catch(() => null);
  if (tsxLoader?.tsImport) {
    return tsxLoader.tsImport(path.join(ROOT, relPath), import.meta.url);
  }
  throw new Error(
    "tsx 로더가 필요합니다. `npm install -D tsx` 후 `npx tsx scripts/generate-community-posts.mjs` 로 실행하세요."
  );
}

main().catch((error) => {
  console.error("[generate-community-posts] 실패:", error);
  process.exit(1);
});
