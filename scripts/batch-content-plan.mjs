#!/usr/bin/env node
/**
 * 미발행 마크다운을 스캔하여 scripts/content-schedule.json 생성.
 *
 * 규칙:
 *   - 기준일은 오늘(로컬). `--start YYYY-MM-DD` 로 덮어쓰기 가능.
 *   - 발행일은 1일 간격(기본). `--spacing N` 으로 조정.
 *   - D+2 / D+7 / D+30 후속 일정 자동 계산.
 *   - 이미 schedule 에 있는 slug 는 `done` 배열을 보존하고 날짜만 재할당.
 *   - publish-log.json 또는 posts 테이블 발행 여부는 반영하지 않음 — 계획 파일만 생성.
 *
 * 사용법:
 *   node scripts/batch-content-plan.mjs
 *   node scripts/batch-content-plan.mjs --start 2026-04-13 --spacing 2
 *   node scripts/batch-content-plan.mjs --affiliate 밀리의서재
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCHEDULE_PATH = path.join(ROOT, "scripts", "content-schedule.json");
const AFFILIATE_PATH = path.join(ROOT, "content-input", "affiliates.json");
const REGISTRY_PATH = path.join(ROOT, "content-input", "content-registry.json");

const args = parseArgs(process.argv.slice(2));
const startDate = args.start ? new Date(args.start) : new Date();
const spacing = Number.isFinite(args.spacing) ? args.spacing : 1;

main();

/**
 * 엔트리포인트 — 스캔 후 스케줄 파일 쓰기.
 */
function main() {
  const candidates = collectCandidates(args.affiliate);
  if (candidates.length === 0) {
    console.error("미발행 후보가 없습니다. content-registry.json --rebuild 로 갱신하세요.");
    process.exit(1);
  }
  const existing = loadSchedule();
  const merged = mergeSchedule(existing, candidates, startDate, spacing);
  fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(merged, null, 2));

  console.log(`\n[batch-content-plan] ${candidates.length}건 등록`);
  for (const row of merged.schedule.slice(-candidates.length)) {
    const tag = row.affiliate?.slice(0, 8).padEnd(8) ?? "-";
    console.log(
      `  ${tag} ${row.slug.slice(0, 48).padEnd(48)} ${row.publishAt} → ${row.d30}`,
    );
  }
  console.log(`\n저장: ${path.relative(ROOT, SCHEDULE_PATH)}`);
}

/**
 * 아직 published 상태가 아닌 md 후보를 수집.
 * content-registry.json 이 있으면 거기서, 없으면 affiliates.json contentDir 스캔.
 * @param {string|undefined} affiliateFilter
 * @returns {Array<{slug:string, title:string, affiliate:string, mdPath:string}>}
 */
function collectCandidates(affiliateFilter) {
  if (fs.existsSync(REGISTRY_PATH)) {
    const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
    return registry.posts
      .filter((row) => row.status !== "published")
      .filter((row) => !affiliateFilter || row.affiliate === affiliateFilter)
      .map((row) => ({
        slug: row.slug,
        title: row.title,
        affiliate: row.affiliate,
        mdPath: path.join(ROOT, row.filePath),
      }));
  }
  return scanFilesystem(affiliateFilter);
}

/**
 * registry 가 없을 때 파일시스템 직접 스캔.
 */
function scanFilesystem(affiliateFilter) {
  const affiliates = JSON.parse(fs.readFileSync(AFFILIATE_PATH, "utf-8")).affiliates;
  const result = [];
  for (const aff of affiliates) {
    if (affiliateFilter && aff.name !== affiliateFilter) continue;
    const dir = path.join(ROOT, aff.contentDir);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".md")) continue;
      const filePath = path.join(dir, file);
      const raw = fs.readFileSync(filePath, "utf-8");
      const slugMatch = raw.match(/^slug:\s*"?([^"\n]+)"?/m);
      const titleMatch = raw.match(/^title:\s*"?([^"\n]+)"?/m);
      const slug = slugMatch ? slugMatch[1].trim() : file.replace(/\.md$/, "");
      result.push({
        slug,
        title: titleMatch ? titleMatch[1].trim() : slug,
        affiliate: aff.name,
        mdPath: filePath,
      });
    }
  }
  return result;
}

/**
 * 기존 스케줄과 병합. 기존 엔트리의 done 배열 보존.
 */
function mergeSchedule(existing, candidates, start, spacing) {
  const map = new Map();
  for (const row of existing.schedule ?? []) {
    map.set(row.slug, row);
  }
  let offset = 0;
  for (const cand of candidates) {
    const pubDate = addDays(start, offset * spacing);
    const prev = map.get(cand.slug);
    const done = prev?.done ?? [];
    const mdPath = path.relative(ROOT, cand.mdPath);
    map.set(cand.slug, {
      slug: cand.slug,
      title: cand.title,
      affiliate: cand.affiliate,
      mdPath,
      publishAt: toIsoDate(pubDate),
      d2: toIsoDate(addDays(pubDate, 2)),
      d7: toIsoDate(addDays(pubDate, 7)),
      d30: toIsoDate(addDays(pubDate, 30)),
      done,
      plannedAt: new Date().toISOString(),
    });
    offset += 1;
  }
  return { updatedAt: new Date().toISOString(), schedule: [...map.values()] };
}

function loadSchedule() {
  if (!fs.existsSync(SCHEDULE_PATH)) return { schedule: [] };
  return JSON.parse(fs.readFileSync(SCHEDULE_PATH, "utf-8"));
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseArgs(list) {
  const out = {};
  for (let idx = 0; idx < list.length; idx += 1) {
    const token = list[idx];
    if (token === "--start") out.start = list[++idx];
    else if (token === "--spacing") out.spacing = Number(list[++idx]);
    else if (token === "--affiliate") out.affiliate = list[++idx];
  }
  return out;
}
