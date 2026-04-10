#!/usr/bin/env node
/**
 * 마크다운 파일 → Supabase posts 테이블 발행 스크립트
 *
 * Usage:
 *   node scripts/publish-post.mjs path/to/post.md
 *   node scripts/publish-post.mjs path/to/post1.md path/to/post2.md
 *
 * --dry: DB 삽입 없이 파싱 결과만 출력
 * --update: 같은 slug가 있으면 덮어쓰기 (없으면 이미 존재 시 스킵)
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

async function publishFile(filePath, { dry, update }) {
  const abs = path.resolve(ROOT, filePath);
  if (!fs.existsSync(abs)) throw new Error(`파일 없음: ${abs}`);

  const raw = fs.readFileSync(abs, "utf-8");
  const { meta, content } = parseFrontmatter(raw);

  // 마크다운 → HTML 변환
  const htmlContent = markdownToHtml(content);

  const record = {
    slug: meta.slug,
    title: meta.title,
    description: meta.description ?? null,
    content: htmlContent,
    category: meta.category,
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    keywords: flattenKeywords(meta.keywords),
    image_url: meta.image_url ?? null,
    author: meta.author ?? "꿀정보 에디터",
    status: "published",
    featured: meta.featured === "true" || meta.featured === true,
    read_time: calcReadTime(content),
    published_at: new Date().toISOString(),
  };

  console.log(`\n${"─".repeat(60)}`);
  console.log(`파일: ${path.relative(ROOT, abs)}`);
  console.log(`slug: ${record.slug}`);
  console.log(`제목: ${record.title}`);
  console.log(`카테고리: ${record.category} | 읽기시간: ${record.read_time}분`);
  console.log(`태그: ${record.tags.join(", ")}`);
  console.log(`키워드: ${record.keywords.join(", ")}`);
  console.log(`HTML 변환: ${htmlContent.length}자`);

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
const files = args.filter(a => !a.startsWith("--"));

if (!files.length) {
  console.error("Usage: node scripts/publish-post.mjs [--dry] [--update] path/to/post.md ...");
  process.exit(1);
}

for (const f of files) {
  await publishFile(f, { dry, update });
}

console.log(`\n완료. ${files.length}편 처리됨.`);
