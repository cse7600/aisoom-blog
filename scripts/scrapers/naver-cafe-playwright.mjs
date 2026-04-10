#!/usr/bin/env node
/**
 * 네이버 카페 Playwright 크롤러
 *
 * 저장된 세션(.naver-session.json)을 재사용하여 headless 모드로 게시글 수집.
 * 세션 만료 시 자동으로 경고 후 fallback(Naver Search API) 사용.
 *
 * @module scrapers/naver-cafe-playwright
 */

import { createSessionContext, sessionExists } from "../naver-session.mjs";

const PAGE_TIMEOUT = 20_000;
const DELAY_BETWEEN_PAGES_MS = 800;
const MAX_ARTICLES_PER_CAFE = 30;

/**
 * @typedef {{
 *   title: string,
 *   description: string,
 *   link: string,
 *   viewCount: number,
 *   commentCount: number,
 *   date: string,
 *   author: string,
 *   sourceName: string,
 *   sourceType: 'naver-cafe-playwright'
 * }} CafeArticle
 */

/**
 * @param {string} text
 * @returns {number}
 */
function parseCount(text) {
  if (!text) return 0;
  const n = text.replace(/[^0-9]/g, "");
  return n ? parseInt(n, 10) : 0;
}

/**
 * 카페 iframe 내 게시글 목록 페이지 크롤링.
 *
 * 네이버 카페는 메인 페이지 + cafe_main iframe 구조.
 * iframe URL: https://cafe.naver.com/ArticleList.nhn?search.clubid=...
 *
 * @param {import('playwright').Page} page
 * @param {string} cafeName
 * @param {string} cafeId
 * @returns {Promise<CafeArticle[]>}
 */
async function scrapeCafeArticles(page, cafeName, cafeId) {
  const articles = [];

  try {
    // 카페 메인 접근
    await page.goto(`https://cafe.naver.com/${cafeId}`, {
      waitUntil: "domcontentloaded",
      timeout: PAGE_TIMEOUT,
    });

    // iframe 찾기 (cafe_main 이름 또는 src 패턴)
    let frame = page.frame("cafe_main");
    if (!frame) {
      const iframeEl = page.locator('iframe#cafe_main, iframe[name="cafe_main"]').first();
      try {
        await iframeEl.waitFor({ timeout: 8_000 });
        frame = await iframeEl.contentFrame();
      } catch {
        // iframe 없으면 최신 SPA 구조일 수 있음 → 직접 접근 시도
        frame = null;
      }
    }

    const target = frame ?? page;

    // 게시글 목록 selector (네이버 카페 article-board-list 구조)
    // 2024+ 구조: .article-board tr, .board-list li, .cafe_list tr
    const rowSelectors = [
      ".article-board tbody tr",
      ".board-list li.item",
      "table.board-list tr[class]",
      ".cafe-list-wrap .cafe-list li",
    ];

    let rows = null;
    for (const sel of rowSelectors) {
      const count = await target.locator(sel).count();
      if (count > 0) {
        rows = target.locator(sel);
        break;
      }
    }

    if (!rows) {
      console.warn(`    [카페] ${cafeName}: 게시글 selector 매칭 실패`);
      return articles;
    }

    const rowCount = Math.min(await rows.count(), MAX_ARTICLES_PER_CAFE);

    for (let i = 0; i < rowCount; i++) {
      try {
        const row = rows.nth(i);
        const titleEl = row.locator("a.article, a.subject, .article-title a, td.td_article a").first();
        const title = (await titleEl.textContent({ timeout: 3_000 }))?.trim() ?? "";
        if (!title || title.length < 4) continue;

        const href = await titleEl.getAttribute("href") ?? "";
        const link = href.startsWith("http") ? href : `https://cafe.naver.com${href}`;

        const viewText = (await row.locator(".td_view, .view, .hit").first().textContent({ timeout: 2_000 }).catch(() => "0"));
        const commentText = (await row.locator(".td_comment, .comment_cnt, .count_comment").first().textContent({ timeout: 2_000 }).catch(() => "0"));
        const dateText = (await row.locator(".td_date, .date, .time").first().textContent({ timeout: 2_000 }).catch(() => ""));
        const authorText = (await row.locator(".td_name, .author, .writer").first().textContent({ timeout: 2_000 }).catch(() => ""));

        articles.push({
          title,
          description: "",
          link,
          viewCount: parseCount(viewText),
          commentCount: parseCount(commentText),
          date: dateText?.trim() ?? "",
          author: authorText?.trim() ?? "",
          sourceName: cafeName,
          sourceType: "naver-cafe-playwright",
        });
      } catch {
        // 개별 행 파싱 실패는 건너뜀
      }
    }
  } catch (err) {
    console.warn(`    [카페] ${cafeName} 크롤링 실패: ${err.message.slice(0, 140)}`);
  }

  return articles;
}

