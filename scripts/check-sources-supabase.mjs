#!/usr/bin/env node
/**
 * Supabase posts.content 의 `## 출처` 섹션 링크 검증 및 수리
 *
 * Phase 9.7.1
 *
 * Usage:
 *   node scripts/check-sources-supabase.mjs --dry     # diff 리포트만 생성
 *   node scripts/check-sources-supabase.mjs --apply   # 실제 UPDATE 실행
 *   node scripts/check-sources-supabase.mjs --status published,scheduled --dry
 *
 * 실행 전 백업: backups/db-content-{timestamp}.json
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import {
  checkUrl,
  checkUrlsBatch,
  extractSourceSection,
  extractSourceSectionHtml,
  detectContentFormat,
} from "./lib/source-checker.mjs";
import {
  classifyUrl,
  pickReplacement,
  isForeignAnchor,
  AFFILIATE_CATEGORY_MAP,
  CATEGORY_FALLBACK,
} from "./lib/source-registry.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MIN_SOURCES = 3;

function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) throw new Error(".env.local not found");
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.+)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

function parseArgs(argv) {
  const args = { dry: false, apply: false, status: ["published", "scheduled"], limit: null };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--dry") args.dry = true;
    else if (a === "--apply") args.apply = true;
    else if (a === "--status") args.status = argv[++i].split(",").map((s) => s.trim());
    else if (a === "--limit") args.limit = Number(argv[++i]);
    else if (a === "--help" || a === "-h") {
      console.log("Usage: node scripts/check-sources-supabase.mjs [--dry|--apply] [--status published,scheduled] [--limit N]");
      process.exit(0);
    }
  }
  if (!args.dry && !args.apply) args.dry = true; // 안전 기본값
  return args;
}

function isAcceptable(checkResult) {
  if (checkResult.ok) return true;
  if (checkResult.reason === "bot_blocked") {
    const tier = classifyUrl(checkResult.url);
    return tier === "tier1" || tier === "tier2" || tier === "tier3";
  }
  return false;
}

/**
 * 포스트 카테고리 → affiliate fallback category 매핑
 * posts.category 컬럼은 slug 직접 저장 (tech / finance / beauty / home-living / travel)
 */
function guessCategory(post) {
  return post.category ?? "default";
}

async function resolveReplacement(brokenLink, category, existingUrls) {
  // 해외 앵커는 국내 대체가 부적절 → 제거
  if (isForeignAnchor(brokenLink.anchor, brokenLink.url)) {
    return null;
  }

  // pickReplacement는 주제 매칭 실패 시 이미 카테고리 fallback을 포함한다.
  // 단, 주제 매칭 후보만 있고 전부 중복이면 fallback이 없으므로 별도 추가.
  const candidates = pickReplacement(brokenLink.anchor, brokenLink.url, category);
  for (const cand of candidates) {
    if (existingUrls.has(cand.url)) continue;
    const check = await checkUrl(cand.url);
    if (isAcceptable(check)) return { ...cand, check };
  }
  return null;
}

function applyMarkdownEdits(content, edits) {
  const lines = content.split("\n");
  const sorted = [...edits].sort((a, b) => b.lineIndex - a.lineIndex);
  for (const edit of sorted) {
    if (edit.action === "replace") lines[edit.lineIndex] = edit.newLine;
    else if (edit.action === "remove") lines.splice(edit.lineIndex, 1);
    else if (edit.action === "insert") lines.splice(edit.lineIndex, 0, ...edit.lines);
  }
  return lines.join("\n");
}

function applyHtmlEdits(html, edits) {
  const sorted = [...edits].sort((a, b) => b.startIdx - a.startIdx);
  let out = html;
  for (const e of sorted) {
    out = out.slice(0, e.startIdx) + e.replacement + out.slice(e.endIdx);
  }
  return out;
}

