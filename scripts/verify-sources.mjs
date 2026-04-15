#!/usr/bin/env node
/**
 * 로컬 마크다운 파일의 `## 출처` 섹션 링크 검증
 *
 * Phase 9.7.1
 *
 * Usage:
 *   node scripts/verify-sources.mjs
 *   node scripts/verify-sources.mjs --affiliate 키퍼메이트
 *   node scripts/verify-sources.mjs --format json
 *   node scripts/verify-sources.mjs --report reports/source-audit.json
 *
 * Exit code:
 *   0 — 모든 링크 정상
 *   1 — 실패 링크 발견
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { checkUrlsBatch, extractSourceSection } from "./lib/source-checker.mjs";
import { classifyUrl } from "./lib/source-registry.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ─────────────────────────────────────────────────────────────
// CLI 파싱
// ─────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { affiliate: null, format: "text", report: null };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--affiliate") args.affiliate = argv[++i];
    else if (a === "--format") args.format = argv[++i];
    else if (a === "--report") args.report = argv[++i];
    else if (a === "--help" || a === "-h") {
      console.log("Usage: node scripts/verify-sources.mjs [--affiliate 이름] [--format json|text] [--report path]");
      process.exit(0);
    }
  }
  return args;
}

// ─────────────────────────────────────────────────────────────
// 어필리에이트 설정 로드
// ─────────────────────────────────────────────────────────────
function loadAffiliates(filter) {
  const file = path.join(ROOT, "content-input", "affiliates.json");
  const json = JSON.parse(fs.readFileSync(file, "utf-8"));
  const all = json.affiliates ?? [];
  return filter ? all.filter((a) => a.name === filter) : all;
}

// ─────────────────────────────────────────────────────────────
// 파일 수집
// ─────────────────────────────────────────────────────────────
function collectMarkdownFiles(contentDir) {
  const abs = path.join(ROOT, contentDir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(abs, f));
}

// ─────────────────────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);
  const affiliates = loadAffiliates(args.affiliate);

  if (affiliates.length === 0) {
    console.error("No affiliates matched.");
    process.exit(1);
  }

  // 1) 전체 파일 스캔 → URL 수집
  const fileLinks = []; // { affiliate, file, anchor, url, lineIndex }
  const urlSet = new Set();

  for (const aff of affiliates) {
    const files = collectMarkdownFiles(aff.contentDir);
    for (const filePath of files) {
      const content = fs.readFileSync(filePath, "utf-8");
      const { links } = extractSourceSection(content);
      for (const link of links) {
        fileLinks.push({
          affiliate: aff.name,
          file: filePath,
          anchor: link.anchor,
          url: link.url,
          lineIndex: link.lineIndex,
        });
        urlSet.add(link.url);
      }
    }
  }

  if (urlSet.size === 0) {
    console.log("No source links found.");
    process.exit(0);
  }

  console.error(`[verify-sources] ${urlSet.size} unique URLs across ${fileLinks.length} link occurrences in ${affiliates.length} affiliate(s)`);

  // 2) 병렬 검증
  const urls = [...urlSet];
  const results = await checkUrlsBatch(urls, {
    concurrency: 5,
    perHost: 2,
    timeoutMs: 10_000,
    onProgress: (done, total) => {
      if (done % 10 === 0 || done === total) {
        process.stderr.write(`\r[verify-sources] checked ${done}/${total}`);
      }
    },
  });
  process.stderr.write("\n");

  const resultMap = new Map(results.map((r) => [r.url, r]));

  // 3) 리포트 생성
  const failed = [];
  const tierDist = { tier1: 0, tier2: 0, tier3: 0, tier4: 0, blacklist: 0, unknown: 0 };

  for (const link of fileLinks) {
    const res = resultMap.get(link.url);
    const tier = classifyUrl(link.url);
    tierDist[tier] = (tierDist[tier] ?? 0) + 1;
    if (!res.ok || tier === "blacklist") {
      failed.push({
        affiliate: link.affiliate,
        file: path.relative(ROOT, link.file),
        anchor: link.anchor,
        url: link.url,
        status: res.status,
        reason: tier === "blacklist" ? "blacklist" : res.reason,
        error: res.error,
        tier,
      });
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    affiliates: affiliates.map((a) => a.name),
    uniqueUrls: urlSet.size,
    totalOccurrences: fileLinks.length,
    failed: failed.length,
    tierDistribution: tierDist,
  };

  // 4) 출력
  if (args.format === "json") {
    console.log(JSON.stringify({ summary, failures: failed }, null, 2));
  } else {
    console.log("");
    console.log("=".repeat(70));
    console.log("SOURCE LINK AUDIT REPORT");
    console.log("=".repeat(70));
    console.log(`Affiliates      : ${summary.affiliates.join(", ")}`);
    console.log(`Unique URLs     : ${summary.uniqueUrls}`);
    console.log(`Occurrences     : ${summary.totalOccurrences}`);
    console.log(`Failures        : ${summary.failed}`);
    console.log(`Tier 1 (gov)    : ${tierDist.tier1}`);
    console.log(`Tier 2 (public) : ${tierDist.tier2}`);
    console.log(`Tier 3 (brand)  : ${tierDist.tier3}`);
    console.log(`Tier 4 (partner): ${tierDist.tier4}`);
    console.log(`Blacklist       : ${tierDist.blacklist}`);
    console.log(`Unknown         : ${tierDist.unknown}`);
    console.log("");

    if (failed.length > 0) {
      console.log("FAILED LINKS");
      console.log("-".repeat(70));
      const byAffiliate = new Map();
      for (const f of failed) {
        if (!byAffiliate.has(f.affiliate)) byAffiliate.set(f.affiliate, []);
        byAffiliate.get(f.affiliate).push(f);
      }
      for (const [name, items] of byAffiliate) {
        console.log(`\n[${name}] ${items.length} failure(s)`);
        for (const f of items) {
          console.log(`  ${f.reason.toUpperCase()} ${f.status ?? "-"} ${f.url}`);
          console.log(`    file   : ${f.file}`);
          console.log(`    anchor : ${f.anchor}`);
          if (f.error) console.log(`    error  : ${f.error}`);
        }
      }
      console.log("");
    }
  }

  // 5) 리포트 파일 저장
  if (args.report) {
    const reportPath = path.resolve(ROOT, args.report);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify({ summary, failures: failed }, null, 2));
    console.error(`[verify-sources] report saved: ${reportPath}`);
  }

  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("[verify-sources] fatal:", err);
  process.exit(2);
});
