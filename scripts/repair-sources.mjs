#!/usr/bin/env node
/**
 * 로컬 마크다운 파일의 `## 출처` 섹션 링크 수리
 *
 * Phase 9.7.1
 *
 * 동작:
 *   1. verify-sources와 동일한 스캔 + 검증
 *   2. 실패 URL에 대해 source-registry.pickReplacement()로 대체 후보 생성
 *   3. 대체 후보 URL도 재검증 (HTTP 200 또는 tier1/2 bot_blocked 허용)
 *   4. --apply 시 파일 직접 수정, 이전에 backups/markdown-{timestamp}/ 원본 저장
 *   5. 대체 실패 시 해당 출처 라인 제거 (단, 출처 최소 3개 보장)
 *
 * Usage:
 *   node scripts/repair-sources.mjs            # dry-run
 *   node scripts/repair-sources.mjs --apply    # 실제 수정
 *   node scripts/repair-sources.mjs --affiliate 키퍼메이트 --apply
 *   node scripts/repair-sources.mjs --file 키퍼메이트/content/xxx.md --apply
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { checkUrl, checkUrlsBatch, extractSourceSection } from "./lib/source-checker.mjs";
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

function parseArgs(argv) {
  const args = { apply: false, affiliate: null, file: null, verbose: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--apply") args.apply = true;
    else if (a === "--affiliate") args.affiliate = argv[++i];
    else if (a === "--file") args.file = argv[++i];
    else if (a === "--verbose") args.verbose = true;
    else if (a === "--help" || a === "-h") {
      console.log("Usage: node scripts/repair-sources.mjs [--apply] [--affiliate 이름] [--file 경로]");
      process.exit(0);
    }
  }
  return args;
}

function loadAffiliates(filter) {
  const file = path.join(ROOT, "content-input", "affiliates.json");
  const json = JSON.parse(fs.readFileSync(file, "utf-8"));
  const all = json.affiliates ?? [];
  return filter ? all.filter((a) => a.name === filter) : all;
}

function collectMarkdownFiles(contentDir) {
  const abs = path.join(ROOT, contentDir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(abs, f));
}

/**
 * URL이 수용 가능한지 (ok=true OR tier1/2 bot_blocked)
 */
function isAcceptable(checkResult) {
  if (checkResult.ok) return true;
  if (checkResult.reason === "bot_blocked") {
    const tier = classifyUrl(checkResult.url);
    return tier === "tier1" || tier === "tier2" || tier === "tier3";
  }
  return false;
}

async function resolveReplacement(brokenLink, category, existingUrls) {
  // 해외 앵커는 국내 대체가 부적절 → 제거
  if (isForeignAnchor(brokenLink.anchor, brokenLink.url)) {
    return null;
  }

  const candidates = pickReplacement(brokenLink.anchor, brokenLink.url, category);
  for (const cand of candidates) {
    if (existingUrls.has(cand.url)) continue; // 중복 회피
    const check = await checkUrl(cand.url);
    if (isAcceptable(check)) {
      return { ...cand, check };
    }
  }
  // pickReplacement가 주제 매칭 실패 시 이미 category fallback을 반환하므로
  // 여기까지 오면 fallback도 전부 중복 또는 실패한 상태. 추가 시도 불필요.
  return null;
}

/**
 * 파일 본문에서 특정 라인을 대체 또는 제거
 */
function rewriteFile(content, edits) {
  const lines = content.split("\n");
  // edits: [{lineIndex, newLine|null, action:"replace"|"remove"}]
  // lineIndex 큰 것부터 처리 (remove가 인덱스를 밀어내지 않도록)
  const sorted = [...edits].sort((a, b) => b.lineIndex - a.lineIndex);
  for (const edit of sorted) {
    if (edit.action === "replace") {
      lines[edit.lineIndex] = edit.newLine;
    } else if (edit.action === "remove") {
      lines.splice(edit.lineIndex, 1);
    }
  }
  return lines.join("\n");
}

