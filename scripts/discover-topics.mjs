#!/usr/bin/env node
/**
 * 완전 자율 주제 발굴 스크립트
 *
 * 소스(커뮤니티·경쟁사) → Claude 주제 추출 → 키워드 검증 → topic-queue.json 추가
 *
 * Usage:
 *   node scripts/discover-topics.mjs                          # 전체 어필리에이트 발굴
 *   node scripts/discover-topics.mjs --affiliate 키퍼메이트    # 특정 어필리에이트만
 *   node scripts/discover-topics.mjs --dry                    # 발굴만, queue 추가 안함
 *   node scripts/discover-topics.mjs --min-score 30           # 최소 기회점수 필터
 *   node scripts/discover-topics.mjs --force                  # 큐 잔여 상관없이 강제 실행
 *   node scripts/discover-topics.mjs --per-affiliate 5        # 어필리에이트당 추가 주제 수
 *
 * 환경변수:
 *   ANTHROPIC_API_KEY                      — 주제 추출 (필수)
 *   NAVER_CLIENT_ID / NAVER_CLIENT_SECRET  — 카페/블로그 검색 API (있으면 사용)
 *   NAVER_API_KEY / NAVER_SA_SECRET / NAVER_ACCOUNT_ID — 키워드 검증 (있으면 사용)
 */

import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { collectNaverCafePlaywright } from "./scrapers/naver-cafe-playwright.mjs";
import { sessionExists } from "./naver-session.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const CLAUDE_MODEL = "claude-sonnet-4-6";
const NAVER_RATE_LIMIT_MS = 120;
const DEFAULT_MIN_PENDING = 5;
const DEFAULT_PER_AFFILIATE = 5;
const DEFAULT_MIN_SCORE = 20;
const MAX_ITEMS_PER_KEYWORD = 10;
const MAX_COMPETITOR_LINKS = 30;

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
}

// ─── affiliates / queue I/O ───────────────────────────────────────────────

/**
 * @returns {{name:string, contentDir:string, category:string, url:string, disclosure:string, author:string, description?:string, sources?: DiscoverySource[]}[]}
 */
function loadAffiliates() {
  const filePath = path.join(ROOT, "content-input", "affiliates.json");
  return JSON.parse(fs.readFileSync(filePath, "utf-8")).affiliates ?? [];
}

function loadQueue() {
  const queuePath = path.join(ROOT, "content-input", "topic-queue.json");
  if (!fs.existsSync(queuePath)) {
    return { updatedAt: new Date().toISOString().slice(0, 10), queue: {} };
  }
  return JSON.parse(fs.readFileSync(queuePath, "utf-8"));
}

function saveQueue(queue) {
  const queuePath = path.join(ROOT, "content-input", "topic-queue.json");
  queue.updatedAt = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));
}

// ─── rate-limited fetch helper ────────────────────────────────────────────

let lastNaverCall = 0;

async function rateLimitedFetch(url, init) {
  const delta = Date.now() - lastNaverCall;
  if (delta < NAVER_RATE_LIMIT_MS) {
    await new Promise((r) => setTimeout(r, NAVER_RATE_LIMIT_MS - delta));
  }
  lastNaverCall = Date.now();
  return fetch(url, init);
}

// ─── Naver Search API (cafearticle / blog) ────────────────────────────────

/**
 * @typedef {{type: "naver-cafe"|"naver-search"|"web-crawl"|"competitor", name: string, url?: string, cafeId?: string, searchKeywords?: string[], relevance?: string}} DiscoverySource
 * @typedef {{sourceName: string, sourceType: string, title: string, description: string, link: string, extra?: string}} CollectedItem
 */

/**
 * @param {string} endpoint "cafearticle" | "blog"
 * @param {string} query
 * @returns {Promise<{title:string, description:string, link:string, extra:string}[]>}
 */
