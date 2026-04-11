#!/usr/bin/env node
/**
 * keeper.ceo/blog 크롤러
 *
 * 한화비전 키퍼 공식 블로그(SEO 대행사 운영)의 포스트 목록과
 * 각 포스트의 메타데이터·요약을 수집한다.
 *
 * 사용 예:
 *   node scripts/scrapers/keeper-blog-crawler.mjs
 *   node scripts/scrapers/keeper-blog-crawler.mjs --limit 10
 *   node scripts/scrapers/keeper-blog-crawler.mjs --headed
 *
 * 출력: content-input/competitor-intel/keeper-blog.json
 *
 * 저작권: 본문을 그대로 복제하지 않는다. 제목·카테고리·날짜·요약(500자)만 저장.
 *
 * @module scrapers/keeper-blog-crawler
 */

import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");

const BASE_URL = "https://keeper.ceo/blog";
const OUTPUT_PATH = path.join(PROJECT_ROOT, "content-input/competitor-intel/keeper-blog.json");
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const PAGE_TIMEOUT = 30_000;
const DELAY_BETWEEN_POSTS_MS = 1_200;
const EXCERPT_MAX = 500;

/**
 * 간이 CLI 파서. --flag / --flag=value / --flag value 지원.
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const args = { headless: true, limit: Infinity };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--headed") args.headless = false;
    else if (a === "--headless") args.headless = true;
    else if (a === "--limit") args.limit = parseInt(argv[++i] ?? "0", 10) || Infinity;
    else if (a.startsWith("--limit=")) args.limit = parseInt(a.split("=")[1], 10) || Infinity;
  }
  return args;
}

/**
 * 메인 블로그 리스트 페이지에서 포스트 URL 전부 수집.
 * keeper.ceo/blog 는 현재 페이지네이션 없이 단일 페이지에 전체 노출.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<string[]>}
 */
async function collectPostUrls(page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT });
  // 리스트 렌더링을 위해 첫 포스트 링크가 DOM에 잡힐 때까지 대기
  await page.waitForSelector('a[href*="/blog/"]', { timeout: PAGE_TIMEOUT });
  await page.waitForTimeout(1_500);

  // 하단 로드가 있을 경우 대비해 2회 스크롤
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1_200);
  }

  const urls = await page.evaluate((base) => {
    const anchors = Array.from(document.querySelectorAll('a[href*="/blog/"]'));
    const hrefs = anchors
      .map((a) => a.getAttribute("href") ?? "")
      .filter((h) => h && h.includes("/blog/") && !h.endsWith("/blog") && !h.endsWith("/blog/"))
      .map((h) => {
        if (h.startsWith("http")) return h;
        if (h.startsWith("/")) return `https://keeper.ceo${h}`;
        return `${base}/${h}`;
      });
    return [...new Set(hrefs)];
  }, BASE_URL);

  return urls;
}

/**
 * 한국어 제목/요약에서 조사/어미/기호를 제거하고 단어 단위로 분해.
 * 빈도 기준 상위 6개를 키워드로 반환.
 *
 * @param {string} text
 * @returns {string[]}
 */
