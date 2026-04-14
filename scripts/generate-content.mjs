#!/usr/bin/env node
/**
 * AI 콘텐츠 자동 생성 스크립트 (Claude API)
 *
 * Usage:
 *   node scripts/generate-content.mjs --affiliate 키퍼메이트 --topic "카페 CCTV 설치비용" --keywords "카페CCTV,카페CCTV설치비용"
 *   node scripts/generate-content.mjs --affiliate 키퍼메이트 --topic "..." --angle "..." --auto-release
 *   node scripts/generate-content.mjs --from-queue                     # topic-queue.json에서 다음 주제 자동 선택
 *   node scripts/generate-content.mjs --from-queue --affiliate 키퍼메이트
 *   node scripts/generate-content.mjs --from-queue --auto-release      # 생성 후 발행·이미지까지 자동
 *
 * 동작:
 *   1. .env.local 또는 환경변수에서 ANTHROPIC_API_KEY 로드
 *   2. 어필리에이트별 시스템 프롬프트 + few-shot 예시 구성
 *   3. Claude Sonnet 4-6 호출로 전체 마크다운 콘텐츠 생성
 *   4. {affiliate}/content/{slug}.md 저장
 *   5. (--auto-release) release-post.mjs 자동 실행
 */

import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { loadKeywordDB, findBestMatchForTopic } from "./lib/keyword-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const CLAUDE_MODEL = "claude-sonnet-4-6";
const GEMINI_MODEL_CHAIN = [
  "gemini-flash-latest",
  "gemini-3-flash-preview",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
];
const MAX_TOKENS = 8192;
const GEMINI_RETRY_ATTEMPTS = 2;
const GEMINI_RETRY_DELAY_MS = 2000;

