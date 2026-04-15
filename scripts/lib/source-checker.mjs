/**
 * 출처 URL 검증 모듈
 *
 * Phase 9.7.1 — 출처 링크 신뢰성 업그레이드
 *
 * 역할:
 *   - HEAD 요청 우선, 4xx/5xx/405 시 GET 폴백
 *   - 3xx 체인 추적 (최대 5회)
 *   - DNS 오류, 타임아웃, 프로토콜 오류 구분
 *   - 호스트별 동시성 제한 + 전역 concurrency
 *   - 결과 캐시 (.source-cache.json, TTL 7일)
 *
 * 사용:
 *   import { checkUrl, checkUrlsBatch } from "./lib/source-checker.mjs";
 */

import fs from "fs";
import path from "path";
import dns from "dns/promises";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const CACHE_FILE = path.join(ROOT, ".source-cache.json");
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// 일부 정부·공공 사이트는 Node fetch UA를 차단한다. Safari UA 폴백 사용.
const BOT_UA = "factnote-source-verifier/1.0 (+https://www.factnote.co.kr)";
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_CONCURRENCY = 5;
const PER_HOST_LIMIT = 2;

// ─────────────────────────────────────────────────────────────
// 캐시
// ─────────────────────────────────────────────────────────────
let cacheData = null;

export function loadCache() {
  if (cacheData) return cacheData;
  try {
    if (fs.existsSync(CACHE_FILE)) {
      cacheData = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
    } else {
      cacheData = {};
    }
  } catch {
    cacheData = {};
  }
  return cacheData;
}

export function saveCache() {
  if (!cacheData) return;
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2));
  } catch (err) {
    console.error("[source-checker] cache save failed:", err.message);
  }
}

function readCache(url) {
  const cache = loadCache();
  const hit = cache[url];
  if (!hit) return null;
  if (Date.now() - hit.checkedAt > CACHE_TTL_MS) return null;
  return hit;
}

function writeCache(url, result) {
  const cache = loadCache();
  cache[url] = { ...result, checkedAt: Date.now() };
}

// ─────────────────────────────────────────────────────────────
// 단일 URL 검증
// ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} CheckResult
 * @property {string} url 원본 URL
 * @property {string} finalUrl 3xx 체인 종착지
 * @property {number|null} status HTTP 상태 코드
 * @property {boolean} ok 200~399 (정확히는 2xx)
 * @property {"ok"|"dns"|"timeout"|"http_error"|"network"|"unknown"} reason
 * @property {string|null} error
 */

/**
 * URL 검증
 * @param {string} url
 * @param {{timeoutMs?:number, skipCache?:boolean}} [opts]
 * @returns {Promise<CheckResult>}
 */
