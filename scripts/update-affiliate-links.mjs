#!/usr/bin/env node
/**
 * 어필리에이트 링크 일괄 교체 (로컬 .md + Supabase DB)
 *
 * 교체 규칙:
 *  - keeper.ceo/** → https://keeper.ceo/security?ref=89S42E
 *  - corp.apply.kr/** 또는 k-startbiz.org/** → https://k-startbiz.org/?ref=STARTBIZ_CYM
 *
 * 단, `## 출처` 섹션(다음 H2 전까지)은 건드리지 않는다.
 * frontmatter의 `url:` 필드는 교체 대상 — affiliate root URL로 통일.
 *
 * Usage:
 *   node scripts/update-affiliate-links.mjs --dry              # 로컬 + DB dry-run
 *   node scripts/update-affiliate-links.mjs --apply            # 로컬 + DB 실제 적용
 *   node scripts/update-affiliate-links.mjs --apply --no-db    # 로컬만
 *   node scripts/update-affiliate-links.mjs --apply --no-fs    # DB만
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const KEEPER_TARGET = "https://keeper.ceo/security?ref=89S42E";
const STARTBIZ_TARGET = "https://k-startbiz.org/?ref=STARTBIZ_CYM";

// 도메인 매칭 패턴 (출처 내부가 아닐 때만 교체)
const KEEPER_URL_RE = /https?:\/\/(?:www\.)?keeper\.ceo[^\s\)\]"'<>]*/g;
const STARTBIZ_URL_RE = /https?:\/\/(?:www\.)?(?:corp\.apply\.kr|k-startbiz\.org)[^\s\)\]"'<>]*/g;

function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) throw new Error(".env.local not found");
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.+)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

function parseArgs(argv) {
  const flags = {
    dry: argv.includes("--dry"),
    apply: argv.includes("--apply"),
    noDb: argv.includes("--no-db"),
    noFs: argv.includes("--no-fs"),
  };
  if (!flags.dry && !flags.apply) flags.dry = true;
  return flags;
}

/**
 * `## 출처` 섹션 범위 [start, end) 반환. 없으면 null.
 * end는 다음 H2(`^## `) 또는 EOF.
 */
function findSourcesRange(text) {
  const re = /^##\s*출처\s*$/m;
  const m = re.exec(text);
  if (!m) return null;
  const start = m.index;
  const after = text.slice(start + m[0].length);
  const nextH2 = after.search(/^##\s+[^#]/m);
  const end = nextH2 === -1 ? text.length : start + m[0].length + nextH2;
  return [start, end];
}

/**
 * 교체 수행. 출처 섹션은 건드리지 않음.
 * frontmatter `url: "..."` 도 교체 대상(affiliate root).
 */
function replaceAffiliateLinks(text, affiliate) {
  const target = affiliate === "keeper" ? KEEPER_TARGET : STARTBIZ_TARGET;
  const re = affiliate === "keeper" ? KEEPER_URL_RE : STARTBIZ_URL_RE;

  const range = findSourcesRange(text);
  if (!range) {
    return text.replace(re, target);
  }
  const [start, end] = range;
  const before = text.slice(0, start).replace(re, target);
  const middle = text.slice(start, end); // 출처 섹션 그대로
  const after = text.slice(end).replace(re, target);
  return before + middle + after;
}

function countMatches(text, affiliate) {
  const re = affiliate === "keeper" ? KEEPER_URL_RE : STARTBIZ_URL_RE;
  const range = findSourcesRange(text);
  const scan = range ? text.slice(0, range[0]) + text.slice(range[1]) : text;
  return (scan.match(re) || []).length;
}

function detectAffiliate(filePath) {
  if (filePath.includes("/키퍼메이트/")) return "keeper";
  if (filePath.includes("/법인설립지원센터/")) return "startbiz";
  return null;
}

function listMdFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(dir, f));
}

async function processLocal(flags) {
  const files = [
    ...listMdFiles(path.join(ROOT, "키퍼메이트/content")),
    ...listMdFiles(path.join(ROOT, "법인설립지원센터/content")),
  ];

  const report = { scanned: 0, changed: 0, replacements: 0, files: [] };
  for (const fp of files) {
    const affiliate = detectAffiliate(fp);
    if (!affiliate) continue;
    report.scanned++;

    const original = fs.readFileSync(fp, "utf-8");
    const replaced = replaceAffiliateLinks(original, affiliate);
    if (original === replaced) continue;

    const diffCount = countMatches(original, affiliate);
    report.changed++;
    report.replacements += diffCount;
    report.files.push({ path: path.relative(ROOT, fp), replacements: diffCount });

    if (flags.apply && !flags.noFs) {
      fs.writeFileSync(fp, replaced, "utf-8");
    }
  }
  return report;
}

