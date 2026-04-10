#!/usr/bin/env node
/**
 * 블로그 포스트 이미지 생성 스크립트
 *
 * - 기본 모드: 썸네일(대표 이미지) 1개 생성 → posts.image_url 업데이트
 * - --inline 모드: 썸네일 + H2 섹션별 인라인 이미지 생성 → posts.content HTML에 삽입
 *
 * Vertex AI Imagen 3 (primary) → Gemini AI Studio Imagen 4 (fallback)
 * → Supabase Storage 업로드 → posts 업데이트
 *
 * Usage:
 *   node scripts/generate-image.mjs path/to/post.md
 *   node scripts/generate-image.mjs path/to/*.md --inline
 *   node scripts/generate-image.mjs --slug my-post --inline --force
 *   node scripts/generate-image.mjs post.md --dry
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const LOCAL_FALLBACK_DIR = path.join(ROOT, "public", "generated-images");

// ─── env ────────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) throw new Error(".env.local 없음");
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.+)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

// ─── gcloud access token ───────────────────────────────────────────────────

let _cachedAccessToken = null;
let _tokenExpiry = 0;

function getAccessToken() {
  if (_cachedAccessToken && Date.now() < _tokenExpiry) {
    return _cachedAccessToken;
  }
  try {
    _cachedAccessToken = execSync("gcloud auth print-access-token", { encoding: "utf-8" }).trim();
    _tokenExpiry = Date.now() + 50 * 60 * 1000;
    return _cachedAccessToken;
  } catch {
    throw new Error("gcloud auth print-access-token 실패. gcloud CLI 로그인 필요.");
  }
}

// ─── frontmatter 파싱 ──────────────────────────────────────────────────────

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error("frontmatter 없음");

  const yamlStr = match[1];
  const body = match[2];
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

  return { meta, body };
}

// ─── H2 섹션 파싱 (인라인 이미지용) ───────────────────────────────────────

const SKIP_SECTIONS = [
  /^목차$/,
  /^q&a/i,
  /^자주\s*묻는/,
  /^함께\s*읽으면/,
  /^정리$/,
  /^출처$/,
  /^관련\s*글/,
  /^마무리/,
  /^참고/,
];

function parseH2Sections(markdownBody) {
  const h2Regex = /^## (.+)$/gm;
  const sections = [];
  let match;

  while ((match = h2Regex.exec(markdownBody)) !== null) {
    const title = match[1].trim();
    const shouldSkip = SKIP_SECTIONS.some(re => re.test(title));
    if (!shouldSkip) {
      sections.push({ title, index: match.index });
    }
  }

  return sections.slice(0, 3);
}

// ─── 이미지 프롬프트 생성 ──────────────────────────────────────────────────

const STYLE_MAP = {
  tech: {
    scene: "a modern Korean small business shop interior with security cameras installed on ceiling, clean white walls, LED lighting, professional surveillance setup",
    palette: "cool blue and white tones with subtle gray accents",
  },
  finance: {
    scene: "a clean flat design illustration of business documents, calculator, corporate seal stamp, and a laptop showing financial charts on a wooden desk",
    palette: "warm neutral tones with navy blue and gold accents",
  },
};

function buildThumbnailPrompt(meta) {
  const category = meta.category ?? "tech";
  const style = STYLE_MAP[category] ?? STYLE_MAP.tech;
  const title = meta.title ?? "";
  const mainKeyword = typeof meta.keywords === "object" && !Array.isArray(meta.keywords)
    ? meta.keywords.main ?? ""
    : "";

  return [
    "A clean, modern Korean blog thumbnail image.",
    `Topic: ${title}`,
    `Main keyword: ${mainKeyword}`,
    `Scene: ${style.scene}`,
    `Color palette: ${style.palette}`,
    "Style: professional photograph or high-quality illustration, minimal composition, no text overlays, no watermarks, no human faces, no logos.",
    "Aspect ratio: 16:9, 1200x675 equivalent.",
    "Lighting: soft, even studio lighting.",
  ].join("\n");
}

function buildSectionPrompt(sectionTitle, postTitle, category) {
  const style = STYLE_MAP[category] ?? STYLE_MAP.tech;

  return [
    "A clean, modern blog section illustration.",
    `Section topic: ${sectionTitle}`,
    `Article context: ${postTitle}`,
    `Color palette: ${style.palette}`,
    "Style: minimalist infographic-style illustration, clean vector-like aesthetic, no text overlays, no watermarks, no human faces, no logos.",
    "Aspect ratio: 16:9, 1200x675 equivalent.",
    "Lighting: soft, even lighting with clean background.",
  ].join("\n");
}

// ─── Vertex AI Imagen 3 (primary) ──────────────────────────────────────────

const VERTEX_PROJECT = "puzlagency";
const VERTEX_LOCATION = "us-central1";

async function generateWithVertexImagen(prompt) {
  const accessToken = getAccessToken();
  const endpoint = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}/publishers/google/models/imagen-3.0-generate-002:predict`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio: "16:9" },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Vertex Imagen API ${response.status}: ${errText.substring(0, 300)}`);
  }

  const responseData = await response.json();
  const prediction = responseData.predictions?.[0];
  if (!prediction?.bytesBase64Encoded) {
    throw new Error("Vertex Imagen: 이미지 데이터 없음");
  }

  return {
    base64: prediction.bytesBase64Encoded,
    mimeType: prediction.mimeType ?? "image/png",
  };
}

// ─── Gemini AI Studio Imagen 4 (fallback) ──────────────────────────────────

async function generateWithImagen4(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio: "16:9" },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Imagen 4 API ${response.status}: ${errText.substring(0, 300)}`);
  }

  const responseData = await response.json();
  const prediction = responseData.predictions?.[0];
  if (!prediction?.bytesBase64Encoded) {
    throw new Error("Imagen 4: 이미지 데이터 없음");
  }

  return {
    base64: prediction.bytesBase64Encoded,
    mimeType: prediction.mimeType ?? "image/png",
  };
}

// ─── retry 유틸 ────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryWithBackoff(fn, label, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRateLimit = err.message.includes("429") || err.message.includes("quota") || err.message.includes("paid plans");
      if (isRateLimit && attempt < maxRetries) {
        const waitSec = attempt * 10;
        console.log(`  [${label}] Rate limit, ${waitSec}초 대기 후 재시도 (${attempt}/${maxRetries})...`);
        await sleep(waitSec * 1000);
        continue;
      }
      throw err;
    }
  }
}

// ─── 이미지 생성 (Vertex AI → Imagen 4 fallback) ──────────────────────────

async function generateImage(prompt) {
  try {
    console.log("  [1/2] Vertex AI Imagen 3 생성 시도...");
    return await retryWithBackoff(() => generateWithVertexImagen(prompt), "Vertex");
  } catch (vertexErr) {
    console.log(`  [1/2] Vertex AI 실패: ${vertexErr.message.substring(0, 150)}`);
  }

  try {
    console.log("  [2/2] Gemini AI Studio Imagen 4 fallback 시도...");
    return await retryWithBackoff(() => generateWithImagen4(prompt), "Imagen4");
  } catch (imagen4Err) {
    throw new Error(`모든 모델 실패.\n  Vertex: gcloud 미설치 또는 인증 실패\n  Imagen 4: ${imagen4Err.message.substring(0, 200)}`);
  }
}

// ─── 이미지 버퍼 처리 ──────────────────────────────────────────────────────

function toImageBuffer(base64, mimeType) {
  const buffer = Buffer.from(base64, "base64");
  const ext = mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : "png";
  return { buffer, ext, mimeType };
}

// ─── Supabase Storage 업로드 ───────────────────────────────────────────────

const BUCKET = "post-images";

async function uploadToStorage(filePath, imageBuffer, mimeType) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${BUCKET}/${filePath}`;

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": mimeType,
      "x-upsert": "true",
    },
    body: imageBuffer,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Storage 업로드 실패 ${response.status}: ${errText.substring(0, 300)}`);
  }

  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${filePath}`;
}

// ─── posts 테이블 업데이트 ─────────────────────────────────────────────────

async function updatePost(slug, patch) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const endpoint = `${supabaseUrl}/rest/v1/posts?slug=eq.${encodeURIComponent(slug)}`;

  const response = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`DB 업데이트 실패 ${response.status}: ${errText.substring(0, 300)}`);
  }

  const rows = await response.json();
  if (!rows.length) {
    throw new Error(`slug="${slug}" 에 해당하는 포스트가 DB에 없음`);
  }

  return rows[0];
}

// ─── 기존 포스트 조회 ──────────────────────────────────────────────────────

async function fetchPost(slug) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const endpoint = `${supabaseUrl}/rest/v1/posts?slug=eq.${encodeURIComponent(slug)}&select=id,slug,title,image_url,content`;

  const response = await fetch(endpoint, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });

  const rows = await response.json();
  return rows[0] ?? null;
}

// ─── 인라인 이미지를 HTML content에 삽입 ───────────────────────────────────

function insertSectionImages(htmlContent, sectionImages) {
  let modifiedHtml = htmlContent;

  // 역순으로 삽입 (앞쪽 인덱스에 영향 주지 않도록)
  const sorted = [...sectionImages].sort((a, b) => b.sectionTitle.localeCompare(a.sectionTitle));

  for (const { sectionTitle, imageUrl } of sorted) {
    // H2 태그에서 해당 섹션 찾기
    const escapedTitle = sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const h2Pattern = new RegExp(`(<h2[^>]*>\\s*${escapedTitle}\\s*</h2>)`, "i");
    const figureHtml = `<figure class="section-image">\n  <img src="${imageUrl}" alt="${sectionTitle}" loading="lazy" />\n</figure>\n`;

    modifiedHtml = modifiedHtml.replace(h2Pattern, `${figureHtml}$1`);
  }

  return modifiedHtml;
}

// ─── slug로 처리 ───────────────────────────────────────────────────────────

async function processSlug(slug, { dry, force, inline }) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`slug: ${slug}`);

  const existing = await fetchPost(slug);
  if (!existing) {
    console.log(`  [SKIP] DB에 해당 slug 없음`);
    return false;
  }

  console.log(`  제목: ${existing.title}`);

  if (existing.image_url && !force) {
    console.log(`  [SKIP] 이미 image_url 존재 (--force 로 덮어쓰기 가능)`);
    console.log(`  현재: ${existing.image_url}`);
    return false;
  }

  const guessedCategory = slug.includes("cctv") || slug.includes("secom") || slug.includes("keeper")
    ? "tech" : "finance";

  const meta = { title: existing.title, category: guessedCategory, keywords: {} };
  return await generateAndUploadAll(slug, meta, null, existing, { dry, inline });
}

// ─── 파일로 처리 ───────────────────────────────────────────────────────────

async function processFile(filePath, { dry, force, inline }) {
  const abs = path.resolve(ROOT, filePath);
  if (!fs.existsSync(abs)) {
    console.error(`  [ERROR] 파일 없음: ${abs}`);
    return false;
  }

  const raw = fs.readFileSync(abs, "utf-8");
  const { meta, body } = parseFrontmatter(raw);
  const slug = meta.slug;

  console.log(`\n${"─".repeat(60)}`);
  console.log(`파일: ${path.relative(ROOT, abs)}`);
  console.log(`slug: ${slug}`);
  console.log(`제목: ${meta.title}`);
  console.log(`카테고리: ${meta.category}`);

  const existing = await fetchPost(slug);
  if (!existing) {
    console.log(`  [SKIP] DB에 해당 slug 없음 (먼저 publish-post 실행 필요)`);
    return false;
  }

  if (existing.image_url && !force) {
    console.log(`  [SKIP] 이미 image_url 존재 (--force 로 덮어쓰기 가능)`);
    console.log(`  현재: ${existing.image_url}`);
    return false;
  }

  return await generateAndUploadAll(slug, meta, body, existing, { dry, inline });
}

// ─── 생성 + 업로드 공통 로직 ───────────────────────────────────────────────

async function generateAndUploadAll(slug, meta, markdownBody, existingPost, { dry, inline }) {
  // 1) 썸네일 생성
  const thumbnailPrompt = buildThumbnailPrompt(meta);
  console.log(`\n  [썸네일] 프롬프트 생성...`);

  let thumbnailUrl = null;

  try {
    const { base64, mimeType } = await generateImage(thumbnailPrompt);
    const { buffer, ext, mimeType: finalMime } = toImageBuffer(base64, mimeType);
    console.log(`  [썸네일] 생성 완료: ${(buffer.length / 1024).toFixed(0)}KB (${finalMime})`);

    if (dry) {
      const localDir = ensureLocalDir();
      const localPath = path.join(localDir, `${slug}.${ext}`);
      fs.writeFileSync(localPath, buffer);
      console.log(`  [DRY] 로컬 저장: ${path.relative(ROOT, localPath)}`);
    } else {
      const storePath = `${slug}.${ext}`;
      thumbnailUrl = await uploadToStorage(storePath, buffer, finalMime);
      console.log(`  [썸네일] 업로드: ${thumbnailUrl}`);
    }
  } catch (genErr) {
    console.error(`  [ERROR] 썸네일 생성 실패: ${genErr.message}`);
    return false;
  }

  // 2) 인라인 섹션 이미지 (--inline 모드)
  let updatedContent = existingPost.content;
  const sectionImages = [];

  if (inline && markdownBody) {
    const sections = parseH2Sections(markdownBody);
    console.log(`\n  [인라인] 대상 H2 섹션 ${sections.length}개 감지`);

    for (let idx = 0; idx < sections.length; idx++) {
      const section = sections[idx];
      console.log(`  [인라인 ${idx + 1}/${sections.length}] "${section.title}"`);

      const sectionPrompt = buildSectionPrompt(section.title, meta.title, meta.category ?? "tech");

      try {
        if (idx > 0) await sleep(3000);

        const { base64, mimeType } = await generateImage(sectionPrompt);
        const { buffer, ext, mimeType: finalMime } = toImageBuffer(base64, mimeType);
        console.log(`    생성 완료: ${(buffer.length / 1024).toFixed(0)}KB`);

        if (dry) {
          const localDir = ensureLocalDir();
          const localPath = path.join(localDir, `${slug}-section-${idx + 1}.${ext}`);
          fs.writeFileSync(localPath, buffer);
          console.log(`    [DRY] 로컬: ${path.relative(ROOT, localPath)}`);
        } else {
          const storePath = `${slug}-section-${idx + 1}.${ext}`;
          const sectionUrl = await uploadToStorage(storePath, buffer, finalMime);
          console.log(`    업로드: ${sectionUrl}`);
          sectionImages.push({ sectionTitle: section.title, imageUrl: sectionUrl });
        }
      } catch (secErr) {
        console.error(`    [WARN] 섹션 이미지 실패: ${secErr.message.substring(0, 150)}`);
      }
    }

    // HTML content에 섹션 이미지 삽입
    if (sectionImages.length > 0 && !dry) {
      updatedContent = insertSectionImages(existingPost.content, sectionImages);
      console.log(`  [인라인] ${sectionImages.length}개 이미지 HTML에 삽입 완료`);
    }
  }

  // 3) DB 업데이트
  if (!dry) {
    const patch = {};
    if (thumbnailUrl) patch.image_url = thumbnailUrl;
    if (sectionImages.length > 0) patch.content = updatedContent;

    if (Object.keys(patch).length > 0) {
      const updated = await updatePost(slug, patch);
      console.log(`  [DB] 업데이트 완료: id=${updated.id}`);
      if (thumbnailUrl) console.log(`  [DB] image_url = ${thumbnailUrl}`);
      if (sectionImages.length > 0) console.log(`  [DB] content 업데이트됨 (+${sectionImages.length} 섹션 이미지)`);
    }
  }

  return true;
}

function ensureLocalDir() {
  if (!fs.existsSync(LOCAL_FALLBACK_DIR)) {
    fs.mkdirSync(LOCAL_FALLBACK_DIR, { recursive: true });
  }
  return LOCAL_FALLBACK_DIR;
}

// ─── main ────────────────────────────────────────────────────────────────────

loadEnv();

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const force = args.includes("--force");
const inline = args.includes("--inline");
const slugFlag = args.includes("--slug");
const flags = new Set(["--dry", "--force", "--inline", "--slug"]);
const positionals = args.filter(a => !flags.has(a));

if (!positionals.length) {
  console.error("Usage:");
  console.error("  node scripts/generate-image.mjs <file.md> [<file2.md>...] [--inline] [--dry] [--force]");
  console.error("  node scripts/generate-image.mjs --slug <slug> [--inline] [--dry] [--force]");
  console.error("");
  console.error("Flags:");
  console.error("  --inline  썸네일 + H2 섹션 인라인 이미지 생성 (최대 3개)");
  console.error("  --force   기존 image_url 있어도 덮어쓰기");
  console.error("  --dry     DB 반영 없이 로컬 저장만");
  process.exit(1);
}

let successCount = 0;
let totalCount = 0;

const INTER_REQUEST_DELAY_MS = 3000;

if (slugFlag) {
  for (let idx = 0; idx < positionals.length; idx++) {
    if (idx > 0) await sleep(INTER_REQUEST_DELAY_MS);
    totalCount++;
    const ok = await processSlug(positionals[idx], { dry, force, inline });
    if (ok) successCount++;
  }
} else {
  for (let idx = 0; idx < positionals.length; idx++) {
    if (idx > 0) await sleep(INTER_REQUEST_DELAY_MS);
    totalCount++;
    const ok = await processFile(positionals[idx], { dry, force, inline });
    if (ok) successCount++;
  }
}

console.log(`\n${"═".repeat(60)}`);
console.log(`완료: ${successCount}/${totalCount} 성공`);
if (dry) console.log("(--dry 모드: DB 업데이트 없음)");
if (inline) console.log("(--inline 모드: 섹션 이미지 포함)");
