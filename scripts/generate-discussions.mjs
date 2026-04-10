#!/usr/bin/env node
/**
 * Phase 8.5 AI 토론 자동 생성 CLI
 *
 * Usage:
 *   node scripts/generate-discussions.mjs                 # 우선순위 상위 3개
 *   node scripts/generate-discussions.mjs --limit 5       # 최대 N개 처리
 *   node scripts/generate-discussions.mjs --slug foo-bar  # 특정 포스트 지정
 *   node scripts/generate-discussions.mjs --dry-run       # DB 쓰기 없이 결과만 출력
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

loadEnv();

const args = parseArgs(process.argv.slice(2));
const LIMIT = Math.max(1, Math.min(10, Number(args.limit ?? 3)));
const DRY_RUN = Boolean(args["dry-run"]);
const ONLY_SLUG = args.slug ?? null;

async function main() {
  const { generateDiscussionsForPost } = await loadModule("src/lib/discussion-generator.ts");
  const { getPostsNeedingDiscussions } = await loadModule("src/lib/discussion-db.ts");
  const { getPostBySlug } = await loadModule("src/lib/db.ts");

  if (ONLY_SLUG) {
    const post = await getPostBySlug(ONLY_SLUG);
    if (!post) {
      console.error(`[generate-discussions] 포스트를 찾을 수 없습니다: ${ONLY_SLUG}`);
      process.exit(1);
    }
    await runForPost(post, generateDiscussionsForPost);
    return;
  }

  const candidates = await getPostsNeedingDiscussions(LIMIT);
  if (candidates.length === 0) {
    process.stdout.write("[generate-discussions] 대상 포스트 없음\n");
    return;
  }

  for (const candidate of candidates) {
    const post = await getPostBySlug(candidate.slug);
    if (!post) continue;
    await runForPost(post, generateDiscussionsForPost);
  }
}

async function runForPost(post, generate) {
  if (DRY_RUN) {
    process.stdout.write(
      `[dry-run] would generate for: ${post.slug} (${post.title})\n`
    );
    return;
  }
  const outcome = await generate({ post });
  process.stdout.write(
    `[generate-discussions] ${post.slug} -> comments=${outcome.commentsCreated}, replies=${outcome.repliesCreated}, errors=${outcome.errors.length}\n`
  );
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
    "tsx 로더가 필요합니다. `npm install -D tsx` 후 `npx tsx scripts/generate-discussions.mjs` 로 실행하세요."
  );
}

main().catch((error) => {
  console.error("[generate-discussions] 실패:", error);
  process.exit(1);
});