// ─── env 로드 ──────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
      const match = line.match(/^([^#=]+)=(.+)$/);
      if (match) {
        const key = match[1].trim();
        if (!process.env[key]) {
          process.env[key] = match[2].trim().replace(/^["']|["']$/g, "");
        }
      }
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    const credentialsPath = path.join(process.env.HOME, ".claude", "CREDENTIALS.md");
    if (fs.existsSync(credentialsPath)) {
      const cred = fs.readFileSync(credentialsPath, "utf-8");
      const match = cred.match(/ANTHROPIC[_\s]*API[_\s]*KEY[^\n`]*[`:]\s*`?(sk-ant-[a-zA-Z0-9_-]+)/i);
      if (match) process.env.ANTHROPIC_API_KEY = match[1];
    }
  }

  if (!process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY 또는 GEMINI_API_KEY 필요. .env.local 또는 셸 환경변수에 추가.\n" +
      "임시 실행: ANTHROPIC_API_KEY=sk-ant-... node scripts/generate-content.mjs ..."
    );
  }
}

// ─── affiliates.json ─────────────────────────────────────────────────────

function loadAffiliates() {
  const filePath = path.join(ROOT, "content-input", "affiliates.json");
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const map = {};
  for (const aff of parsed.affiliates) {
    map[aff.name] = {
      dir: aff.contentDir,
      category: aff.category,
      url: aff.url,
      disclosure: aff.disclosure,
      author: aff.author ?? "고른다 에디터",
    };
  }
  return map;
}

// ─── 시스템 프롬프트 (파일 기반) ─────────────────────────────────────────
// 프롬프트는 content-input/prompts/{affiliateName}.md 파일에서 로드.
// 새 어필리에이트 추가 시 코드 수정 불필요 — 파일만 추가하면 됨.

const PROMPTS_DIR = path.join(ROOT, "content-input", "prompts");

function loadSystemPrompt(affiliateName) {
  const filePath = path.join(PROMPTS_DIR, `${affiliateName}.md`);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, "utf-8").trim();
  }
  // 파일 없으면 affiliates.json의 description으로 기본 프롬프트 생성
  return null;
}

function buildDefaultSystemPrompt(affiliateName, affiliate) {
  return `당신은 ${affiliateName} 전문 블로그 에디터다. ${affiliate.description ?? affiliateName + " 서비스"}를 소개하는 SEO 블로그 포스트를 작성한다.

핵심 규칙:
- CTA 링크: ${affiliate.url}
- 금지: 확인되지 않은 수치 단정, 경쟁사 비방, 과장 표현
- 허용: 공식 기관 통계 인용, 케이스별 장단점 비교

SEO & 콘텐츠 규칙:
- 제목: 60자 이내, 메인 키워드 자연 포함
- description: 120~160자, 핵심 수치 포함
- 분량: 본문 2,000~3,000자
- 구조: 목차 → H2(=글 제목, 본문 H1 금지) → 한 줄 답변 blockquote → 도입부 → H2 섹션들 → Q&A 5개 → 정리 + CTA → 출처
- 톤: 독자와 대화하듯 친근하게. "~한다" 체 기본
- 금지어: delve, tapestry, leverage, robust, seamless, "살펴보겠습니다"

출력 형식:
반드시 아래 frontmatter를 포함한 완전한 마크다운 파일을 출력한다. 다른 설명·메타 텍스트·코드펜스 금지. frontmatter --- 로 시작해야 함.`;
}

// ─── Few-shot 예시 로드 ──────────────────────────────────────────────────

function loadFewShotExamples(affiliateName, affiliate, limit = 2) {
  const dirPath = path.join(ROOT, affiliate.dir);
  if (!fs.existsSync(dirPath)) return [];

  const mdFiles = fs
    .readdirSync(dirPath)
    .filter((f) => f.endsWith(".md"))
    .sort((a, b) => {
      const statA = fs.statSync(path.join(dirPath, a));
      const statB = fs.statSync(path.join(dirPath, b));
      return statB.mtimeMs - statA.mtimeMs;
    })
    .slice(0, limit);

  return mdFiles.map((f) => {
    const raw = fs.readFileSync(path.join(dirPath, f), "utf-8");
    return { filename: f, content: raw };
  });
}

// ─── 사용자 프롬프트 구성 ────────────────────────────────────────────────

function buildUserPrompt({ affiliateName, affiliate, topic, keywords, angle, research, examples, today, slugHint }) {
  const keywordList = Array.isArray(keywords) ? keywords : keywords.split(/[,\s]+/).filter(Boolean);

  const examplesBlock = examples.length
    ? examples
        .map(
          (ex, idx) =>
            `<example index="${idx + 1}" filename="${ex.filename}">\n${ex.content}\n</example>`
        )
        .join("\n\n")
    : "(이전 예시 없음 — 아래 frontmatter 템플릿을 따르시오)";

  return `다음 조건으로 ${affiliateName} 블로그 SEO 포스트를 작성하라.

## 주제
${topic}

${angle ? `## 앵글\n${angle}\n` : ""}
## 필수 키워드
메인: ${keywordList[0] ?? topic}
서브: ${keywordList.slice(1, 6).join(", ") || "(없음)"}

${research ? `## 추가 리서치 컨텍스트\n${research}\n` : ""}
## 고정 메타 정보
- category: ${affiliate.category}
- date: ${today}
- author: ${affiliate.author}
- affiliate.name: ${affiliateName}
- affiliate.url: ${affiliate.url}
- disclosure: ${affiliate.disclosure}
- slug: ${slugHint || "(주제에 맞는 영문 kebab-case 슬러그를 생성할 것)"}
- featured: false

## 기존 발행 예시 (톤앤매너·구조 참고용)
${examplesBlock}

## 출력 요구사항
1. 위 예시와 동일한 frontmatter 구조(--- 로 시작)
2. 예시와 비슷한 톤, 동일한 목차 포맷(## 목차 블록)
3. 본문 2,000~3,000자, 구체 수치와 표 포함
4. Q&A 섹션 5개 이상
5. 정리 섹션에 CTA 링크(${affiliate.url}) 반드시 삽입
6. 출처 섹션에 공식 기관·제조사 링크 3개 이상
7. frontmatter 맨 아래에 공시 문구 반복
8. 코드펜스(\`\`\`) 로 감싸지 말고 마크다운 원문만 출력
9. 설명·머리말·맺음말 없이 --- 로 바로 시작`;
}

// ─── slug 후처리 ─────────────────────────────────────────────────────────

function sanitizeSlug(slug, fallback) {
  if (!slug) return fallback;
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractFrontmatterField(content, field) {
  const match = content.match(new RegExp(`^${field}:\\s*["']?([^"'\\n]+)["']?`, "m"));
  return match ? match[1].trim() : null;
}

// ─── topic-queue.json ────────────────────────────────────────────────────

function loadTopicQueue() {
  const queuePath = path.join(ROOT, "content-input", "topic-queue.json");
  if (!fs.existsSync(queuePath)) return null;
  return JSON.parse(fs.readFileSync(queuePath, "utf-8"));
}

function saveTopicQueue(data) {
  const queuePath = path.join(ROOT, "content-input", "topic-queue.json");
  fs.writeFileSync(queuePath, JSON.stringify(data, null, 2));
}

function pickNextTopic(queue, affiliateName) {
  const targetAffiliates = affiliateName ? [affiliateName] : Object.keys(queue.queue);
  for (const name of targetAffiliates) {
    const list = queue.queue[name] ?? [];
    const next = list.find((item) => item.status === "pending");
    if (next) return { affiliateName: name, topicEntry: next };
  }
  return null;
}

// ─── Claude 호출 ─────────────────────────────────────────────────────────

async function callClaude({ systemPrompt, userPrompt }) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock) throw new Error("Claude 응답에 text 블록 없음");
  return {
    text: textBlock.text,
    usage: `input=${response.usage.input_tokens} / output=${response.usage.output_tokens}`,
    provider: "claude",
    model: CLAUDE_MODEL,
  };
}

// ─── Gemini 폴백 호출 ────────────────────────────────────────────────────

async function callGeminiModel({ model, systemPrompt, userPrompt }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY 없음");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: MAX_TOKENS,
      topP: 0.95,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    const err = new Error(`Gemini ${model} ${response.status}: ${errText.slice(0, 300)}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  if (!candidate) throw new Error(`Gemini ${model} 응답에 candidate 없음`);

  const text = candidate.content?.parts?.map((p) => p.text).join("") ?? "";
  if (!text) throw new Error(`Gemini ${model} 응답 텍스트 비어있음`);

  const usage = data.usageMetadata
    ? `input=${data.usageMetadata.promptTokenCount ?? "?"} / output=${data.usageMetadata.candidatesTokenCount ?? "?"}`
    : "usage=?";

  return { text, usage, provider: "gemini", model };
}

function shouldRetryGeminiStatus(status) {
  return status === 503 || status === 429 || status === 500;
}

async function callGemini({ systemPrompt, userPrompt }) {
  let lastErr = null;

  for (const model of GEMINI_MODEL_CHAIN) {
    for (let attempt = 1; attempt <= GEMINI_RETRY_ATTEMPTS; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`    [Gemini] ${model} 재시도 ${attempt}/${GEMINI_RETRY_ATTEMPTS}`);
        }
        return await callGeminiModel({ model, systemPrompt, userPrompt });
      } catch (err) {
        lastErr = err;
        const retryable = shouldRetryGeminiStatus(err.status);
        console.warn(`    [Gemini] ${model} attempt ${attempt} 실패: ${err.message.slice(0, 150)}`);
        if (!retryable) break;
        if (attempt < GEMINI_RETRY_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, GEMINI_RETRY_DELAY_MS * attempt));
        }
      }
    }
  }

  throw lastErr ?? new Error("Gemini 모든 모델 실패");
}

// ─── 통합 생성 로직 ─────────────────────────────────────────────────────

async function generateContent({ affiliateName, affiliate, topic, keywords, angle, research, slugHint }) {
  const examples = loadFewShotExamples(affiliateName, affiliate, 2);
  const today = new Date().toISOString().split("T")[0];

  const systemPrompt = loadSystemPrompt(affiliateName) ?? buildDefaultSystemPrompt(affiliateName, affiliate);
  console.log(`  [프롬프트] ${fs.existsSync(path.join(PROMPTS_DIR, `${affiliateName}.md`)) ? "파일 로드" : "기본 프롬프트 사용"}: ${affiliateName}`);

  const userPrompt = buildUserPrompt({
    affiliateName,
    affiliate,
    topic,
    keywords,
    angle,
    research,
    examples,
    today,
    slugHint,
  });

  console.log(`  [LLM] few-shot: ${examples.length}편 | 주제: ${topic}`);

  let result = null;
  const providers = [];
  if (process.env.ANTHROPIC_API_KEY) providers.push({ name: "claude", fn: callClaude });
  if (process.env.GEMINI_API_KEY) providers.push({ name: "gemini", fn: callGemini });

  let lastErr = null;
  for (const provider of providers) {
    try {
      console.log(`  [LLM] ${provider.name} 호출 시도`);
      result = await provider.fn({ systemPrompt, userPrompt });
      console.log(`  [LLM] ${provider.name}(${result.model}) 성공 · ${result.usage}`);
      break;
    } catch (err) {
      lastErr = err;
      console.warn(`  [LLM] ${provider.name} 실패: ${err.message.slice(0, 200)}`);
    }
  }

  if (!result) {
    throw new Error(`모든 LLM 프로바이더 실패. 마지막 오류: ${lastErr?.message ?? "unknown"}`);
  }

  let markdown = result.text.trim();
  if (markdown.startsWith("```")) {
    markdown = markdown.replace(/^```(?:markdown)?\n/, "").replace(/\n```$/, "");
  }
  if (!markdown.startsWith("---")) {
    throw new Error(
      `${result.provider} 응답이 frontmatter(---)로 시작하지 않음. 시작 200자:\n${markdown.slice(0, 200)}`
    );
  }

  console.log(`  [LLM] 생성 완료: ${markdown.length}자`);
  return markdown;
}

// ─── 파일 저장 ────────────────────────────────────────────────────────────

function saveDraft(markdown, affiliate, slugHint, topic) {
  let slug = extractFrontmatterField(markdown, "slug");
  if (!slug) {
    const today = new Date().toISOString().split("T")[0];
    slug = sanitizeSlug(slugHint, `${today}-${crypto.randomBytes(4).toString("hex")}`);
  } else {
    slug = sanitizeSlug(slug, slug);
  }

  const outDir = path.join(ROOT, affiliate.dir);
  fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, `${slug}.md`);
  if (fs.existsSync(outPath)) {
    const existing = fs.readFileSync(outPath, "utf-8");
    if (existing === markdown) {
      console.log(`  [동일 파일 존재] 덮어쓰기 생략: ${path.relative(ROOT, outPath)}`);
      return outPath;
    }
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
    const renamed = path.join(outDir, `${slug}-${ts}.md`);
    fs.writeFileSync(renamed, markdown);
    console.log(`  [중복 slug] 새 파일명으로 저장: ${path.relative(ROOT, renamed)}`);
    return renamed;
  }

  fs.writeFileSync(outPath, markdown);
  console.log(`  [저장 완료] ${path.relative(ROOT, outPath)}`);
  return outPath;
}

// ─── release 실행 ────────────────────────────────────────────────────────

function runRelease(filePath) {
  const rel = path.relative(ROOT, filePath);
  const cmd = `node scripts/release-post.mjs ${rel}`;
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
}

// ─── CLI ─────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : null;
  };
  return {
    affiliate: get("--affiliate"),
    topic: get("--topic"),
    angle: get("--angle"),
    keywords: get("--keywords"),
    research: get("--research"),
    slugHint: get("--slug"),
    fromQueue: args.includes("--from-queue"),
    autoRelease: args.includes("--auto-release"),
    dry: args.includes("--dry"),
    forceUnscored: args.includes("--force-unscored"),
    minScore: parseInt(get("--min-score") || "20", 10),
  };
}

/**
 * 마크다운 frontmatter에 keywords.bestMatch/total/score/comp 필드 주입
 * 기존 keywords 블록이 있으면 확장, 없으면 새로 삽입
 *
 * @param {string} markdown
 * @param {{keyword:string, total:number, comp:string|null, score:number, matchType:string}|null} match
 * @returns {string}
 */
function injectKeywordMeta(markdown, match) {
  if (!match) {
    // DB 매칭 실패 — score: 0 명시
    const stub = "  bestMatch: null\n  score: 0\n  total: 0\n  comp: \"unmatched\"\n";
    return insertIntoKeywordsBlock(markdown, stub);
  }
  const lines = [
    `  bestMatch: "${match.keyword.replace(/"/g, '\\"')}"`,
    `  score: ${match.score}`,
    `  total: ${match.total}`,
    `  comp: "${match.comp ?? "unknown"}"`,
    `  matchType: "${match.matchType}"`,
  ];
  return insertIntoKeywordsBlock(markdown, lines.join("\n") + "\n");
}

function insertIntoKeywordsBlock(markdown, insertion) {
  const fmMatch = markdown.match(/^---\n([\s\S]+?)\n---/);
  if (!fmMatch) return markdown; // frontmatter 없음 → 변경 없이 반환

  const fm = fmMatch[1];
  const lines = fm.split("\n");

  const kwIdx = lines.findIndex((ln) => ln === "keywords:" || ln.startsWith("keywords:"));
  if (kwIdx === -1) {
    // keywords 블록 없음 → frontmatter 끝에 추가
    const newFm = fm + `\nkeywords:\n${insertion.trimEnd()}`;
    return markdown.replace(fmMatch[0], `---\n${newFm}\n---`);
  }

  // 블록 범위: 다음 최상위 키(들여쓰기 없는 라인)까지
  let endIdx = lines.length;
  for (let i = kwIdx + 1; i < lines.length; i++) {
    if (lines[i].length === 0) continue;
    if (!lines[i].startsWith(" ")) {
      endIdx = i;
      break;
    }
  }

  const existingBlock = lines.slice(kwIdx + 1, endIdx);
  const cleaned = existingBlock.filter(
    (ln) => !/^  (bestMatch|score|total|comp|matchType):/.test(ln)
  );

  const insertionLines = insertion.trimEnd().split("\n");
  const newLines = [
    ...lines.slice(0, kwIdx + 1),
    ...cleaned,
    ...insertionLines,
    ...lines.slice(endIdx),
  ];

  const newFm = newLines.join("\n");
  return markdown.replace(fmMatch[0], `---\n${newFm}\n---`);
}

async function main() {
  loadEnv();
  const affiliates = loadAffiliates();
  const opts = parseArgs();

  let affiliateName = opts.affiliate;
  let topic = opts.topic;
  let keywords = opts.keywords;
  let angle = opts.angle;
  let slugHint = opts.slugHint;
  let topicEntry = null;
  let queue = null;

  if (opts.fromQueue) {
    queue = loadTopicQueue();
    if (!queue) {
      throw new Error("content-input/topic-queue.json 없음");
    }
    const picked = pickNextTopic(queue, affiliateName);
    if (!picked) {
      console.log("큐에 pending 주제가 없음. 종료.");
      return;
    }
    affiliateName = picked.affiliateName;
    topicEntry = picked.topicEntry;
    topic = topicEntry.topic;
    angle = angle || topicEntry.angle;
    keywords = keywords || (topicEntry.keywords || []).join(",");
    slugHint = slugHint || topicEntry.slugHint;

    // score gate: topic-queue에서 꺼낸 항목의 opportunityScore 검증
    const queueScore = Number(topicEntry.opportunityScore) || 0;
    if (!opts.forceUnscored && queueScore < opts.minScore) {
      throw new Error(
        `주제 "${topic}" score ${queueScore} < ${opts.minScore}. ` +
        `discover-topics.mjs로 재검증하거나 --force-unscored 플래그 사용.`
      );
    }
    if (queueScore === 0) {
      console.warn(`  [WARN] opportunityScore 0 — --force-unscored로 통과. frontmatter에 score:0 기록`);
    }
  }

  if (!affiliateName || !topic) {
    console.error(`
사용법:
  node scripts/generate-content.mjs --affiliate 키퍼메이트 --topic "주제" --keywords "키워드1,키워드2" [--angle "..."] [--auto-release]
  node scripts/generate-content.mjs --from-queue [--affiliate 키퍼메이트] [--auto-release]
`);
    process.exit(1);
  }

  const affiliate = affiliates[affiliateName];
  if (!affiliate) {
    throw new Error(`알 수 없는 어필리에이트: ${affiliateName} (가능: ${Object.keys(affiliates).join(", ")})`);
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`콘텐츠 생성: [${affiliateName}] ${topic}`);
  console.log(`${"═".repeat(60)}`);

  if (opts.dry) {
    console.log("  [DRY] API 호출 없이 종료");
    return;
  }

  let markdown = await generateContent({
    affiliateName,
    affiliate,
    topic,
    keywords,
    angle,
    research: opts.research,
    slugHint,
  });

  // 키워드 DB 매칭 결과를 frontmatter에 주입
  let injectedMatch = null;
  if (topicEntry?.bestMatch) {
    injectedMatch = topicEntry.bestMatch;
  } else {
    // topicEntry에 bestMatch가 없으면 실시간 매칭
    const keywordDB = loadKeywordDB(ROOT);
    const keywordList = typeof keywords === "string"
      ? keywords.split(/[,\s]+/).filter(Boolean)
      : Array.isArray(keywords) ? keywords : [];
    injectedMatch = findBestMatchForTopic(keywordDB, {
      topic,
      tags: keywordList,
      keywords: keywordList,
    });
  }
  markdown = injectKeywordMeta(markdown, injectedMatch);
  if (injectedMatch) {
    console.log(
      `  [keyword-meta] bestMatch="${injectedMatch.keyword}" score=${injectedMatch.score} ` +
      `total=${injectedMatch.total} comp=${injectedMatch.comp ?? "?"} [${injectedMatch.matchType}]`
    );
  } else {
    console.warn(`  [keyword-meta] DB 매칭 실패 — frontmatter score:0 기록`);
  }

  const outPath = saveDraft(markdown, affiliate, slugHint, topic);

  if (topicEntry && queue) {
    topicEntry.status = "generated";
    topicEntry.generatedAt = new Date().toISOString();
    topicEntry.draftPath = path.relative(ROOT, outPath);
    queue.updatedAt = new Date().toISOString().split("T")[0];
    saveTopicQueue(queue);
    console.log(`  [큐 상태 업데이트] ${topic} → generated`);
  }

  if (opts.autoRelease) {
    runRelease(outPath);
    if (topicEntry && queue) {
      topicEntry.status = "published";
      topicEntry.publishedAt = new Date().toISOString();
      saveTopicQueue(queue);
    }
  }

  console.log(`\n완료: ${path.relative(ROOT, outPath)}`);
}

main().catch((err) => {
  console.error(`\n오류: ${err.message}`);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
