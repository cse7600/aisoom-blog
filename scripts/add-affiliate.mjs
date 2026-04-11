#!/usr/bin/env node
/**
 * 새 어필리에이트 자동 온보딩 스크립트
 *
 * affiliates.json에 항목을 추가하면:
 * 1. contentDir 자동 생성
 * 2. Claude로 시스템 프롬프트 자동 생성 → generate-content.mjs에 등록
 * 3. Claude로 초기 주제 10개 생성 → topic-queue.json에 추가
 * 4. sources 미설정 시 Claude가 관련 커뮤니티/경쟁사 추천
 *
 * Usage:
 *   # 대화형 추가
 *   node scripts/add-affiliate.mjs
 *
 *   # 직접 추가 (affiliates.json에 미리 추가 후 실행)
 *   node scripts/add-affiliate.mjs --name 밀리의서재 --init
 *
 *   # 이미 affiliates.json에 있는 어필리에이트 초기화
 *   node scripts/add-affiliate.mjs --init-all
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CLAUDE_MODEL = "claude-sonnet-4-5";

// ─── env ────────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
      const m = line.match(/^([^#=]+)=(.+)$/);
      if (m && !process.env[m[1].trim()]) {
        process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    const credPath = path.join(process.env.HOME, ".claude", "CREDENTIALS.md");
    if (fs.existsSync(credPath)) {
      const cred = fs.readFileSync(credPath, "utf-8");
      const m = cred.match(/ANTHROPIC[_\s]*API[_\s]*KEY[^\n`]*[`:]\s*`?(sk-ant-[a-zA-Z0-9_-]+)/i);
      if (m) process.env.ANTHROPIC_API_KEY = m[1];
    }
  }
}

// ─── affiliates.json I/O ────────────────────────────────────────────────────

function loadAffiliatesFile() {
  const p = path.join(ROOT, "content-input", "affiliates.json");
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function saveAffiliatesFile(data) {
  const p = path.join(ROOT, "content-input", "affiliates.json");
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function loadQueue() {
  const p = path.join(ROOT, "content-input", "topic-queue.json");
  if (!fs.existsSync(p)) return { updatedAt: "", queue: {} };
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function saveQueue(queue) {
  const p = path.join(ROOT, "content-input", "topic-queue.json");
  queue.updatedAt = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(p, JSON.stringify(queue, null, 2));
}

// ─── Claude 호출 ─────────────────────────────────────────────────────────────

async function askClaude(systemPrompt, userPrompt) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const res = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  const block = res.content.find((b) => b.type === "text");
  return block?.text.trim() ?? "";
}

function parseJsonBlock(text) {
  let body = text.trim();
  if (body.startsWith("```")) body = body.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  const s = body.indexOf("{") !== -1 ? body.indexOf("{") : body.indexOf("[");
  const e = body.lastIndexOf("}") !== -1 ? body.lastIndexOf("}") : body.lastIndexOf("]");
  if (s === -1 || e === -1) return null;
  try { return JSON.parse(body.slice(s, e + 1)); } catch { return null; }
}

// ─── 시스템 프롬프트 자동 생성 ──────────────────────────────────────────────

async function generateSystemPrompt(affiliate) {
  console.log(`  [Claude] ${affiliate.name} 시스템 프롬프트 생성 중...`);

  const system = `당신은 한국어 SEO 블로그 에디터 시스템 프롬프트 작성 전문가다.`;
  const user = `아래 어필리에이트 정보를 바탕으로 블로그 에디터 시스템 프롬프트를 한국어로 작성하라.

어필리에이트:
- 이름: ${affiliate.name}
- URL: ${affiliate.url}
- 설명: ${affiliate.description ?? "(없음)"}
- 카테고리: ${affiliate.category}
- 공시: ${affiliate.disclosure}

요구사항:
1. 타겟 독자 명시 (누구를 위한 글인지)
2. 상품/서비스 포지셔닝 (경쟁 대비 차별점)
3. CTA 링크 규칙 (${affiliate.url})
4. 금지 표현 5개 이상 (과장/단정/경쟁사 비방 등)
5. SEO/콘텐츠 규칙 (제목 길이, 구조, 톤)
6. 출력 형식 규칙 (frontmatter 포함 마크다운)

마지막 줄: "출력 형식:\n반드시 아래 frontmatter를 포함한 완전한 마크다운 파일을 출력한다. 다른 설명·메타 텍스트·코드펜스 금지. frontmatter --- 로 시작해야 함."

시스템 프롬프트 텍스트만 출력. 설명 없음.`;

  return askClaude(system, user);
}

// ─── 초기 주제 자동 생성 ─────────────────────────────────────────────────────

async function generateInitialTopics(affiliate) {
  console.log(`  [Claude] ${affiliate.name} 초기 주제 10개 생성 중...`);

  const system = `당신은 한국어 SEO 콘텐츠 전략가다. JSON 배열만 출력한다.`;
  const user = `아래 어필리에이트를 위한 SEO 블로그 주제 10개를 생성하라.

어필리에이트: ${affiliate.name}
설명: ${affiliate.description ?? ""}
카테고리: ${affiliate.category}
URL: ${affiliate.url}

요구사항:
- 타겟 고객이 네이버에서 실제 검색할 법한 롱테일 키워드 기반
- 비교형("A vs B"), 비용형("~하는 비용"), 방법형("~하는 법"), 후기형 주제 균형
- 각 주제마다 구체 숫자/연도/상황 포함
- 제목 60자 이내

아래 JSON 배열 형식으로만 출력:
[
  {
    "topic": "주제명",
    "angle": "본문 각도 (숫자/상황 포함)",
    "keywords": ["메인키워드", "서브1", "서브2"],
    "slugHint": "english-kebab-slug"
  }
]`;

  const text = await askClaude(system, user);
  const parsed = parseJsonBlock(text);
  return Array.isArray(parsed) ? parsed : [];
}

// ─── 소스 추천 자동 생성 ─────────────────────────────────────────────────────

async function generateSourceRecommendations(affiliate) {
  console.log(`  [Claude] ${affiliate.name} 모니터링 소스 추천 중...`);

  const system = `당신은 한국어 디지털 마케팅 전략가다. JSON 배열만 출력한다.`;
  const user = `아래 어필리에이트의 타겟 고객이 자주 방문하는 한국 커뮤니티/웹사이트를 추천하라.

어필리에이트: ${affiliate.name}
설명: ${affiliate.description ?? ""}
카테고리: ${affiliate.category}

추천 기준:
1. 타겟 고객(잠재 구매자)이 가장 많이 모이는 커뮤니티
2. 경쟁사의 콘텐츠 마케팅 채널
3. 관련 정부/공공기관 사이트 (최신 정보 트래킹용)

아래 JSON 배열만 출력 (최대 5개):
[
  {
    "type": "naver-cafe" | "naver-search" | "web-crawl" | "competitor",
    "name": "사이트명",
    "cafeId": "카페 ID (naver-cafe만)",
    "url": "URL (web-crawl/competitor만)",
    "searchKeywords": ["검색어1", "검색어2"],
    "relevance": "왜 이 소스인지 한 문장"
  }
]`;

  const text = await askClaude(system, user);
  const parsed = parseJsonBlock(text);
  return Array.isArray(parsed) ? parsed : [];
}

// ─── generate-content.mjs 시스템 프롬프트 등록 ────────────────────────────

function registerSystemPrompt(affiliateName, systemPromptText) {
  const filePath = path.join(ROOT, "scripts", "generate-content.mjs");
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf-8");

  // SYSTEM_PROMPTS 객체 찾기
  if (content.includes(`${affiliateName}:`)) {
    console.log(`  [등록] ${affiliateName} 시스템 프롬프트 이미 존재 — 스킵`);
    return;
  }

  // 마지막 프롬프트 항목 뒤에 추가
  const marker = "};";
  const lastIdx = content.lastIndexOf("const SYSTEM_PROMPTS");
  if (lastIdx === -1) {
    console.warn(`  [경고] generate-content.mjs에서 SYSTEM_PROMPTS를 찾을 수 없음`);
    return;
  }

  // SYSTEM_PROMPTS 블록의 닫는 } 찾기
  let depth = 0;
  let insertAt = -1;
  for (let i = lastIdx; i < content.length; i++) {
    if (content[i] === "{") depth++;
    else if (content[i] === "}") {
      depth--;
      if (depth === 0) {
        insertAt = i;
        break;
      }
    }
  }

  if (insertAt === -1) return;

  const escapedPrompt = systemPromptText.replace(/`/g, "\\`").replace(/\$/g, "\\$");
  const entry = `,\n\n  ${affiliateName}: \`${escapedPrompt}\``;
  const updated = content.slice(0, insertAt) + entry + content.slice(insertAt);
  fs.writeFileSync(filePath, updated);
  console.log(`  [등록] ${affiliateName} 시스템 프롬프트 → generate-content.mjs`);
}

// ─── 단일 어필리에이트 초기화 ─────────────────────────────────────────────

async function initAffiliate(affiliate, affiliatesData, queue) {
  console.log(`\n── [${affiliate.name}] 초기화 ──`);

  // 1. contentDir 생성
  const contentDir = path.join(ROOT, affiliate.contentDir);
  fs.mkdirSync(contentDir, { recursive: true });
  console.log(`  [DIR] ${affiliate.contentDir} 생성`);

  // 2. description 없으면 추가 요청
  if (!affiliate.description) {
    console.warn(`  [경고] description 미설정. affiliates.json에 description 추가 권장.`);
  }

  // 3. 시스템 프롬프트 생성 + 등록
  const systemPrompt = await generateSystemPrompt(affiliate);
  registerSystemPrompt(affiliate.name, systemPrompt);

  // 4. sources 없으면 자동 생성
  const affInData = affiliatesData.affiliates.find((a) => a.name === affiliate.name);
  if (!affInData.sources || affInData.sources.length === 0) {
    const sources = await generateSourceRecommendations(affiliate);
    affInData.sources = sources;
    saveAffiliatesFile(affiliatesData);
    console.log(`  [소스] ${sources.length}개 추천 → affiliates.json 저장`);
  }

  // 5. 초기 주제 생성 → queue
  const existingTopics = (queue.queue[affiliate.name] ?? []).map((t) => t.topic);
  if (existingTopics.length < 5) {
    const topics = await generateInitialTopics(affiliate);
    if (!queue.queue[affiliate.name]) queue.queue[affiliate.name] = [];
    let added = 0;
    for (const t of topics) {
      if (!t.topic) continue;
      if (existingTopics.includes(t.topic)) continue;
      queue.queue[affiliate.name].push({
        topic: t.topic,
        angle: t.angle ?? "",
        keywords: t.keywords ?? [],
        slugHint: t.slugHint ?? "",
        status: "pending",
        discoveredAt: new Date().toISOString(),
        source: "add-affiliate 초기화",
      });
      existingTopics.push(t.topic);
      added++;
    }
    console.log(`  [주제] ${added}개 → topic-queue.json`);
  } else {
    console.log(`  [주제] 이미 ${existingTopics.length}개 있음 — 스킵`);
  }

  console.log(`  ✓ ${affiliate.name} 초기화 완료`);
}

// ─── 대화형 추가 ─────────────────────────────────────────────────────────────

async function interactiveAdd(affiliatesData, queue) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((res) => rl.question(q, res));

  console.log("\n새 어필리에이트 추가\n");

  const name = (await ask("어필리에이트 이름 (예: 밀리의서재): ")).trim();
  if (!name) { rl.close(); return; }

  if (affiliatesData.affiliates.find((a) => a.name === name)) {
    console.log(`이미 존재: ${name}`);
    rl.close();
    return;
  }

  const url = (await ask("어필리에이트 URL: ")).trim();
  const category = (await ask("카테고리 (tech/finance/beauty/home-living/travel): ")).trim() || "tech";
  const description = (await ask("서비스 설명 (타겟, 차별점 등): ")).trim();
  const disclosure = (await ask("공시 문구 (엔터 시 기본값): ")).trim() ||
    `이 포스팅은 ${name}의 파트너 활동으로 작성되었으며, 소정의 수수료를 받을 수 있습니다.`;

  rl.close();

  const affiliate = {
    name,
    contentDir: `${name}/content`,
    category,
    url,
    disclosure,
    author: "고른다 에디터",
    description,
    sources: [],
  };

  affiliatesData.affiliates.push(affiliate);
  saveAffiliatesFile(affiliatesData);
  console.log(`\naffilates.json에 ${name} 추가 완료`);

  await initAffiliate(affiliate, affiliatesData, queue);
  saveQueue(queue);
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (f) => { const i = args.indexOf(f); return i !== -1 ? args[i + 1] : null; };
  return {
    name: get("--name"),
    init: args.includes("--init"),
    initAll: args.includes("--init-all"),
  };
}

async function main() {
  loadEnv();
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY 필요");

  const opts = parseArgs();
  const affiliatesData = loadAffiliatesFile();
  const queue = loadQueue();

  if (opts.initAll) {
    for (const aff of affiliatesData.affiliates) {
      await initAffiliate(aff, affiliatesData, queue);
    }
    saveQueue(queue);
    return;
  }

  if (opts.name && opts.init) {
    const aff = affiliatesData.affiliates.find((a) => a.name === opts.name);
    if (!aff) throw new Error(`${opts.name} 없음. affiliates.json에 먼저 추가하세요.`);
    await initAffiliate(aff, affiliatesData, queue);
    saveQueue(queue);
    return;
  }

  // 대화형
  await interactiveAdd(affiliatesData, queue);
  saveQueue(queue);
}

main().catch((err) => {
  console.error(`오류: ${err.message}`);
  process.exit(1);
});