/**
 * 카페 내 키워드 검색 결과 크롤링.
 *
 * @param {import('playwright').Page} page
 * @param {string} cafeName
 * @param {string} cafeId
 * @param {string} keyword
 * @returns {Promise<CafeArticle[]>}
 */
async function searchCafeKeyword(page, cafeName, cafeId, keyword) {
  const articles = [];

  try {
    const searchUrl = `https://cafe.naver.com/f-e/${cafeId}/search?q=${encodeURIComponent(keyword)}&where=article`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT });

    await new Promise((r) => setTimeout(r, DELAY_BETWEEN_PAGES_MS));

    // 검색 결과 iframe 또는 직접 렌더링
    let frame = page.frame("cafe_main");
    if (!frame) {
      const iframeEl = page.locator('iframe#cafe_main').first();
      try {
        await iframeEl.waitFor({ timeout: 6_000 });
        frame = await iframeEl.contentFrame();
      } catch {
        frame = null;
      }
    }

    const target = frame ?? page;

    // 검색 결과 셀렉터
    const itemSelectors = [
      ".search-article li",
      ".article-board tbody tr",
      ".board-list li",
    ];

    let items = null;
    for (const sel of itemSelectors) {
      const count = await target.locator(sel).count();
      if (count > 0) {
        items = target.locator(sel);
        break;
      }
    }

    if (!items) return articles;

    const count = Math.min(await items.count(), 15);
    for (let i = 0; i < count; i++) {
      try {
        const item = items.nth(i);
        const titleEl = item.locator("a.article, a.subject, .article-title a, .subject a").first();
        const title = (await titleEl.textContent({ timeout: 3_000 }))?.trim() ?? "";
        if (!title || title.length < 4) continue;

        const href = await titleEl.getAttribute("href") ?? "";
        const link = href.startsWith("http") ? href : `https://cafe.naver.com${href}`;

        const commentText = await item.locator(".comment_cnt, .count_comment, [class*='comment']").first().textContent({ timeout: 2_000 }).catch(() => "0");

        articles.push({
          title,
          description: "",
          link,
          viewCount: 0,
          commentCount: parseCount(commentText),
          date: "",
          author: "",
          sourceName: `${cafeName}(검색:${keyword})`,
          sourceType: "naver-cafe-playwright",
        });
      } catch {
        // 건너뜀
      }
    }
  } catch (err) {
    console.warn(`    [카페검색] ${cafeName} "${keyword}": ${err.message.slice(0, 120)}`);
  }

  return articles;
}

/**
 * 단일 카페 소스에 대해 게시글 + 키워드 검색 결과 수집.
 *
 * @param {{name: string, cafeId: string, searchKeywords?: string[]}} source
 * @returns {Promise<CafeArticle[]>}
 */
export async function collectNaverCafePlaywright(source) {
  if (!sessionExists()) {
    console.warn(`    [카페] 세션 없음 — Playwright 스킵. 'npm run naver-login' 실행 필요.`);
    return [];
  }

  const ctx = await createSessionContext();
  if (!ctx) {
    console.warn(`    [카페] 세션 로드 실패`);
    return [];
  }

  const { browser, context } = ctx;
  const page = await context.newPage();

  // 불필요한 리소스 차단 (속도 향상)
  await page.route("**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf,otf}", (route) => route.abort());
  await page.route("**/ad.naver.com/**", (route) => route.abort());

  const allArticles = [];

  try {
    // 1. 최근 게시글 목록 수집
    const listArticles = await scrapeCafeArticles(page, source.name, source.cafeId);
    allArticles.push(...listArticles);
    console.log(`    → 목록 ${listArticles.length}건`);

    // 2. 키워드 검색
    for (const kw of source.searchKeywords ?? []) {
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_PAGES_MS));
      const searchArticles = await searchCafeKeyword(page, source.name, source.cafeId, kw);
      allArticles.push(...searchArticles);
      console.log(`    → 검색 "${kw}" ${searchArticles.length}건`);
    }
  } finally {
    await browser.close();
  }

  // 조회수+댓글수 기준 정렬 → 상위 항목이 먼저
  allArticles.sort((a, b) => (b.viewCount + b.commentCount * 3) - (a.viewCount + a.commentCount * 3));

  return allArticles;
}