async function processPost(post) {
  const content = post.content ?? "";
  const format = detectContentFormat(content);

  const extraction = format === "html"
    ? extractSourceSectionHtml(content)
    : extractSourceSection(content);
  const { links, sectionEnd } = extraction;
  if (links.length === 0) {
    return { postId: post.id, slug: post.slug, status: "no_sources", format };
  }

  const urls = links.map((l) => l.url);
  const checks = await checkUrlsBatch(urls, { concurrency: 3, perHost: 2 });
  const checkMap = new Map(checks.map((c) => [c.url, c]));

  const brokenLinks = [];
  const keepUrls = new Set();
  for (const link of links) {
    const res = checkMap.get(link.url);
    const tier = classifyUrl(link.url);
    if (tier === "blacklist" || !isAcceptable(res)) {
      brokenLinks.push({ ...link, check: res, tier });
    } else {
      keepUrls.add(link.url);
    }
  }

  if (brokenLinks.length === 0) {
    return { postId: post.id, slug: post.slug, status: "ok", totalLinks: links.length, format };
  }

  const category = guessCategory(post);
  const replacements = [];
  const removed = [];
  let nextContent;

  if (format === "html") {
    const htmlEdits = [];
    for (const broken of brokenLinks) {
      const replacement = await resolveReplacement(broken, category, keepUrls);
      if (replacement) {
        const newLink = `<a href="${replacement.url}" target="_blank" rel="noopener noreferrer">${replacement.name}</a>`;
        htmlEdits.push({ startIdx: broken.startIdx, endIdx: broken.endIdx, replacement: newLink });
        keepUrls.add(replacement.url);
        replacements.push({ broken, replacement });
      } else {
        // <li>...</li> 블록 통째로 제거
        const liStart = content.lastIndexOf("<li", broken.startIdx);
        const liEndMatch = content.slice(broken.endIdx).match(/<\/li>/i);
        const liEnd = liEndMatch ? broken.endIdx + liEndMatch.index + liEndMatch[0].length : broken.endIdx;
        const s = liStart >= 0 ? liStart : broken.startIdx;
        let e = liEnd;
        while (e < content.length && /\s/.test(content[e])) e += 1;
        htmlEdits.push({ startIdx: s, endIdx: e, replacement: "" });
        removed.push(broken);
      }
    }

    const remainingCount = links.length - removed.length;
    if (remainingCount < MIN_SOURCES) {
      const needed = MIN_SOURCES - remainingCount;
      const fallback = CATEGORY_FALLBACK[category] ?? CATEGORY_FALLBACK.default;
      const additions = [];
      for (const f of fallback) {
        if (additions.length >= needed) break;
        if (keepUrls.has(f.url)) continue;
        const check = await checkUrl(f.url);
        if (isAcceptable(check)) {
          additions.push(`<li><a href="${f.url}" target="_blank" rel="noopener noreferrer">${f.name}</a></li>`);
          keepUrls.add(f.url);
        }
      }
      if (additions.length > 0) {
        const ulCloseIdx = content.lastIndexOf("</ul>", sectionEnd);
        if (ulCloseIdx > 0) {
          htmlEdits.push({ startIdx: ulCloseIdx, endIdx: ulCloseIdx, replacement: additions.join("") });
        }
      }
    }

    nextContent = applyHtmlEdits(content, htmlEdits);
  } else {
    const edits = [];
    for (const broken of brokenLinks) {
      const replacement = await resolveReplacement(broken, category, keepUrls);
      if (replacement) {
        const newLine = `- [${replacement.name}](${replacement.url})`;
        edits.push({ lineIndex: broken.lineIndex, newLine, action: "replace" });
        keepUrls.add(replacement.url);
        replacements.push({ broken, replacement });
      } else {
        edits.push({ lineIndex: broken.lineIndex, action: "remove" });
        removed.push(broken);
      }
    }

    const remainingCount = links.length - removed.length;
    if (remainingCount < MIN_SOURCES) {
      const needed = MIN_SOURCES - remainingCount;
      const fallback = CATEGORY_FALLBACK[category] ?? CATEGORY_FALLBACK.default;
      const additions = [];
      for (const f of fallback) {
        if (additions.length >= needed) break;
        if (keepUrls.has(f.url)) continue;
        const check = await checkUrl(f.url);
        if (isAcceptable(check)) {
          additions.push(`- [${f.name}](${f.url})`);
          keepUrls.add(f.url);
        }
      }
      if (additions.length > 0) {
        edits.push({ lineIndex: sectionEnd, action: "insert", lines: additions });
      }
    }

    nextContent = applyMarkdownEdits(content, edits);
  }

  return {
    postId: post.id,
    slug: post.slug,
    status: "would_fix",
    format,
    totalLinks: links.length,
    brokenCount: brokenLinks.length,
    removed: removed.length,
    replacements: replacements.map((r) => ({
      fromUrl: r.broken.url,
      toUrl: r.replacement.url,
      toName: r.replacement.name,
    })),
    removedDetails: removed.map((r) => ({
      url: r.url,
      anchor: r.anchor,
      reason: r.check?.reason ?? "unknown",
    })),
    nextContent,
  };
}