async function processFile(filePath, affiliateName, args) {
  const content = fs.readFileSync(filePath, "utf-8");
  const { links } = extractSourceSection(content);
  if (links.length === 0) return { file: filePath, status: "no_sources" };

  const category = AFFILIATE_CATEGORY_MAP[affiliateName] ?? "default";
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
    return { file: filePath, status: "ok", totalLinks: links.length };
  }

  const edits = [];
  const replacements = [];
  const removedFailures = [];

  for (const broken of brokenLinks) {
    const replacement = await resolveReplacement(broken, category, keepUrls);
    if (replacement) {
      const newLine = `- [${replacement.name}](${replacement.url})`;
      edits.push({ lineIndex: broken.lineIndex, newLine, action: "replace" });
      keepUrls.add(replacement.url);
      replacements.push({ broken, replacement });
    } else {
      // 대체 실패 → 제거
      edits.push({ lineIndex: broken.lineIndex, action: "remove" });
      removedFailures.push(broken);
    }
  }

  // 최소 출처 수 보장
  const remainingCount = links.length - removedFailures.length;
  if (remainingCount < MIN_SOURCES) {
    // 부족분을 카테고리 fallback에서 채움
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
      // 출처 섹션 마지막에 추가
      const { sectionEnd } = extractSourceSection(content);
      const insertAt = sectionEnd === -1 ? content.split("\n").length : sectionEnd;
      edits.push({ lineIndex: insertAt, action: "insert", lines: additions });
    }
  }

  if (!args.apply) {
    return {
      file: filePath,
      status: "would_fix",
      totalLinks: links.length,
      broken: brokenLinks.length,
      replacements,
      removed: removedFailures.length,
      removedDetails: removedFailures.map((r) => ({
        url: r.url,
        anchor: r.anchor,
        reason: r.check?.reason ?? "unknown",
      })),
    };
  }

  // 실제 수정
  const applyEdits = (text, editList) => {
    const lines = text.split("\n");
    const sorted = [...editList].sort((a, b) => b.lineIndex - a.lineIndex);
    for (const edit of sorted) {
      if (edit.action === "replace") lines[edit.lineIndex] = edit.newLine;
      else if (edit.action === "remove") lines.splice(edit.lineIndex, 1);
      else if (edit.action === "insert") lines.splice(edit.lineIndex, 0, ...edit.lines);
    }
    return lines.join("\n");
  };

  const nextContent = applyEdits(content, edits);

  // 백업
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(ROOT, "backups", `markdown-${timestamp}`);
  const relPath = path.relative(ROOT, filePath);
  const backupPath = path.join(backupDir, relPath);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(backupPath, content);

  fs.writeFileSync(filePath, nextContent);
  return {
    file: filePath,
    status: "fixed",
    totalLinks: links.length,
    broken: brokenLinks.length,
    replacements,
    removed: removedFailures.length,
  };
}

async function main() {
  const args = parseArgs(process.argv);

  let targets = []; // [{file, affiliateName}]
  if (args.file) {
    const abs = path.isAbsolute(args.file) ? args.file : path.join(ROOT, args.file);
    // affiliate 이름 역추출
    const affiliates = loadAffiliates(null);
    const matched = affiliates.find((a) => abs.includes(path.sep + a.name + path.sep));
    targets.push({ file: abs, affiliateName: matched?.name ?? "default" });
  } else {
    const affiliates = loadAffiliates(args.affiliate);
    for (const aff of affiliates) {
      for (const f of collectMarkdownFiles(aff.contentDir)) {
        targets.push({ file: f, affiliateName: aff.name });
      }
    }
  }

  console.error(`[repair-sources] processing ${targets.length} file(s), apply=${args.apply}`);

  const summary = { total: targets.length, ok: 0, wouldFix: 0, fixed: 0, noSources: 0 };
  const details = [];

  for (let i = 0; i < targets.length; i += 1) {
    const { file, affiliateName } = targets[i];
    try {
      const result = await processFile(file, affiliateName, args);
      if (result.status === "ok") summary.ok += 1;
      else if (result.status === "would_fix") summary.wouldFix += 1;
      else if (result.status === "fixed") summary.fixed += 1;
      else if (result.status === "no_sources") summary.noSources += 1;
      details.push(result);
      if (result.status === "would_fix" || result.status === "fixed") {
        const rel = path.relative(ROOT, file);
        console.log(`\n[${result.status}] ${rel}`);
        console.log(`  total=${result.totalLinks} broken=${result.broken} removed=${result.removed}`);
        for (const rep of result.replacements) {
          console.log(`  REPLACE: ${rep.broken.url}`);
          console.log(`       →   ${rep.replacement.url} (${rep.replacement.name})`);
        }
        if (result.removed > 0 && result.replacements.length < result.broken) {
          console.log(`  (${result.broken - result.replacements.length} link(s) removed without replacement)`);
        }
      }
    } catch (err) {
      console.error(`[repair-sources] ERROR ${file}:`, err.message);
      details.push({ file, status: "error", error: err.message });
    }
    if ((i + 1) % 5 === 0) {
      process.stderr.write(`\r[repair-sources] ${i + 1}/${targets.length}`);
    }
  }
  process.stderr.write("\n");

  console.log("");
  console.log("=".repeat(70));
  console.log("REPAIR SUMMARY");
  console.log("=".repeat(70));
  console.log(`Total files     : ${summary.total}`);
  console.log(`All OK          : ${summary.ok}`);
  console.log(`Would fix       : ${summary.wouldFix}`);
  console.log(`Fixed (applied) : ${summary.fixed}`);
  console.log(`No sources      : ${summary.noSources}`);

  const reportDir = path.join(ROOT, "reports");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportFile = path.join(
    reportDir,
    `repair-sources-${args.apply ? "applied" : "dry"}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  fs.writeFileSync(reportFile, JSON.stringify({ summary, details }, null, 2));
  console.log(`Report saved    : ${path.relative(ROOT, reportFile)}`);
  console.log("");
  if (!args.apply && summary.wouldFix > 0) {
    console.log("To apply changes: node scripts/repair-sources.mjs --apply");
  }
}

main().catch((err) => {
  console.error("[repair-sources] fatal:", err);
  process.exit(2);
});