export async function checkUrl(url, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!opts.skipCache) {
    const cached = readCache(url);
    if (cached) return { ...cached, cached: true };
  }

  const tryRequest = async (method, ua) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method,
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": ua,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
        },
      });
      return { status: response.status, finalUrl: response.url };
    } finally {
      clearTimeout(timer);
    }
  };

  const attempts = [
    { method: "HEAD", ua: BOT_UA },
    { method: "GET", ua: BOT_UA },
    { method: "HEAD", ua: BROWSER_UA },
    { method: "GET", ua: BROWSER_UA },
  ];

  let lastError = null;
  let result = null;
  for (const { method, ua } of attempts) {
    try {
      const res = await tryRequest(method, ua);
      if (res.status >= 200 && res.status < 400 && res.status !== 405) {
        result = {
          url,
          finalUrl: res.finalUrl,
          status: res.status,
          ok: res.status >= 200 && res.status < 300,
          reason: res.status >= 200 && res.status < 300 ? "ok" : "http_error",
          error: null,
        };
        break;
      }
      lastError = { status: res.status, message: `HTTP ${res.status}` };
    } catch (err) {
      lastError = { status: null, message: err?.message ?? String(err), name: err?.name };
    }
  }

  if (!result) {
    // HTTP 에러로 끝난 경우 (DNS는 살아있음)
    if (lastError?.status) {
      result = {
        url,
        finalUrl: url,
        status: lastError.status,
        ok: false,
        reason: "http_error",
        error: lastError.message,
      };
    } else {
      // 네트워크/타임아웃 — DNS 검증으로 "서버 봇차단" vs "실제 불능" 구분
      let dnsOk = false;
      try {
        const host = new URL(url).hostname;
        const records = await dns.lookup(host, { all: true });
        dnsOk = records.length > 0;
      } catch {
        dnsOk = false;
      }

      let reason = "unknown";
      const msg = lastError?.message ?? "";
      if (lastError?.name === "AbortError") reason = dnsOk ? "bot_blocked" : "timeout";
      else if (msg.includes("ENOTFOUND") || msg.includes("getaddrinfo")) reason = "dns";
      else if (!dnsOk) reason = "dns";
      else if (msg.includes("fetch failed") || msg.includes("ECONN") || msg.includes("EHOSTUNREACH")) {
        // DNS는 살아있으나 connect 실패 = 봇 차단 혹은 TLS 정책
        reason = "bot_blocked";
      } else {
        reason = dnsOk ? "bot_blocked" : "network";
      }

      result = {
        url,
        finalUrl: url,
        status: null,
        // bot_blocked는 tier 1/2에 한해 verify에서 "조건부 OK"로 처리 (registry 기반)
        ok: reason === "bot_blocked",
        reason,
        error: msg,
        dnsResolved: dnsOk,
      };
    }
  }

  writeCache(url, result);
  return result;
}

// ─────────────────────────────────────────────────────────────
// 배치 검증 (concurrency + per-host throttle)
// ─────────────────────────────────────────────────────────────

/**
 * @param {string[]} urls
 * @param {{concurrency?:number, perHost?:number, timeoutMs?:number, onProgress?:function}} [opts]
 * @returns {Promise<CheckResult[]>}
 */
export async function checkUrlsBatch(urls, opts = {}) {
  const concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY;
  const perHost = opts.perHost ?? PER_HOST_LIMIT;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const unique = [...new Set(urls)];
  const results = new Map();
  const hostCounts = new Map();
  let activeCount = 0;
  let queueIdx = 0;
  let completed = 0;

  const getHost = (url) => {
    try {
      return new URL(url).hostname;
    } catch {
      return "_invalid";
    }
  };

  return new Promise((resolve) => {
    const tryNext = () => {
      while (activeCount < concurrency && queueIdx < unique.length) {
        // 큐에서 per-host 제약 만족하는 다음 항목 찾기
        let picked = -1;
        for (let i = queueIdx; i < unique.length; i += 1) {
          if (results.has(unique[i])) continue;
          const host = getHost(unique[i]);
          if ((hostCounts.get(host) ?? 0) < perHost) {
            picked = i;
            break;
          }
        }
        if (picked === -1) break;

        const url = unique[picked];
        // queueIdx 진행 (이미 처리 예약된 항목 스킵)
        if (picked === queueIdx) queueIdx += 1;

        const host = getHost(url);
        hostCounts.set(host, (hostCounts.get(host) ?? 0) + 1);
        activeCount += 1;
        results.set(url, "pending");

        checkUrl(url, { timeoutMs })
          .then((res) => {
            results.set(url, res);
          })
          .catch((err) => {
            results.set(url, {
              url,
              finalUrl: url,
              status: null,
              ok: false,
              reason: "unknown",
              error: err?.message ?? String(err),
            });
          })
          .finally(() => {
            activeCount -= 1;
            hostCounts.set(host, (hostCounts.get(host) ?? 1) - 1);
            completed += 1;
            if (opts.onProgress) opts.onProgress(completed, unique.length);

            if (completed === unique.length) {
              saveCache();
              resolve(unique.map((u) => results.get(u)));
            } else {
              tryNext();
            }
          });
      }
    };
    tryNext();
  });
}

