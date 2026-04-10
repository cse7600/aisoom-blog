#!/usr/bin/env node
/**
 * 콘텐츠 발행 원스톱 스크립트
 * publish-post + generate-image (--inline) 순서대로 실행
 *
 * Usage:
 *   node scripts/release-post.mjs 키퍼메이트/content/post.md
 *   node scripts/release-post.mjs 키퍼메이트/content/post.md --force   # 이미지 재생성
 *   node scripts/release-post.mjs 키퍼메이트/content/post.md --dry     # DB 반영 없이 확인
 *   node scripts/release-post.mjs post.md --no-inline                  # 인라인 이미지 없이
 */

import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
}

const args = process.argv.slice(2);
const files = args.filter((a) => !a.startsWith("--"));
const flags = args.filter((a) => a.startsWith("--"));

if (files.length === 0) {
  console.error(`
사용법:
  node scripts/release-post.mjs 키퍼메이트/content/post.md
  node scripts/release-post.mjs 키퍼메이트/content/post.md --force
  node scripts/release-post.mjs post.md --no-inline
`);
  process.exit(1);
}

const isDry = flags.includes("--dry");
const isForce = flags.includes("--force");
const noInline = flags.includes("--no-inline");

for (const file of files) {
  const rel = path.isAbsolute(file) ? path.relative(ROOT, file) : file;
  console.log(`\n==============================`);
  console.log(`발행: ${rel}`);
  console.log(`==============================`);

  // 1. 발행 (Supabase posts upsert)
  const publishFlags = ["--update", isDry ? "--dry" : ""].filter(Boolean).join(" ");
  run(`node scripts/publish-post.mjs ${rel} ${publishFlags}`);

  if (isDry) {
    console.log("\n[dry 모드] 이미지 생성 건너뜀");
    continue;
  }

  // 2. 이미지 생성 (썸네일 + 인라인)
  const imageFlags = [
    isForce ? "--force" : "",
    noInline ? "" : "--inline",
  ].filter(Boolean).join(" ");
  run(`node scripts/generate-image.mjs ${rel} ${imageFlags}`);
}

console.log("\n모든 발행 완료.");
