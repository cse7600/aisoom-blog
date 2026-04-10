#!/usr/bin/env node
/**
 * 미발행 초안 자동 발행 스크립트
 *
 * 1. affiliates.json에서 어필리에이트 목록 로드
 * 2. 각 contentDir 스캔 → 마크다운 파일 수집
 * 3. Supabase에서 발행된 slug 조회
 * 4. 미발행 파일 추출 → 키워드 기회점수로 정렬
 * 5. 상위 N개 선택 → release-post.mjs 실행
 * 6. 발행 로그 저장
 *
 * Usage:
 *   node scripts/auto-publish.mjs          # 1개 발행
 *   node scripts/auto-publish.mjs --dry    # 큐 미리보기 (발행 안 함)
 *   node scripts/auto-publish.mjs --count 2 # 2개 발행
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ─── env ────────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) throw new Error(".env.local 없음");
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.+)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

// ─── affiliates.json 로드 ─────────────────────────────────────────────────

function loadAffiliates() {
  const filePath = path.join(ROOT, "content-input", "affiliates.json");
  if (!fs.existsSync(filePath)) {
    throw new Error(`affiliates.json 없음: ${filePath}`);
  }
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return parsed.affiliates ?? [];
}

// ─── frontmatter 파싱 (간이) ──────────────────────────────────────────────

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const yamlStr = match[1];
  const meta = {};
  const lines = yamlStr.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const keyMatch = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (!keyMatch) { i++; continue; }

    const key = keyMatch[1];
    const rest = keyMatch[2].trim();

    if (rest && !rest.startsWith("[") && rest !== "") {
      meta[key] = rest.replace(/^["']|["']$/g, "");
      i++;
      continue;
    }

    if (rest.startsWith("[")) {
      meta[key] = rest
        .replace(/^\[|\]$/g, "")
        .split(",")
        .map(s => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      i++;
      continue;
    }

    // 중첩 객체/배열
    const obj = {};
    const arr = [];
    let isArr = false;
    i++;
    while (i < lines.length && (lines[i].startsWith("  ") || lines[i].startsWith("\t"))) {
      const sub = lines[i].trim();
      if (sub.startsWith("- ")) {
        isArr = true;
        arr.push(sub.slice(2).replace(/^["']|["']$/g, ""));
      } else {
        const sm = sub.match(/^(\w[\w-]*):\s*(.+)$/);
        if (sm) obj[sm[1]] = sm[2].trim().replace(/^["']|["']$/g, "");
      }
      i++;
    }
    meta[key] = isArr ? arr : obj;
  }

  return meta;
}

// ─── 마크다운 파일 스캔 ───────────────────────────────────────────────────

function scanContentFiles(affiliates) {
  const files = [];

  for (const aff of affiliates) {
    const dirPath = path.join(ROOT, aff.contentDir);
    if (!fs.existsSync(dirPath)) {
      console.log(`  [WARN] 디렉토리 없음: ${aff.contentDir}`);
      continue;
    }

    const mdFiles = fs.readdirSync(dirPath).filter(f => f.endsWith(".md"));
    for (const mdFile of mdFiles) {
      const fullPath = path.join(dirPath, mdFile);
      const raw = fs.readFileSync(fullPath, "utf-8");
      const meta = parseFrontmatter(raw);
      if (!meta || !meta.slug) {
        console.log(`  [WARN] frontmatter/slug 없음: ${mdFile}`);
        continue;
      }

      files.push({
        filePath: path.relative(ROOT, fullPath),
        slug: meta.slug,
        title: meta.title ?? mdFile,
        affiliate: aff.name,
        category: aff.category,
        mainKeyword: extractMainKeyword(meta),
      });
    }
  }

  return files;
}

function extractMainKeyword(meta) {
  if (typeof meta.keywords === "object" && !Array.isArray(meta.keywords)) {
    return meta.keywords.main ?? "";
  }
  if (Array.isArray(meta.keywords) && meta.keywords.length > 0) {
    return meta.keywords[0];
  }
  return "";
}

// ─── Supabase 발행된 slug 조회 ────────────────────────────────────────────

async function fetchPublishedSlugs() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const endpoint = `${supabaseUrl}/rest/v1/posts?select=slug&status=eq.published`;

  const response = await fetch(endpoint, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });

  if (!response.ok) {
    throw new Error(`Supabase 조회 실패 ${response.status}`);
  }

  const rows = await response.json();
  return new Set(rows.map(r => r.slug));
}

// ─── 키워드 기회점수 조회 (캐시 우선) ─────────────────────────────────────

function loadKeywordCache() {
  const kwDir = path.join(ROOT, "content-input", "keywords");
  if (!fs.existsSync(kwDir)) return new Map();

  const cache = new Map();
  for (const file of fs.readdirSync(kwDir).filter(f => f.endsWith(".json"))) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(kwDir, file), "utf-8"));
      const keywords = parsed.keywords ?? [];
      for (const kw of keywords) {
        if (kw.keyword && kw.score != null) {
          cache.set(kw.keyword, kw.score);
        }
      }
    } catch {
      // 파싱 실패 무시
    }
  }
  return cache;
}

function buildNaverHeaders(urlPath) {
  const { NAVER_API_KEY: key, NAVER_SA_SECRET: secret, NAVER_ACCOUNT_ID: id } = process.env;
  if (!key || !secret || !id) return null;
  const ts = String(Date.now());
  const sig = crypto.createHmac("sha256", secret).update(`${ts}.GET.${urlPath}`).digest("base64");
  return { "X-Timestamp": ts, "X-API-KEY": key, "X-Customer": id, "X-Signature": sig };
}

async function fetchKeywordScore(keyword) {
  const urlPath = "/keywordstool";
  const headers = buildNaverHeaders(urlPath);
  if (!headers) return 0;

  try {
    const params = new URLSearchParams({ hintKeywords: keyword, showDetail: "1" });
    const response = await fetch(`https://api.naver.com${urlPath}?${params}`, { headers });
    if (!response.ok) return 0;

    const { keywordList } = await response.json();
    if (!keywordList?.length) return 0;

    const exact = keywordList.find(k => k.relKeyword === keyword) ?? keywordList[0];
    const vol = (exact.monthlyPcQcCnt || 0) + (exact.monthlyMobileQcCnt || 0);
    if (vol === 0) return 0;
    const compMap = { "낮음": 40, "중간": 20, "높음": 5 };
    const compScore = compMap[exact.compIdx] ?? 10;
    const volScore = Math.min(60, Math.round((vol / 50000) * 60));
    return volScore + compScore;
  } catch {
    return 0;
  }
}

// ─── 발행 로그 ─────────────────────────────────────────────────────────────

function loadPublishLog() {
  const logPath = path.join(ROOT, "content-input", "publish-log.json");
  if (!fs.existsSync(logPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(logPath, "utf-8"));
  } catch {
    return [];
  }
}

function savePublishLog(log) {
  const logPath = path.join(ROOT, "content-input", "publish-log.json");
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
}

// ─── release 실행 ─────────────────────────────────────────────────────────

function releasePost(filePath) {
  const cmd = `node scripts/release-post.mjs ${filePath}`;
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
}

// ─── main ──────────────────────────────────────────────────────────────────

async function main() {
  loadEnv();

  const args = process.argv.slice(2);
  const isDry = args.includes("--dry");
  const countIdx = args.indexOf("--count");
  const publishCount = countIdx !== -1 ? parseInt(args[countIdx + 1], 10) : 1;

  console.log(`\n${"═".repeat(60)}`);
  console.log(`자동 발행 시작 (${isDry ? "DRY RUN" : `${publishCount}편 발행`})`);
  console.log(`${"═".repeat(60)}`);

  // 1. 어필리에이트 로드
  const affiliates = loadAffiliates();
  console.log(`\n어필리에이트: ${affiliates.map(a => a.name).join(", ")}`);

  // 2. 콘텐츠 파일 스캔
  const allFiles = scanContentFiles(affiliates);
  console.log(`전체 콘텐츠 파일: ${allFiles.length}개`);

  // 3. 발행된 slug 조회
  const publishedSlugs = await fetchPublishedSlugs();
  console.log(`발행 완료: ${publishedSlugs.size}개`);

  // 4. 미발행 필터
  const unpublished = allFiles.filter(f => !publishedSlugs.has(f.slug));
  console.log(`미발행: ${unpublished.length}개`);

  if (unpublished.length === 0) {
    console.log("\n발행할 초안이 없음. 종료.");
    return;
  }

  // 5. 키워드 기회점수 조회
  const kwCache = loadKeywordCache();
  console.log(`\n키워드 점수 산정 중...`);

  for (const file of unpublished) {
    if (!file.mainKeyword) {
      file.keywordScore = 0;
      continue;
    }

    // 캐시에서 먼저 확인
    if (kwCache.has(file.mainKeyword)) {
      file.keywordScore = kwCache.get(file.mainKeyword);
      continue;
    }

    // API 조회 (rate limit 주의)
    file.keywordScore = await fetchKeywordScore(file.mainKeyword);
    await new Promise(r => setTimeout(r, 500));
  }

  // 점수 높은 순 정렬
  unpublished.sort((a, b) => (b.keywordScore ?? 0) - (a.keywordScore ?? 0));

  // 6. 큐 출력
  console.log(`\n${"─".repeat(60)}`);
  console.log("발행 큐 (기회점수 순):");
  console.log(`${"─".repeat(60)}`);

  for (let idx = 0; idx < unpublished.length; idx++) {
    const f = unpublished[idx];
    const marker = idx < publishCount ? ">>>" : "   ";
    console.log(
      `${marker} ${idx + 1}. [${f.affiliate}] ${f.title}`
    );
    console.log(
      `       slug: ${f.slug} | 키워드: ${f.mainKeyword || "-"} | 점수: ${f.keywordScore ?? 0}`
    );
    console.log(
      `       파일: ${f.filePath}`
    );
  }

  if (isDry) {
    console.log(`\n[DRY RUN] 발행 없이 종료.`);
    return;
  }

  // 7. 발행 실행
  const toPublish = unpublished.slice(0, publishCount);
  const publishLog = loadPublishLog();

  for (const file of toPublish) {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`발행 시작: ${file.title}`);
    console.log(`${"═".repeat(60)}`);

    try {
      releasePost(file.filePath);

      publishLog.push({
        slug: file.slug,
        date: new Date().toISOString(),
        affiliate: file.affiliate,
        keyword_score: file.keywordScore ?? 0,
      });

      console.log(`\n발행 완료: ${file.slug}`);
    } catch (err) {
      console.error(`\n발행 실패: ${file.slug} — ${err.message}`);
    }
  }

  // 8. 로그 저장
  savePublishLog(publishLog);
  console.log(`\n발행 로그 저장: content-input/publish-log.json`);
  console.log(`\n${"═".repeat(60)}`);
  console.log(`자동 발행 완료: ${toPublish.length}편 처리`);
}

main().catch((err) => {
  console.error(`자동 발행 오류: ${err.message}`);
  process.exit(1);
});