// ─────────────────────────────────────────────────────────────
// 마크다운 출처 섹션 추출
// ─────────────────────────────────────────────────────────────

/**
 * 마크다운 본문에서 `## 출처` 섹션 블록과 그 안의 링크 추출
 * @param {string} markdown
 * @returns {{section:string|null, sectionStart:number, sectionEnd:number, links:Array<{raw:string, anchor:string, url:string, lineIndex:number}>}}
 */
export function extractSourceSection(markdown) {
  const lines = markdown.split("\n");
  let start = -1;
  let end = lines.length;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^##\s*출처\s*$/.test(line.trim()) || /^##\s*참고\s*(자료|링크|문헌)?\s*$/.test(line.trim())) {
      start = i;
      continue;
    }
    if (start !== -1 && /^##\s+/.test(line.trim()) && i !== start) {
      end = i;
      break;
    }
  }
  if (start === -1) {
    return { section: null, sectionStart: -1, sectionEnd: -1, links: [] };
  }
  const sectionLines = lines.slice(start, end);
  const links = [];
  const linkRe = /^-\s*\[([^\]]+)\]\((https?:\/\/[^)]+)\)\s*$/;
  for (let i = 1; i < sectionLines.length; i += 1) {
    const m = sectionLines[i].match(linkRe);
    if (m) {
      links.push({
        raw: sectionLines[i],
        anchor: m[1],
        url: m[2],
        lineIndex: start + i,
      });
    }
  }
  return {
    section: sectionLines.join("\n"),
    sectionStart: start,
    sectionEnd: end,
    links,
  };
}

/**
 * HTML 본문에서 `<h2>출처</h2>` 블록과 그 안의 `<a href>` 링크 추출
 * DB posts.content는 마크다운이 아닌 HTML로 저장되는 케이스 대응.
 * @param {string} html
 * @returns {{section:string|null, sectionStart:number, sectionEnd:number, links:Array<{raw:string, anchor:string, url:string, startIdx:number, endIdx:number}>}}
 */
export function extractSourceSectionHtml(html) {
  // H2 헤딩 시작 찾기 (출처 또는 참고)
  const headingRe = /<h2[^>]*>\s*(출처|참고\s*(?:자료|링크|문헌)?)\s*<\/h2>/i;
  const headingMatch = html.match(headingRe);
  if (!headingMatch) {
    return { section: null, sectionStart: -1, sectionEnd: -1, links: [] };
  }
  const sectionStart = headingMatch.index;

  // 다음 H2 또는 문서 끝
  const afterHeading = headingMatch.index + headingMatch[0].length;
  const nextH2Re = /<h2[^>]*>/i;
  const nextH2 = html.slice(afterHeading).match(nextH2Re);
  const sectionEnd = nextH2 ? afterHeading + nextH2.index : html.length;
  const sectionHtml = html.slice(sectionStart, sectionEnd);

  // 링크 추출
  const linkRe = /<a\s+[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const links = [];
  let m;
  while ((m = linkRe.exec(sectionHtml)) !== null) {
    const absStart = sectionStart + m.index;
    const absEnd = absStart + m[0].length;
    const anchor = m[2].replace(/<[^>]+>/g, "").trim();
    links.push({
      raw: m[0],
      anchor,
      url: m[1],
      startIdx: absStart,
      endIdx: absEnd,
    });
  }

  return {
    section: sectionHtml,
    sectionStart,
    sectionEnd,
    links,
  };
}

/**
 * 본문이 HTML인지 마크다운인지 감지
 */
export function detectContentFormat(content) {
  if (!content) return "empty";
  if (/<h\d|<p>|<ul>|<li>/i.test(content)) return "html";
  return "markdown";
}