async function main() {
  loadEnv();
  const args = parseArgs(process.argv);

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("SUPABASE_URL or SERVICE_ROLE_KEY missing in .env.local");
    process.exit(2);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  console.error(`[check-sources-supabase] status=${args.status.join(",")} mode=${args.apply ? "APPLY" : "DRY-RUN"}`);

  // 1) 대상 포스트 로드
  let query = supabase
    .from("posts")
    .select("id, slug, title, content, status, category")
    .in("status", args.status)
    .order("published_at", { ascending: false });
  if (args.limit) query = query.limit(args.limit);

  const { data: posts, error } = await query;
  if (error) {
    console.error("[check-sources-supabase] query error:", error.message);
    process.exit(2);
  }
  if (!posts || posts.length === 0) {
    console.log("No posts found.");
    return;
  }
  console.error(`[check-sources-supabase] fetched ${posts.length} post(s)`);

  // 2) 백업 (apply 모드에서만)
  if (args.apply) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = path.join(ROOT, "backups");
    fs.mkdirSync(backupDir, { recursive: true });
    const backupFile = path.join(backupDir, `db-content-${ts}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(posts.map((p) => ({ id: p.id, slug: p.slug, content: p.content })), null, 2));
    console.error(`[check-sources-supabase] backup saved: ${path.relative(ROOT, backupFile)}`);
  }

  // 3) 각 포스트 처리
  const results = [];
  for (let i = 0; i < posts.length; i += 1) {
    const post = posts[i];
    try {
      const r = await processPost(post);
      results.push(r);
    } catch (err) {
      results.push({ postId: post.id, slug: post.slug, status: "error", error: err.message });
    }
    process.stderr.write(`\r[check-sources-supabase] ${i + 1}/${posts.length}`);
  }
  process.stderr.write("\n");

  const summary = {
    total: posts.length,
    ok: results.filter((r) => r.status === "ok").length,
    wouldFix: results.filter((r) => r.status === "would_fix").length,
    noSources: results.filter((r) => r.status === "no_sources").length,
    error: results.filter((r) => r.status === "error").length,
  };

  // 4) 리포트 출력
  console.log("");
  console.log("=".repeat(70));
  console.log("SUPABASE SOURCE AUDIT");
  console.log("=".repeat(70));
  console.log(`Mode         : ${args.apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`Total posts  : ${summary.total}`);
  console.log(`All OK       : ${summary.ok}`);
  console.log(`Would fix    : ${summary.wouldFix}`);
  console.log(`No sources   : ${summary.noSources}`);
  console.log(`Errors       : ${summary.error}`);
  console.log("");

  const fixes = results.filter((r) => r.status === "would_fix");
  if (fixes.length > 0) {
    console.log("POSTS NEEDING REPAIR");
    console.log("-".repeat(70));
    for (const f of fixes) {
      console.log(`\n[${f.slug}] broken=${f.brokenCount} removed=${f.removed}`);
      for (const rep of f.replacements) {
        console.log(`  ${rep.fromUrl}`);
        console.log(`  → ${rep.toUrl} (${rep.toName})`);
      }
    }
    console.log("");
  }

  // 5) 리포트 저장
  const reportDir = path.join(ROOT, "reports");
  fs.mkdirSync(reportDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const reportFile = path.join(
    reportDir,
    `supabase-sources-${args.apply ? "applied" : "dry"}-${ts}.json`,
  );
  // content 필드는 너무 크니까 리포트에서 제거
  const reportData = results.map((r) => {
    if (r.nextContent) {
      const { nextContent, ...rest } = r;
      return { ...rest, contentLength: nextContent.length };
    }
    return r;
  });
  fs.writeFileSync(reportFile, JSON.stringify({ summary, details: reportData }, null, 2));
  console.log(`Report saved : ${path.relative(ROOT, reportFile)}`);

  // 6) apply 모드 — UPDATE
  if (args.apply && fixes.length > 0) {
    console.log("");
    console.log("APPLYING UPDATES");
    console.log("-".repeat(70));
    let updated = 0;
    for (const f of fixes) {
      const { error: upErr } = await supabase
        .from("posts")
        .update({ content: f.nextContent, updated_at: new Date().toISOString() })
        .eq("id", f.postId);
      if (upErr) {
        console.error(`  FAIL ${f.slug}: ${upErr.message}`);
      } else {
        updated += 1;
        console.log(`  OK   ${f.slug}`);
      }
    }
    console.log(`\nUpdated: ${updated}/${fixes.length}`);
  }

  if (!args.apply && fixes.length > 0) {
    console.log("To apply: node scripts/check-sources-supabase.mjs --apply");
  }

  process.exit(summary.error > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[check-sources-supabase] fatal:", err);
  process.exit(2);
});
