#!/usr/bin/env node
/**
 * 콘텐츠 상태 관리 CLI — Claude Code가 내부에서 조회하는 레지스트리
 *
 * Usage:
 *   node scripts/content-status.mjs              # 전체 현황 요약
 *   node scripts/content-status.mjs --affiliate 키퍼메이트
 *   node scripts/content-status.mjs --status draft
 *   node scripts/content-status.mjs --status published
 *   node scripts/content-status.mjs --keywords   # 키워드 매핑 포함
 *   node scripts/content-status.mjs --rebuild    # 레지스트리 재생성
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const REGISTRY_PATH = path.join(ROOT, "content-input", "content-registry.json");

// ── frontmatter 파서 ────────────────────────────────────────────────────────
function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const yaml = match[1];
  const obj = {};
  // title, slug, description, category, date, author, featured
  for (const line of yaml.split("\n")) {
    const m = line.match(/^(\w+):\s*"?([^"]+)"?$/);
    if (m) obj[m[1].trim()] = m[2].trim();
  }
  // affiliate.name
  const affName = yaml.match(/^\s+name:\s*"?([^"]+)"?$/m);
  if (affName) obj.affiliateName = affName[1].trim();
  // keywords.main
  const mainKw = yaml.match(/^\s+main:\s*"?([^"]+)"?$/m);
  if (mainKw) obj.mainKeyword = mainKw[1].trim();
  // tags
  const tagsLine = yaml.match(/^tags:\s*\[([^\]]+)\]/m);
  if (tagsLine) obj.tags = tagsLine[1].split(",").map(t => t.trim().replace(/"/g, ""));
  return obj;
}

// ── 키워드 DB 로드 ──────────────────────────────────────────────────────────
function loadKeywordDb() {
  const kwDir = path.join(ROOT, "content-input", "keywords");
  const db = {};
  if (!fs.existsSync(kwDir)) return db;
  for (const file of fs.readdirSync(kwDir)) {
    if (!file.endsWith(".json")) continue;
    try {
      const d = JSON.parse(fs.readFileSync(path.join(kwDir, file), "utf-8"));
      for (const kw of d.keywords || []) {
        const key = kw.keyword.toLowerCase().replace(/\s+/g, "");
        if (!db[key] || db[key].score < kw.score) {
          db[key] = { keyword: kw.keyword, total: kw.total, score: kw.score, comp: kw.comp };
        }
      }
    } catch (_) {}
  }
  return db;
}

// ── 발행 로그 로드 ──────────────────────────────────────────────────────────
function loadPublishLog() {
  const logPath = path.join(ROOT, "content-input", "publish-log.json");
  if (!fs.existsSync(logPath)) return {};
  try {
    const log = JSON.parse(fs.readFileSync(logPath, "utf-8"));
    const map = {};
    for (const entry of log.published || []) {
      map[entry.slug] = { publishedAt: entry.publishedAt, supabaseId: entry.id };
    }
    return map;
  } catch (_) { return {}; }
}

// ── 레지스트리 빌드 ──────────────────────────────────────────────────────────
function buildRegistry() {
  const kwDb = loadKeywordDb();
  const publishLog = loadPublishLog();
  const affiliatesPath = path.join(ROOT, "content-input", "affiliates.json");
  const affiliates = JSON.parse(fs.readFileSync(affiliatesPath, "utf-8")).affiliates;
  const registry = { builtAt: new Date().toISOString(), posts: [] };

  for (const aff of affiliates) {
    const contentDir = path.join(ROOT, aff.contentDir);
    if (!fs.existsSync(contentDir)) continue;
    for (const file of fs.readdirSync(contentDir)) {
      if (!file.endsWith(".md")) continue;
      const filePath = path.join(contentDir, file);
      const raw = fs.readFileSync(filePath, "utf-8");
      const fm = parseFrontmatter(raw);
      const slug = fm.slug || file.replace(".md", "");
      const pubInfo = publishLog[slug] || null;

      // 키워드 매핑
      const mainKw = (fm.mainKeyword || "").toLowerCase().replace(/\s+/g, "");
      const kwData = kwDb[mainKw] || null;

      // 태그 키워드 매핑 (최고 점수)
      let bestKw = kwData;
      for (const tag of fm.tags || []) {
        const tagKey = tag.toLowerCase().replace(/\s+/g, "");
        const tagKw = kwDb[tagKey];
        if (tagKw && (!bestKw || tagKw.score > bestKw.score)) bestKw = tagKw;
      }

      registry.posts.push({
        affiliate: aff.name,
        slug,
        title: fm.title || "",
        category: fm.category || aff.category,
        status: pubInfo ? "published" : "draft",
        createdAt: fm.date || null,
        publishedAt: pubInfo?.publishedAt || null,
        supabaseId: pubInfo?.supabaseId || null,
        filePath: path.relative(ROOT, filePath),
        keyword: {
          main: fm.mainKeyword || null,
          bestMatch: bestKw ? bestKw.keyword : null,
          total: bestKw ? bestKw.total : null,
          score: bestKw ? bestKw.score : null,
          comp: bestKw ? bestKw.comp : null,
        },
      });
    }
  }

  registry.posts.sort((a, b) => {
    if (a.affiliate !== b.affiliate) return a.affiliate.localeCompare(b.affiliate);
    return (b.keyword.score || 0) - (a.keyword.score || 0);
  });

  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
  return registry;
}

// ── 출력 ──────────────────────────────────────────────────────────────────────
function printSummary(registry, opts = {}) {
  const { affiliateFilter, statusFilter, showKeywords } = opts;
  let posts = registry.posts;
  if (affiliateFilter) posts = posts.filter(p => p.affiliate === affiliateFilter);
  if (statusFilter) posts = posts.filter(p => p.status === statusFilter);

  const byAffiliate = {};
  for (const p of posts) {
    if (!byAffiliate[p.affiliate]) byAffiliate[p.affiliate] = { draft: [], published: [] };
    byAffiliate[p.affiliate][p.status].push(p);
  }

  const totalDraft = posts.filter(p => p.status === "draft").length;
  const totalPub = posts.filter(p => p.status === "published").length;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`콘텐츠 현황 (${registry.builtAt.slice(0, 10)})`);
  console.log(`전체: ${posts.length}편 | 초안: ${totalDraft}편 | 발행: ${totalPub}편`);
  console.log("=".repeat(60));

  for (const [aff, { draft, published }] of Object.entries(byAffiliate)) {
    console.log(`\n▶ ${aff} (초안 ${draft.length} / 발행 ${published.length})`);
    const allPosts = [...published, ...draft];
    for (const p of allPosts) {
      const tag = p.status === "published" ? "[발행]" : "[초안]";
      const kw = p.keyword.score ? `점수:${p.keyword.score} 검색:${p.keyword.total}` : "키워드 미매핑";
      if (showKeywords) {
        console.log(`  ${tag} ${p.slug}`);
        console.log(`        제목: ${p.title.slice(0, 40)}...`);
        console.log(`        키워드: ${p.keyword.main || "-"} (${kw})`);
        if (p.publishedAt) console.log(`        발행일: ${p.publishedAt}`);
      } else {
        const pub = p.publishedAt ? ` → 발행: ${p.publishedAt.slice(0, 10)}` : "";
        console.log(`  ${tag} ${p.slug.slice(0, 45).padEnd(45)} ${kw}${pub}`);
      }
    }
  }

  // 키워드 미매핑 경고
  const unmapped = posts.filter(p => !p.keyword.score);
  if (unmapped.length > 0) {
    console.log(`\n[경고] 키워드 점수 미매핑: ${unmapped.length}편`);
    for (const p of unmapped.slice(0, 5)) {
      console.log(`  - ${p.affiliate}/${p.slug} (키워드: ${p.keyword.main || "없음"})`);
    }
    if (unmapped.length > 5) console.log(`  ... 외 ${unmapped.length - 5}편`);
  }
  console.log("");
}

// ── main ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const rebuild = args.includes("--rebuild");
const showKeywords = args.includes("--keywords");
const affiliateFilter = args.includes("--affiliate") ? args[args.indexOf("--affiliate") + 1] : null;
const statusFilter = args.includes("--status") ? args[args.indexOf("--status") + 1] : null;

let registry;
if (rebuild || !fs.existsSync(REGISTRY_PATH)) {
  process.stderr.write("레지스트리 빌드 중...\n");
  registry = buildRegistry();
  process.stderr.write(`완료: ${registry.posts.length}편 등록\n`);
} else {
  registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
}

printSummary(registry, { affiliateFilter, statusFilter, showKeywords });
