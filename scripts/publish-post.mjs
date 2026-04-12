#!/usr/bin/env node
/**
 * 마크다운 파일 → Supabase posts 테이블 발행 스크립트
 *
 * Usage:
 *   node scripts/publish-post.mjs path/to/post.md
 *   node scripts/publish-post.mjs path/to/post1.md path/to/post2.md
 *   node scripts/publish-post.mjs --publish-date 2026-04-15 path/to/post.md
 *
 * --dry: DB 삽입 없이 파싱 결과만 출력
 * --update: 같은 slug가 있으면 덮어쓰기 (없으면 이미 존재 시 스킵)
 * --publish-date YYYY-MM-DD: published_at / created_at 을 지정한 날짜로 강제
 *                             (미지정 시 frontmatter `date` 필드, 없으면 현재 시각)
 * --seed N: 시간 랜덤화 시드 (기본 20260412) — 10:00~13:59 KST 사이 재현 가능 랜덤 시각
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { marked } from "marked";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// marked 설정 — heading에 id 자동 부여
marked.use({
  renderer: {
    heading({ tokens, depth }) {
      const text = tokens.map(t => t.raw).join("");
      const id = slugifyHeading(text);
      return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
    },
  },
});

function slugifyHeading(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s가-힣ㄱ-ㅎㅏ-ㅣ-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

// .env.local 파싱
function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) throw new Error(".env.local 없음");
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.+)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

// YAML frontmatter 파싱 (의존성 없이)
function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error("frontmatter 없음");

  const yamlStr = match[1];
  const content = match[2].trim();

  const meta = {};
  const lines = yamlStr.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const keyMatch = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (!keyMatch) { i++; continue; }

    const key = keyMatch[1];
    const rest = keyMatch[2].trim();

    // 인라인 값
    if (rest && !rest.startsWith("[") && rest !== "") {
      meta[key] = rest.replace(/^["']|["']$/g, "");
      i++;
      continue;
    }

    // 인라인 배열 [a, b, c]
    if (rest.startsWith("[")) {
      meta[key] = rest
        .replace(/^\[|\]$/g, "")
        .split(",")
        .map(s => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      i++;
      continue;
    }

    // 중첩 객체 또는 블록 배열
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
        if (sm) {
          const val = sm[2].trim().replace(/^["']|["']$/g, "");
          // 인라인 배열
          if (val.startsWith("[")) {
            obj[sm[1]] = val
              .replace(/^\[|\]$/g, "")
              .split(",")
              .map(s => s.trim().replace(/^["']|["']$/g, ""))
              .filter(Boolean);
          } else {
            obj[sm[1]] = val;
          }
        }
      }
      i++;
    }
    meta[key] = isArr ? arr : obj;
  }

  return { meta, content };
}

function calcReadTime(text) {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 300));
}

// ─── 날짜/시간 유틸 (KST 기반 발행일 강제) ────────────────────────────────
const KST_OFFSET_MIN = 9 * 60;

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/**
 * YYYY-MM-DD (KST) → UTC ISO 문자열.
 * 10:00~13:59 KST 사이 시드 기반 랜덤 시각을 부여한다.
 */
function ymdToPublishedIso(ymd, seed, slugSalt) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) throw new Error(`publish-date 형식 오류 (YYYY-MM-DD): ${ymd}`);
  const [, y, m, d] = match.map((v, i) => (i === 0 ? v : Number(v)));

  // slug 해시로 seed 보정 — 동일 날짜 여러 편이 같은 시각을 받지 않도록
  let salt = 0;
  for (const ch of slugSalt ?? "") salt = ((salt << 5) - salt + ch.charCodeAt(0)) >>> 0;
  const rng = createRng((seed >>> 0) ^ salt);

  const hour = 10 + Math.floor(rng() * 4);   // 10,11,12,13
  const minute = Math.floor(rng() * 60);
  const second = Math.floor(rng() * 60);

  // KST → UTC 환산 (UTC = KST - 9h)
  const utcMs = Date.UTC(y, m - 1, d, hour - 9, minute, second);
  return new Date(utcMs).toISOString();
}

function resolvePublishedAt({ cliPublishDate, frontmatterDate, seed, slug }) {
  if (cliPublishDate) return ymdToPublishedIso(cliPublishDate, seed, slug);
  if (frontmatterDate && /^\d{4}-\d{2}-\d{2}$/.test(frontmatterDate.trim())) {
    return ymdToPublishedIso(frontmatterDate.trim(), seed, slug);
  }
  return new Date().toISOString();
}