function extractKeywords(text) {
  if (!text) return [];
  const cleaned = text
    .replace(/[^\uAC00-\uD7A3a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const stop = new Set([
    "있어요", "있을까", "하는", "하기", "하세요", "합니다", "입니다", "니다", "이에요",
    "우리", "매장", "사장", "사장님", "가게", "방법", "가이드", "총정리", "완벽", "필수",
    "추천", "이용", "위한", "대해", "대한", "그리고", "하지만", "하는법", "어떻게",
    "없이", "대한", "정말", "지금", "저희", "위해", "되는", "되어", "위한",
  ]);
  const words = cleaned.split(" ").filter((w) => w.length >= 2 && !stop.has(w));
  const counts = new Map();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([w]) => w);
}

/**
 * 상세 페이지에서 제목, 날짜, 카테고리, 요약(500자), h2 섹션 리스트 추출.
 *
 * keeper.ceo 블로그 구조:
 *   - h1: 포스트 제목
 *   - 본문 상단 텍스트: "{제목}\n{카테고리}\n{YYYY.MM.DD}..."
 *   - meta[name=description]: SEO 요약
 *   - h2 : 섹션 제목들
 *
 * @param {import('playwright').Page} page
 * @param {string} url
 */
async function scrapePostDetail(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT });
  // h1이 실제로 렌더링될 때까지 최대 8초 대기
  try {
    await page.waitForFunction(
      () => (document.querySelector("h1")?.textContent?.trim()?.length ?? 0) > 0,
      { timeout: 8_000 }
    );
  } catch {
    // 못 찾으면 일단 진행 (아래 title이 빈 문자열이면 호출부에서 재시도)
  }

  return page.evaluate((maxLen) => {
    const title = document.querySelector("h1")?.textContent?.trim() ?? "";
    const metaDesc =
      document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "";
    const ogDesc =
      document.querySelector('meta[property="og:description"]')?.getAttribute("content") ?? "";

    const article = document.querySelector("article, main") ?? document.body;
    const rawText = (article.innerText ?? "").replace(/\s+\n/g, "\n").trim();

    // 본문 앞 부분에서 카테고리·날짜 추출: "{제목}\n{카테고리}\n{YYYY.MM.DD}..."
    const headLines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
    let category = "";
    let publishedAt = "";
    for (let i = 0; i < Math.min(headLines.length, 6); i++) {
      const line = headLines[i];
      if (/^20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}/.test(line)) {
        publishedAt = line;
        if (i > 0 && !category) category = headLines[i - 1];
        break;
      }
    }

    // 섹션 제목 (h2)
    const sections = Array.from(document.querySelectorAll("h2"))
      .map((h) => h.textContent?.trim() ?? "")
      .filter((t) => t && t.length >= 2 && !t.includes("추천 아티클"))
      .slice(0, 15);

    // 요약: metaDesc 우선, 없으면 본문에서 제목·카테고리·날짜 줄 제거 후 500자
    let excerpt = metaDesc || ogDesc;
    if (!excerpt) {
      const skip = new Set([title, category, publishedAt]);
      const body = headLines.filter((l) => !skip.has(l)).join(" ");
      excerpt = body.slice(0, maxLen);
    } else {
      excerpt = excerpt.slice(0, maxLen);
    }

    return { title, category, publishedAt, excerpt, sections };
  }, EXCERPT_MAX);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log("[keeper-blog] 크롤링 시작");
  console.log(`  base: ${BASE_URL}`);
  console.log(`  headless: ${args.headless}`);
  console.log(`  limit: ${args.limit === Infinity ? "전체" : args.limit}`);

  const browser = await chromium.launch({ headless: args.headless });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  // 이미지·폰트 차단해서 속도 향상
  await page.route("**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf,otf}", (route) =>
    route.abort()
  );

  const posts = [];

  try {
    const urls = await collectPostUrls(page);
    console.log(`  [1단계] 포스트 URL ${urls.length}건 수집`);
    const targetUrls = urls.slice(0, Math.min(urls.length, args.limit));

    for (let i = 0; i < targetUrls.length; i++) {
      const url = targetUrls[i];
      try {
        let detail = await scrapePostDetail(page, url);
        // 제목이 비었으면 1회 재시도
        if (!detail.title) {
          await new Promise((r) => setTimeout(r, 1_500));
          detail = await scrapePostDetail(page, url);
        }
        const slug = url.replace(/\/$/, "").split("/").pop() ?? "";
        const keywords = extractKeywords(`${detail.title} ${detail.sections.join(" ")}`);

        posts.push({
          url,
          slug,
          title: detail.title,
          publishedAt: detail.publishedAt,
          category: detail.category,
          tags: [],
          excerpt: detail.excerpt,
          sections: detail.sections,
          keywords,
        });

        console.log(
          `  [${i + 1}/${targetUrls.length}] ${detail.publishedAt || "날짜미상"} | ${detail.category || "카테고리없음"} | ${detail.title.slice(0, 40)}`
        );
      } catch (err) {
        console.warn(`  [${i + 1}/${targetUrls.length}] 실패: ${url} (${err.message.slice(0, 100)})`);
      }

      // rate limit
      if (i < targetUrls.length - 1) {
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_POSTS_MS));
      }
    }
  } finally {
    await browser.close();
  }

  // 날짜 기준 최신순 정렬
  posts.sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""));

  const output = {
    crawledAt: new Date().toISOString(),
    source: BASE_URL,
    totalPosts: posts.length,
    posts,
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf-8");

  console.log(`\n[keeper-blog] 완료 — ${posts.length}건 저장`);
  console.log(`  → ${path.relative(PROJECT_ROOT, OUTPUT_PATH)}`);
}

main().catch((err) => {
  console.error("[keeper-blog] 치명적 오류:", err);
  process.exit(1);
});
