#!/usr/bin/env node
/**
 * Phase 8.5 토론 생성 테스트 스크립트
 *
 * Usage:
 *   node scripts/test-discussion-gen.mjs <post-slug>
 *   node scripts/test-discussion-gen.mjs --dry <post-slug>
 *
 * 단일 포스트에 대해 댓글 생성 결과를 확인한다.
 * --dry 모드: 페르소나만 선정하고 실제 Gemini 호출/DB 쓰기 없이 드라이런.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

loadEnv();

const rawArgs = process.argv.slice(2);
const dryRun = rawArgs.includes("--dry");
const slug = rawArgs.find((arg) => !arg.startsWith("--"));

if (!slug) {
  console.error("사용법: node scripts/test-discussion-gen.mjs [--dry] <post-slug>");
  process.exit(1);
}

async function main() {
  const { getPostBySlug } = await loadModule("src/lib/db.ts");
  const { selectPersonasForPost } = await loadModule("src/lib/discussion-db.ts");
  const { generateDiscussionsForPost, buildCommentPrompt } = await loadModule(
    "src/lib/discussion-generator.ts"
  );

  const post = await getPostBySlug(slug);
  if (!post) {
    console.error(`[test-discussion-gen] 포스트를 찾을 수 없습니다: ${slug}`);
    process.exit(1);
  }
  process.stdout.write(`target: ${post.slug} / ${post.title}\n`);

  const personas = await selectPersonasForPost(post.slug, 3);
  process.stdout.write(
    `selected personas (${personas.length}): ${personas.map((p) => p.nickname).join(", ")}\n`
  );

  if (dryRun) {
    if (personas[0]) {
      const sample = buildCommentPrompt(post, personas[0], post.keywords ?? []);
      process.stdout.write(`\n--- sample prompt (${personas[0].nickname}) ---\n`);
      process.stdout.write(sample.slice(0, 600) + "...\n");
    }
    return;
  }

  const outcome = await generateDiscussionsForPost({ post });
  process.stdout.write(
    `\nresult: batch=${outcome.batchId}, comments=${outcome.commentsCreated}, replies=${outcome.repliesCreated}, errors=${outcome.errors.length}\n`
  );
  if (outcome.errors.length > 0) {
    process.stdout.write(`errors: ${outcome.errors.join("; ")}\n`);
  }
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

async function loadModule(relPath) {
  const tsxLoader = await import("tsx/esm/api").catch(() => null);
  if (tsxLoader?.tsImport) {
    return tsxLoader.tsImport(path.join(ROOT, relPath), import.meta.url);
  }
  throw new Error(
    "tsx 로더가 필요합니다. `npm install -D tsx` 후 `npx tsx scripts/test-discussion-gen.mjs ...` 로 실행하세요."
  );
}

main().catch((error) => {
  console.error("[test-discussion-gen] 실패:", error);
  process.exit(1);
});