// keywords: { main, sub } → string[]
function flattenKeywords(kw) {
  if (!kw) return [];
  if (Array.isArray(kw)) return kw;
  const kwList = [];
  if (kw.main) kwList.push(kw.main);
  if (Array.isArray(kw.sub)) kwList.push(...kw.sub);
  return kwList;
}

/**
 * 마크다운 → HTML 변환
 * marked를 사용하여 heading에 id 속성을 자동 부여한다.
 */
function markdownToHtml(markdownContent) {
  return marked.parse(markdownContent);
}

async function upsertPost(record, update) {
  const baseUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/posts`;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (update) {
    // 1) 기존 행 존재 확인
    const checkRes = await fetch(`${baseUrl}?slug=eq.${encodeURIComponent(record.slug)}&select=id`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const existing = await checkRes.json();

    if (existing && existing.length > 0) {
      // PATCH로 업데이트
      const patchRes = await fetch(`${baseUrl}?slug=eq.${encodeURIComponent(record.slug)}`, {
        method: "PATCH",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(record),
      });
      const patchText = await patchRes.text();
      if (!patchRes.ok) throw new Error(`Supabase PATCH ${patchRes.status}: ${patchText}`);
      return JSON.parse(patchText);
    }
  }

  // 새 행 삽입
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify([record]),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase POST ${res.status}: ${text}`);
  return JSON.parse(text);
}

async function publishFile(filePath, { dry, update, publishDate, seed }) {
  const abs = path.resolve(ROOT, filePath);
  if (!fs.existsSync(abs)) throw new Error(`파일 없음: ${abs}`);

  const raw = fs.readFileSync(abs, "utf-8");
  const { meta, content } = parseFrontmatter(raw);

  // 마크다운 → HTML 변환
  const htmlContent = markdownToHtml(content);

  const publishedAt = resolvePublishedAt({
    cliPublishDate: publishDate,
    frontmatterDate: meta.date,
    seed,
    slug: meta.slug,
  });

  const record = {
    slug: meta.slug,
    title: meta.title,
    description: meta.description ?? null,
    content: htmlContent,
    category: meta.category,
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    keywords: flattenKeywords(meta.keywords),
    image_url: meta.image_url ?? null,
    author: meta.author ?? "고른다 에디터",
    status: "published",
    featured: meta.featured === "true" || meta.featured === true,
    read_time: calcReadTime(content),
    published_at: publishedAt,
    created_at: publishedAt,
  };

  console.log(`\n${"─".repeat(60)}`);
  console.log(`파일: ${path.relative(ROOT, abs)}`);
  console.log(`slug: ${record.slug}`);
  console.log(`제목: ${record.title}`);
  console.log(`카테고리: ${record.category} | 읽기시간: ${record.read_time}분`);
  console.log(`태그: ${record.tags.join(", ")}`);
  console.log(`키워드: ${record.keywords.join(", ")}`);
  console.log(`HTML 변환: ${htmlContent.length}자`);
  console.log(`published_at: ${record.published_at}`);

  if (dry) {
    console.log(`[DRY RUN] DB 삽입 생략`);
    console.log(`\n--- HTML 미리보기 (처음 500자) ---`);
    console.log(htmlContent.slice(0, 500));
    return;
  }

  const inserted = await upsertPost(record, update);
  const row = Array.isArray(inserted) ? inserted[0] : inserted;
  console.log(`발행 완료: id=${row?.id ?? "?"}`);
  console.log(`URL: http://localhost:3000/${record.category}/${record.slug}`);
}

// ─── main ────────────────────────────────────────────────────────────────────

loadEnv();

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const update = args.includes("--update");

function takeArg(name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  const val = args[idx + 1];
  args.splice(idx, 2);
  return val;
}

const publishDate = takeArg("--publish-date");
const seedRaw = takeArg("--seed");
const seed = seedRaw ? Number(seedRaw) : 20260412;

const files = args.filter(a => !a.startsWith("--"));

if (!files.length) {
  console.error(
    "Usage: node scripts/publish-post.mjs [--dry] [--update]\n" +
    "                                [--publish-date YYYY-MM-DD] [--seed N]\n" +
    "                                path/to/post.md ..."
  );
  process.exit(1);
}

for (const f of files) {
  await publishFile(f, { dry, update, publishDate, seed });
}

console.log(`\n완료. ${files.length}편 처리됨.`);
