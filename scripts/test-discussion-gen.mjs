#!/usr/bin/env node
/**
 * Phase 8.5 토론 생성 테스트 스크립트
 *
 * Usage:
 *   npx tsx scripts/test-discussion-gen.mjs <post-slug>
 *   npx tsx scripts/test-discussion-gen.mjs --dry <post-slug>
 *
 * 단일 포스트에 대해 댓글 생성 결과를 확인한다.
 * --dry 모드: 페르소나만 선정하고 실제 Gemini 호출/DB 쓰기 없이 드라이런.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

loadEnvSync();

const rawArgs = process.argv.slice(2);
const dryRun = rawArgs.includes("--dry");
const forceAgeIdx = rawArgs.findIndex((arg) => arg === "--force-age");
const forceAgeDays =
  forceAgeIdx >= 0 ? Number(rawArgs[forceAgeIdx + 1]) : undefined;
const slug = rawArgs.find(
  (arg, idx) =>
    !arg.startsWith("--") &&
    !(forceAgeIdx >= 0 && idx === forceAgeIdx + 1)
);

if (!slug) {
  console.error("사용법: npx tsx scripts/test-discussion-gen.mjs [--dry] <post-slug>");
  process.exit(1);
}

// env 로드 이후에 ts 모듈을 import — tsx 런타임이 ts 확장자를 지원한다.
const { getPostBySlug } = await import(path.join(ROOT, "src/lib/db.ts"));
const { selectPersonasForPost } = await import(
  path.join(ROOT, "src/lib/discussion-db.ts")
);
const { generateDiscussionsForPost } = await import(
  path.join(ROOT, "src/lib/discussion-generator.ts")
);
const { selectTemplate } = await import(
  path.join(ROOT, "src/lib/discussion-templates.ts")
);

async function main() {
  const originalPost = await getPostBySlug(slug);
  if (!originalPost) {
    console.error(`[test-discussion-gen] 포스트를 찾을 수 없습니다: ${slug}`);
    process.exit(1);
  }
  const post = { ...originalPost };
  if (forceAgeDays !== undefined && Number.isFinite(forceAgeDays)) {
    const adjusted = new Date(
      Date.now() - forceAgeDays * 24 * 60 * 60 * 1000
    ).toISOString();
    post.published_at = adjusted;
    process.stdout.write(
      `force-age: ${forceAgeDays} days → published_at=${adjusted}\n`
    );
  }
  process.stdout.write(`target: ${post.slug} / ${post.title}\n`);

  const template = selectTemplate(0);
  const personas = await selectPersonasForPost(post.slug, template.slots.length + 3);
  process.stdout.write(
    `template: ${template.id} (slots=${template.slots.length})\n`
  );
  process.stdout.write(
    `selected personas (${personas.length}): ${personas
      .map((p) => `${p.nickname}[${p.behavior_type}]`)
      .join(", ")}\n`
  );

  if (dryRun) {
    process.stdout.write(`\n--- dry run slot plan ---\n`);
    for (const slot of template.slots) {
      process.stdout.write(
        `  ${slot.role} depth=${slot.depth} tier=${slot.qualityTier} behaviorFilter=${
          slot.behaviorFilter?.join("|") ?? "any"
        }\n`
      );
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

function loadEnvSync() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.+)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

main().catch((error) => {
  console.error("[test-discussion-gen] 실패:", error);
  process.exit(1);
});