async function callNaverSearch(endpoint, query) {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 미설정");
  }
  const url = `https://openapi.naver.com/v1/search/${endpoint}.json?query=${encodeURIComponent(query)}&display=${MAX_ITEMS_PER_KEYWORD}&sort=date`;
  const res = await rateLimitedFetch(url, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
  });
  if (!res.ok) {
    throw new Error(`Naver ${endpoint} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.items ?? []).map((raw) => ({
    title: stripHtml(raw.title ?? ""),
    description: stripHtml(raw.description ?? ""),
    link: raw.link ?? "",
    extra: raw.cafename || raw.bloggername || raw.postdate || "",
  }));
}

function stripHtml(text) {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

// ─── Source collectors ────────────────────────────────────────────────────

/**
 * naver-cafe 소스 수집:
 * 1. Playwright 세션 있으면 → 브라우저 크롤링 (조회수/댓글수 포함)
 * 2. 세션 없고 Naver Search API 키 있으면 → API fallback
 * 3. 둘 다 없으면 → 경고 후 빈 배열
 *
 * @param {DiscoverySource} source
 * @returns {Promise<CollectedItem[]>}
 */
async function collectNaverCafe(source) {
  // 우선순위 1: Playwright (세션 기반 — 조회수/댓글수 포함)
  if (sessionExists()) {
    console.log(`    → Playwright 세션 사용`);
    const playwrightItems = await collectNaverCafePlaywright({
      name: source.name,
      cafeId: source.cafeId ?? source.name,
      searchKeywords: source.searchKeywords ?? [],
    });
    return playwrightItems.map((a) => ({
      sourceName: a.sourceName,
      sourceType: a.sourceType,
      title: a.title,
      description: a.description,
      link: a.link,
      extra: `view=${a.viewCount} comment=${a.commentCount} date=${a.date}`,
    }));
  }

  // 우선순위 2: Naver Search Open API
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (clientId && clientSecret) {
    console.log(`    → Naver Search API fallback`);
    const out = [];
    for (const kw of source.searchKeywords ?? []) {
      try {
        const items = await callNaverSearch("cafearticle", kw);
        for (const raw of items) {
          out.push({
            sourceName: source.name,
            sourceType: "naver-cafe",
            title: raw.title,
            description: raw.description,
            link: raw.link,
            extra: `cafe=${raw.extra} query=${kw}`,
          });
        }
      } catch (err) {
        console.warn(`    [skip] ${source.name} cafearticle "${kw}": ${err.message.slice(0, 140)}`);
      }
    }
    return out;
  }

  console.warn(`    [skip] ${source.name}: 세션 없음 + NAVER_CLIENT_ID 없음. 'npm run naver-login' 실행 필요.`);
  return [];
}

/**
 * @param {DiscoverySource} source
 * @returns {Promise<CollectedItem[]>}
 */
async function collectNaverBlogSearch(source) {
  const out = [];
  for (const kw of source.searchKeywords ?? []) {
    try {
      const items = await callNaverSearch("blog", kw);
      for (const raw of items) {
        out.push({
          sourceName: source.name,
          sourceType: "naver-search",
          title: raw.title,
          description: raw.description,
          link: raw.link,
          extra: `blog=${raw.extra} query=${kw}`,
        });
      }
    } catch (err) {
      console.warn(`    [skip] ${source.name} blog "${kw}": ${err.message.slice(0, 140)}`);
    }
  }
  return out;
}

/**
 * @param {string} html
 * @returns {{href:string, text:string}[]}
 */
function extractAnchors(html) {
  const anchors = [];
  const regex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const href = match[1];
    const text = stripHtml(match[2]).replace(/\s+/g, " ").trim();
    if (!href || !text || text.length < 6) continue;
    if (href.startsWith("#") || href.startsWith("javascript:")) continue;
    anchors.push({ href, text });
  }
  return anchors;
}

/**
 * @param {DiscoverySource} source
 * @returns {Promise<CollectedItem[]>}
 */
async function collectWebCrawl(source) {
  if (!source.url) return [];
  try {
    const res = await fetch(source.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
      },
    });
    if (!res.ok) {
      console.warn(`    [skip] ${source.name} fetch ${res.status}`);
      return [];
    }
    const html = await res.text();
    const anchors = extractAnchors(html);
    const seen = new Set();
    const items = [];
    for (const anchor of anchors) {
      const key = anchor.text.slice(0, 40);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        sourceName: source.name,
        sourceType: source.type,
        title: anchor.text.slice(0, 160),
        description: "",
        link: absoluteUrl(anchor.href, source.url),
        extra: "",
      });
      if (items.length >= MAX_COMPETITOR_LINKS) break;
    }
    return items;
  } catch (err) {
    console.warn(`    [skip] ${source.name} crawl: ${err.message.slice(0, 140)}`);
    return [];
  }
}

function absoluteUrl(href, base) {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

/**
 * @param {DiscoverySource} source
 * @returns {Promise<CollectedItem[]>}
 */
async function collectSource(source) {
  console.log(`  · ${source.type} :: ${source.name}`);
  if (source.type === "naver-cafe") return collectNaverCafe(source);
  if (source.type === "naver-search") return collectNaverBlogSearch(source);
  if (source.type === "web-crawl" || source.type === "competitor") return collectWebCrawl(source);
  console.warn(`    [skip] 알 수 없는 source.type=${source.type}`);
  return [];
}

/**
 * @param {DiscoverySource[]} sources
 * @returns {Promise<CollectedItem[]>}
 */
async function collectAllSources(sources) {
  const all = [];
  for (const source of sources ?? []) {
    const items = await collectSource(source);
    console.log(`    → ${items.length}건`);
    all.push(...items);
  }
  return all;
}

// ─── Claude 주제 추출 ─────────────────────────────────────────────────────

/**
 * @typedef {{topic:string, angle:string, keywords:string[], source:string, rationale:string, slugHint:string}} TopicSuggestion
 */

const EXTRACTION_SYSTEM = `당신은 한국어 SEO 콘텐츠 전략가다. 커뮤니티·경쟁사 소스를 분석해 어필리에이트 블로그에서 즉시 집필할 수 있는 구체 주제를 뽑아낸다.

규칙:
- 커뮤니티에서 반복적으로 등장하는 고민·질문·후기를 찾아 "사장님이 검색할 법한" 주제로 변환
- 경쟁사 블로그 주제는 그대로 베끼지 말고, 검색 의도는 겹치되 각도를 바꿀 것
- 주제는 60자 이내, 구체 숫자/연도/상황 포함
- keywords는 한국어 검색 키워드 3~5개, 공백 없이 붙이거나 자연어 단어 모두 허용
- slugHint는 영문 kebab-case 5~7단어
- JSON 배열만 출력. 설명·코드펜스 금지`;

/**
 * @param {{name:string, description?:string}} affiliate
 * @param {CollectedItem[]} items
 * @param {string[]} existingTopics
 * @param {number} desiredCount
 */
function buildExtractionPrompt(affiliate, items, existingTopics, desiredCount) {
  const truncated = items.slice(0, 120).map((item, idx) => {
    const title = (item.title || "(무제)").slice(0, 140);
    const desc = (item.description || "").slice(0, 180);
    return `${idx + 1}. [${item.sourceType}|${item.sourceName}] ${title}${desc ? ` — ${desc}` : ""}${item.link ? ` (${item.link})` : ""}`;
  });

  const existingBlock = existingTopics.length
    ? existingTopics.map((t, i) => `${i + 1}. ${t}`).join("\n")
    : "(없음)";

  return `## 어필리에이트
이름: ${affiliate.name}
설명: ${affiliate.description ?? "(없음)"}

## 이미 큐에 있는 주제 (중복 금지)
${existingBlock}

## 수집된 소스 데이터 (총 ${items.length}건, 상위 ${truncated.length}건)
${truncated.join("\n")}

## 지시
위 소스에서 타겟 고객이 가장 많이 고민하는 주제를 ${desiredCount}개 뽑아 JSON 배열로만 반환하라.
각 원소는 아래 스키마를 따른다:
[
  {
    "topic": "60자 이내 한국어 주제",
    "angle": "본문에서 다룰 구체 각도(숫자/상황 포함)",
    "keywords": ["메인키워드", "서브키워드1", "서브키워드2", "서브키워드3"],
    "source": "근거 소스 이름 또는 '커뮤니티 분석'/'경쟁사 분석'",
    "rationale": "왜 이 주제인지 1~2문장 근거 (수집 데이터 기반)",
    "slugHint": "english-kebab-case-slug"
  }
]
JSON 배열 외 다른 문자 출력 금지.`;
}

/**
 * @param {{name:string, description?:string}} affiliate
 * @param {CollectedItem[]} items
 * @param {string[]} existingTopics
 * @param {number} desiredCount
 * @returns {Promise<TopicSuggestion[]>}
 */
async function extractTopicsWithClaude(affiliate, items, existingTopics, desiredCount) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY 없음 — 주제 추출 불가");
  }
  if (items.length === 0) {
    console.warn("    [LLM] 수집 데이터 0건 — 추출 스킵");
    return [];
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const userPrompt = buildExtractionPrompt(affiliate, items, existingTopics, desiredCount);

  console.log(`    [LLM] Claude 호출 (${items.length}건 입력, ${desiredCount}개 요청)`);
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system: EXTRACTION_SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
  });
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock) throw new Error("Claude 응답 text 블록 없음");

  return parseJsonArray(textBlock.text);
}

function parseJsonArray(text) {
  let body = text.trim();
  if (body.startsWith("```")) body = body.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  const firstBracket = body.indexOf("[");
  const lastBracket = body.lastIndexOf("]");
  if (firstBracket === -1 || lastBracket === -1) {
    console.warn(`    [LLM] JSON 배열 없음. 응답 앞부분: ${body.slice(0, 200)}`);
    return [];
  }
  try {
    const parsed = JSON.parse(body.slice(firstBracket, lastBracket + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn(`    [LLM] JSON 파싱 실패: ${err.message}`);
    return [];
  }
}

// ─── 키워드 검증 (Naver SA) ──────────────────────────────────────────────

function buildNaverSaHeaders(apiPath) {
  const { NAVER_API_KEY: key, NAVER_SA_SECRET: secret, NAVER_ACCOUNT_ID: id } = process.env;
  if (!key || !secret || !id) {
    throw new Error("NAVER_API_KEY / NAVER_SA_SECRET / NAVER_ACCOUNT_ID 미설정");
  }
  const ts = String(Date.now());
  const sig = crypto.createHmac("sha256", secret).update(`${ts}.GET.${apiPath}`).digest("base64");
  return { "X-Timestamp": ts, "X-API-KEY": key, "X-Customer": id, "X-Signature": sig };
}

function parseVolume(raw) {
  if (raw === "< 10" || raw == null) return 0;
  return Number(raw) || 0;
}

function parseCompetition(raw) {
  if (raw === "낮음" || raw === "LOW") return "low";
  if (raw === "중간" || raw === "MID") return "medium";
  if (raw === "높음" || raw === "HIGH") return "high";
  return null;
}

function computeOppScore(total, comp) {
  if (total === 0) return 0;
  const vol = Math.min(total / 50_000, 1) * 60;
  const c = comp === "low" ? 40 : comp === "medium" ? 20 : comp === "high" ? 5 : 10;
  return Math.round(vol + c);
}

async function queryKeywordBatch(batch) {
  const qs = new URLSearchParams({ hintKeywords: batch.join(","), showDetail: "1" });
  const apiPath = "/keywordstool";
  const res = await rateLimitedFetch(`https://api.naver.com${apiPath}?${qs}`, {
    headers: buildNaverSaHeaders(apiPath),
  });
  if (!res.ok) throw new Error(`SA API ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  return data.keywordList ?? [];
}

/**
 * @param {string[]} keywords
 * @returns {Promise<Map<string, {total:number, comp:string|null, score:number}>>}
 */
async function scoreKeywords(keywords) {
  const result = new Map();
  const unique = [...new Set(keywords.filter(Boolean))];
  if (unique.length === 0) return result;

  const BATCH = 5;
  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    try {
      const items = await queryKeywordBatch(batch);
      for (const item of items) {
        const kw = item.relKeyword;
        if (!batch.includes(kw) || result.has(kw)) continue;
        const pc = parseVolume(item.monthlyPcQcCnt);
        const mobile = parseVolume(item.monthlyMobileQcCnt);
        const total = pc + mobile;
        const comp = parseCompetition(item.compIdx);
        result.set(kw, { total, comp, score: computeOppScore(total, comp) });
      }
      for (const kw of batch) {
        if (!result.has(kw)) result.set(kw, { total: 0, comp: null, score: 0 });
      }
    } catch (err) {
      console.warn(`    [skip] SA batch "${batch.join(",")}": ${err.message.slice(0, 140)}`);
      for (const kw of batch) {
        if (!result.has(kw)) result.set(kw, { total: 0, comp: null, score: 0 });
      }
    }
  }
  return result;
}

/**
 * @param {TopicSuggestion[]} topics
 * @param {number} minScore
 * @returns {Promise<(TopicSuggestion & {opportunityScore:number})[]>}
 */
async function validateTopics(topics, minScore) {
  const allKeywords = topics.flatMap((t) => (t.keywords ?? []).slice(0, 3));
  if (allKeywords.length === 0) {
    console.log(`    [검증] 키워드 없음 — 전체 통과`);
    return topics.map((t) => ({ ...t, opportunityScore: 0 }));
  }

  let scoreMap;
  try {
    scoreMap = await scoreKeywords(allKeywords);
  } catch (err) {
    console.warn(`    [검증] SA API 사용 불가 — 필터 스킵: ${err.message.slice(0, 140)}`);
    return topics.map((t) => ({ ...t, opportunityScore: 0 }));
  }

  const scored = topics.map((t) => {
    const topScore = Math.max(
      0,
      ...(t.keywords ?? []).slice(0, 3).map((kw) => scoreMap.get(kw)?.score ?? 0)
    );
    return { ...t, opportunityScore: topScore };
  });

  const passed = scored.filter((t) => t.opportunityScore >= minScore);
  console.log(`    [검증] ${scored.length}개 → 통과 ${passed.length}개 (min score ${minScore})`);
  return passed;
}

// ─── 중복 제거 ───────────────────────────────────────────────────────────

function normalizeText(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * @param {string} topic
 * @param {string[]} existing
 */
function isDuplicate(topic, existing) {
  const needle = normalizeText(topic);
  if (!needle) return true;
  for (const prev of existing) {
    const hay = normalizeText(prev);
    if (!hay) continue;
    if (hay.includes(needle) || needle.includes(hay)) return true;
    if (overlapRatio(needle, hay) >= 0.7) return true;
  }
  return false;
}

function overlapRatio(a, b) {
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  if (shorter.length < 4) return 0;
  let matches = 0;
  for (let i = 0; i <= shorter.length - 4; i++) {
    if (longer.includes(shorter.slice(i, i + 4))) matches++;
  }
  return matches / Math.max(1, shorter.length - 3);
}

// ─── queue 추가 ──────────────────────────────────────────────────────────

/**
 * @param {object} queue
 * @param {string} affiliateName
 * @param {(TopicSuggestion & {opportunityScore:number})[]} topics
 * @returns {number} added count
 */
function appendToQueue(queue, affiliateName, topics) {
  if (!queue.queue[affiliateName]) queue.queue[affiliateName] = [];
  const existing = queue.queue[affiliateName].map((t) => t.topic);
  const now = new Date().toISOString();
  let added = 0;

  for (const suggestion of topics) {
    if (!suggestion.topic) continue;
    if (isDuplicate(suggestion.topic, existing)) {
      console.log(`    · [중복] ${suggestion.topic}`);
      continue;
    }
    queue.queue[affiliateName].push({
      topic: suggestion.topic,
      angle: suggestion.angle ?? "",
      keywords: Array.isArray(suggestion.keywords) ? suggestion.keywords : [],
      slugHint: suggestion.slugHint ?? "",
      status: "pending",
      discoveredAt: now,
      source: suggestion.source ?? "discovery",
      rationale: suggestion.rationale ?? "",
      opportunityScore: suggestion.opportunityScore ?? 0,
    });
    existing.push(suggestion.topic);
    added++;
    console.log(`    · [추가] ${suggestion.topic} (score ${suggestion.opportunityScore})`);
  }
  return added;
}

// ─── 단일 어필리에이트 처리 ───────────────────────────────────────────────

function countPending(queue, affiliateName) {
  const list = queue.queue[affiliateName] ?? [];
  return list.filter((t) => t.status === "pending").length;
}

async function discoverForAffiliate({ affiliate, queue, opts }) {
  console.log(`\n── [${affiliate.name}] 주제 발굴 ──`);

  const pending = countPending(queue, affiliate.name);
  if (!opts.force && pending >= DEFAULT_MIN_PENDING) {
    console.log(`  pending ${pending}개 충분 — 발굴 스킵 (--force로 강제 실행)`);
    return { added: 0, collected: 0, suggestions: 0 };
  }

  const sources = affiliate.sources ?? [];
  if (sources.length === 0) {
    console.log(`  sources 미설정 — 스킵`);
    return { added: 0, collected: 0, suggestions: 0 };
  }

  const collected = await collectAllSources(sources);
  console.log(`  수집 합계: ${collected.length}건`);

  const existingTopics = (queue.queue[affiliate.name] ?? []).map((t) => t.topic);
  const suggestions = await extractTopicsWithClaude(
    affiliate,
    collected,
    existingTopics,
    opts.perAffiliate
  );
  console.log(`  Claude 제안: ${suggestions.length}개`);

  const validated = await validateTopics(suggestions, opts.minScore);

  if (opts.dry) {
    console.log(`  [DRY] 추가 없이 출력만`);
    for (const t of validated) {
      console.log(`    · ${t.topic} [score ${t.opportunityScore}] — ${t.rationale ?? ""}`);
    }
    return { added: 0, collected: collected.length, suggestions: validated.length };
  }

  const added = appendToQueue(queue, affiliate.name, validated);
  return { added, collected: collected.length, suggestions: validated.length };
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
    dry: args.includes("--dry"),
    force: args.includes("--force"),
    minScore: parseInt(get("--min-score") || String(DEFAULT_MIN_SCORE), 10),
    perAffiliate: parseInt(get("--per-affiliate") || String(DEFAULT_PER_AFFILIATE), 10),
  };
}

async function main() {
  loadEnv();
  const opts = parseArgs();

  console.log(`\n${"═".repeat(60)}`);
  console.log(`주제 발굴 ${opts.dry ? "[DRY]" : ""}${opts.force ? "[FORCE]" : ""}`);
  console.log(`  min-score=${opts.minScore} per-affiliate=${opts.perAffiliate}`);
  console.log(`${"═".repeat(60)}`);

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY 필요. .env.local 또는 CREDENTIALS.md에 추가.");
  }
  if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET) {
    console.warn("  [WARN] NAVER_CLIENT_ID/SECRET 미설정 — 카페/블로그 소스는 스킵됨");
  }

  const affiliates = loadAffiliates();
  const targets = opts.affiliate
    ? affiliates.filter((a) => a.name === opts.affiliate)
    : affiliates;

  if (targets.length === 0) {
    throw new Error(`대상 어필리에이트 없음: ${opts.affiliate ?? "(전체)"}`);
  }

  const queue = loadQueue();
  const summary = [];

  for (const affiliate of targets) {
    try {
      const result = await discoverForAffiliate({ affiliate, queue, opts });
      summary.push({ name: affiliate.name, ...result });
    } catch (err) {
      console.error(`  [ERROR] ${affiliate.name}: ${err.message}`);
      summary.push({ name: affiliate.name, added: 0, collected: 0, suggestions: 0, error: err.message });
    }
  }

  if (!opts.dry) {
    saveQueue(queue);
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`발굴 결과 요약`);
  console.log(`${"═".repeat(60)}`);
  for (const row of summary) {
    const err = row.error ? ` (오류: ${row.error.slice(0, 60)})` : "";
    console.log(
      `  [${row.name}] 수집 ${row.collected} / 제안 ${row.suggestions} / 큐 추가 ${row.added}${err}`
    );
  }
}

main().catch((err) => {
  console.error(`\n오류: ${err.message}`);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