async function processPrompts(flags) {
  const prompts = [
    {
      path: path.join(ROOT, "content-input/prompts/키퍼메이트.md"),
      affiliate: "keeper",
    },
    {
      path: path.join(ROOT, "content-input/prompts/법인설립지원센터.md"),
      affiliate: "startbiz",
    },
  ];

  const report = { scanned: 0, changed: 0, replacements: 0, files: [] };
  for (const { path: fp, affiliate } of prompts) {
    if (!fs.existsSync(fp)) continue;
    report.scanned++;
    const original = fs.readFileSync(fp, "utf-8");
    const replaced = replaceAffiliateLinks(original, affiliate);
    if (original === replaced) continue;

    const diffCount = countMatches(original, affiliate);
    report.changed++;
    report.replacements += diffCount;
    report.files.push({ path: path.relative(ROOT, fp), replacements: diffCount });

    if (flags.apply && !flags.noFs) {
      fs.writeFileSync(fp, replaced, "utf-8");
    }
  }
  return report;
}

async function processAffiliatesJson(flags) {
  const fp = path.join(ROOT, "content-input/affiliates.json");
  if (!fs.existsSync(fp)) return null;

  const json = JSON.parse(fs.readFileSync(fp, "utf-8"));
  let changed = false;
  for (const aff of json.affiliates) {
    if (aff.name === "키퍼메이트" && aff.url !== KEEPER_TARGET) {
      aff.url = KEEPER_TARGET;
      changed = true;
    }
    if (aff.name === "법인설립지원센터" && aff.url !== STARTBIZ_TARGET) {
      aff.url = STARTBIZ_TARGET;
      changed = true;
    }
  }
  if (!changed) return { changed: false };
  if (flags.apply && !flags.noFs) {
    fs.writeFileSync(fp, JSON.stringify(json, null, 2) + "\n", "utf-8");
  }
  return { changed: true, path: path.relative(ROOT, fp) };
}

async function processSupabase(flags) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env not loaded");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, slug, status, content")
    .in("status", ["published", "scheduled"]);

  if (error) throw new Error(`Supabase select failed: ${error.message}`);

  const report = { scanned: posts.length, changed: 0, replacements: 0, posts: [] };
  const updates = [];

  for (const post of posts) {
    if (!post.content) continue;
    // 어필리에이트 판정: content 내 도메인 등장 여부
    const hasKeeper = KEEPER_URL_RE.test(post.content);
    KEEPER_URL_RE.lastIndex = 0;
    const hasStartbiz = STARTBIZ_URL_RE.test(post.content);
    STARTBIZ_URL_RE.lastIndex = 0;

    if (!hasKeeper && !hasStartbiz) continue;

    let next = post.content;
    let diffCount = 0;
    if (hasKeeper) {
      const before = next;
      next = replaceAffiliateLinks(next, "keeper");
      diffCount += countMatches(before, "keeper");
    }
    if (hasStartbiz) {
      const before = next;
      next = replaceAffiliateLinks(next, "startbiz");
      diffCount += countMatches(before, "startbiz");
    }

    if (next === post.content) continue;

    report.changed++;
    report.replacements += diffCount;
    report.posts.push({ id: post.id, slug: post.slug, status: post.status, replacements: diffCount });
    updates.push({ id: post.id, content: next });
  }

  if (flags.apply && !flags.noDb && updates.length > 0) {
    // 백업
    const backupDir = path.join(ROOT, "backups");
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFp = path.join(backupDir, `db-content-affiliate-links-${ts}.json`);
    fs.writeFileSync(backupFp, JSON.stringify(posts.filter((p) => updates.find((u) => u.id === p.id)), null, 2), "utf-8");
    report.backup = path.relative(ROOT, backupFp);

    for (const u of updates) {
      const { error: upErr } = await supabase
        .from("posts")
        .update({ content: u.content })
        .eq("id", u.id);
      if (upErr) throw new Error(`UPDATE failed for post ${u.id}: ${upErr.message}`);
    }
  }

  return report;
}

async function main() {
  loadEnv();
  const flags = parseArgs(process.argv.slice(2));
  const mode = flags.apply ? "APPLY" : "DRY-RUN";
  console.log(`\n[update-affiliate-links] mode=${mode} no-db=${flags.noDb} no-fs=${flags.noFs}\n`);

  const localReport = await processLocal(flags);
  console.log(`[로컬 .md] scanned=${localReport.scanned} changed=${localReport.changed} replacements=${localReport.replacements}`);
  for (const f of localReport.files) console.log(`  - ${f.path} (${f.replacements}건)`);

  const promptReport = await processPrompts(flags);
  console.log(`\n[프롬프트] scanned=${promptReport.scanned} changed=${promptReport.changed} replacements=${promptReport.replacements}`);
  for (const f of promptReport.files) console.log(`  - ${f.path} (${f.replacements}건)`);

  const affReport = await processAffiliatesJson(flags);
  if (affReport) {
    console.log(`\n[affiliates.json] changed=${affReport.changed}${affReport.path ? ` path=${affReport.path}` : ""}`);
  }

  if (!flags.noDb) {
    const dbReport = await processSupabase(flags);
    console.log(`\n[Supabase DB] scanned=${dbReport.scanned} changed=${dbReport.changed} replacements=${dbReport.replacements}`);
    for (const p of dbReport.posts.slice(0, 20)) {
      console.log(`  - [${p.status}] ${p.slug} (${p.replacements}건)`);
    }
    if (dbReport.posts.length > 20) console.log(`  ... ${dbReport.posts.length - 20} more`);
    if (dbReport.backup) console.log(`  백업: ${dbReport.backup}`);
  }

  console.log(`\n${mode} 완료.\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
