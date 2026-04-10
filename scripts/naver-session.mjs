#!/usr/bin/env node
/**
 * 네이버 로그인 세션 관리자
 *
 * 최초 1회: 브라우저 열어서 수동 로그인 → .naver-session.json 저장
 * 이후: headless 모드로 저장된 세션 재사용
 *
 * Usage:
 *   node scripts/naver-session.mjs login    # 브라우저 열어서 로그인 + 세션 저장
 *   node scripts/naver-session.mjs check    # 세션 유효성 확인
 *   node scripts/naver-session.mjs clear    # 세션 삭제
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SESSION_PATH = path.join(ROOT, ".naver-session.json");

const NAVER_LOGIN_URL = "https://nid.naver.com/nidlogin.login";
const NAVER_CHECK_URL = "https://www.naver.com/";
const LOGIN_TIMEOUT_MS = 180_000; // 3분 내 로그인 완료
const HEADLESS_TIMEOUT_MS = 15_000;

// ─── 세션 저장/로드 ─────────────────────────────────────────────────────────

export function sessionExists() {
  return fs.existsSync(SESSION_PATH);
}

export function loadSession() {
  if (!sessionExists()) return null;
  try {
    return JSON.parse(fs.readFileSync(SESSION_PATH, "utf-8"));
  } catch {
    return null;
  }
}

function saveSession(state) {
  fs.writeFileSync(SESSION_PATH, JSON.stringify(state, null, 2));
  console.log(`  [세션] 저장 완료: ${SESSION_PATH}`);
}

export function clearSession() {
  if (fs.existsSync(SESSION_PATH)) {
    fs.unlinkSync(SESSION_PATH);
    console.log("  [세션] 삭제 완료");
  }
}

// ─── 로그인 감지 ─────────────────────────────────────────────────────────────

/**
 * @param {import('playwright').Page} page
 * @returns {Promise<boolean>}
 */
async function isLoggedIn(page) {
  try {
    await page.goto(NAVER_CHECK_URL, { waitUntil: "domcontentloaded", timeout: HEADLESS_TIMEOUT_MS });
    // 로그인 상태: #account .link_login 없거나, .MyView-module__my_info 존재
    const logoutBtn = await page.locator('a[href*="logout"]').count();
    const loginBtn = await page.locator('a[href*="nidlogin"]').count();
    return logoutBtn > 0 || loginBtn === 0;
  } catch {
    return false;
  }
}

// ─── 대화형 로그인 (브라우저 보임) ──────────────────────────────────────────

export async function interactiveLogin() {
  console.log("\n브라우저를 엽니다. 네이버에 로그인하세요.");
  console.log("로그인 완료 후 자동으로 세션이 저장됩니다.\n");

  const browser = await chromium.launch({
    headless: false,
    args: ["--no-first-run", "--no-default-browser-check"],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: "ko-KR",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
  });

  const page = await context.newPage();
  await page.goto(NAVER_LOGIN_URL);

  console.log("로그인 대기 중...");
  console.log("(최대 3분, 2단계 인증 포함 가능)\n");

  // 로그인 완료 감지: naver.com 메인으로 이동 + 로그인 쿠키 존재
  try {
    await page.waitForURL(
      (url) => !url.toString().includes("nidlogin") && url.toString().includes("naver.com"),
      { timeout: LOGIN_TIMEOUT_MS }
    );
  } catch {
    console.error("로그인 타임아웃 (3분 초과). 다시 시도하세요.");
    await browser.close();
    return false;
  }

  // 추가 확인: 로그인 상태인지
  const loggedIn = await isLoggedIn(page);
  if (!loggedIn) {
    console.error("로그인 상태를 확인할 수 없습니다. 다시 시도하세요.");
    await browser.close();
    return false;
  }

  const state = await context.storageState();
  saveSession(state);
  console.log("로그인 성공! 세션이 저장되었습니다.");
  await browser.close();
  return true;
}

// ─── 세션 유효성 확인 ────────────────────────────────────────────────────────

export async function checkSession() {
  const session = loadSession();
  if (!session) {
    console.log("세션 없음. `npm run naver-login` 실행 필요.");
    return false;
  }

  console.log("  [세션] 유효성 확인 중...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: session });
  const page = await context.newPage();

  const valid = await isLoggedIn(page);
  await browser.close();

  if (valid) {
    console.log("  [세션] 유효");
  } else {
    console.log("  [세션] 만료. `npm run naver-login` 재실행 필요.");
  }
  return valid;
}

// ─── 세션 기반 컨텍스트 생성 (scraper에서 사용) ────────────────────────────

/**
 * 저장된 세션으로 headless 브라우저 컨텍스트 생성.
 * 세션 없으면 null 반환.
 *
 * @returns {Promise<{browser: import('playwright').Browser, context: import('playwright').BrowserContext} | null>}
 */
export async function createSessionContext() {
  const session = loadSession();
  if (!session) return null;

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const context = await browser.newContext({
    storageState: session,
    locale: "ko-KR",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
  });
  return { browser, context };
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

async function main() {
  const cmd = process.argv[2];

  if (cmd === "login") {
    const ok = await interactiveLogin();
    process.exit(ok ? 0 : 1);
  } else if (cmd === "check") {
    const ok = await checkSession();
    process.exit(ok ? 0 : 1);
  } else if (cmd === "clear") {
    clearSession();
  } else {
    console.log(`
Usage:
  node scripts/naver-session.mjs login   # 브라우저 열어서 로그인
  node scripts/naver-session.mjs check   # 세션 유효성 확인
  node scripts/naver-session.mjs clear   # 세션 삭제
`);
  }
}

main().catch((err) => {
  console.error(`오류: ${err.message}`);
  process.exit(1);
});
