#!/usr/bin/env node
/**
 * 네이버 검색광고 API 키워드 리서치 CLI
 *
 * Usage:
 *   node scripts/keyword-research.mjs 법인설립비용 법인설립절차 1인법인설립
 *   node scripts/keyword-research.mjs --file content-input/keywords/candidates.txt
 *   node scripts/keyword-research.mjs --topic 키퍼메이트 CCTV렌탈 매장CCTV 한화비전키퍼
 *
 * Output:
 *   - 콘솔에 정렬된 키워드 분석표 출력
 *   - content-input/keywords/YYYY-MM-DD-[topic].json 저장
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// .env.local 파싱 (dotenv 없이)
function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) throw new Error(".env.local 파일이 없습니다");
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([^#=]+)=(.+)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

// HMAC-SHA256 헤더 생성
function buildHeaders(path_) {
  const { NAVER_API_KEY: key, NAVER_SA_SECRET: secret, NAVER_ACCOUNT_ID: id } = process.env;
  if (!key || !secret || !id) throw new Error("NAVER_API_KEY / NAVER_SA_SECRET / NAVER_ACCOUNT_ID 미설정");
  const ts = String(Date.now());
  const sig = crypto.createHmac("sha256", secret).update(`${ts}.GET.${path_}`).digest("base64");
  return { "X-Timestamp": ts, "X-API-KEY": key, "X-Customer": id, "X-Signature": sig };
}

function parseVolume(raw) {
  if (raw === "< 10" || raw == null) return 0;
  return Number(raw) || 0;
}

function parseComp(raw) {
  if (raw === "낮음" || raw === "LOW") return "low";
  if (raw === "중간" || raw === "MID") return "medium";
  if (raw === "높음" || raw === "HIGH") return "high";
  return null;
}

// 기회 점수: 검색량(0~60) + 경쟁도 역점수(0~40)
// 검색량 0이면 경쟁도 무관하게 0점 (노출 가능성 없음)
function oppScore(total, comp) {
  if (total === 0) return 0;
  const vol = Math.min(total / 50_000, 1) * 60;
  const c = comp === "low" ? 40 : comp === "medium" ? 20 : comp === "high" ? 5 : 10;
  return Math.round(vol + c);
}

async function fetchBatch(keywords) {
  const qs = new URLSearchParams({ hintKeywords: keywords.join(","), showDetail: "1" });
  const apiPath = "/keywordstool";
  const res = await fetch(`https://api.naver.com${apiPath}?${qs}`, {
    headers: buildHeaders(apiPath),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.keywordList ?? [];
}

let discoverMode = false;

async function analyzeKeywords(keywords) {
  const BATCH = 5;
  const resultMap = new Map();

  for (let i = 0; i < keywords.length; i += BATCH) {
    const batch = keywords.slice(i, i + BATCH);
    process.stderr.write(`  조회 중: ${batch.join(", ")}\n`);
    const items = await fetchBatch(batch);

    for (const item of items) {
      const kw = item.relKeyword;
      // discover 모드: API가 반환한 연관 키워드 전부 수집
      // 일반 모드: 입력한 키워드만
      if (!discoverMode && !batch.includes(kw)) continue;
      if (resultMap.has(kw)) continue;
      const pc = parseVolume(item.monthlyPcQcCnt);
      const mobile = parseVolume(item.monthlyMobileQcCnt);
      const total = pc + mobile;
      const comp = parseComp(item.compIdx);
      resultMap.set(kw, {
        keyword: kw,
        pc,
        mobile,
        total,
        comp,
        avgDepth: item.plAvgDepth != null ? Number(item.plAvgDepth) : null,
        score: oppScore(total, comp),
      });
    }

    // 입력 키워드 중 API 응답에 없는 것도 추가 (검색량 0)
    if (!discoverMode) {
      for (const kw of batch) {
        if (!resultMap.has(kw)) {
          resultMap.set(kw, { keyword: kw, pc: 0, mobile: 0, total: 0, comp: null, avgDepth: null, score: 0 });
        }
      }
    }

    if (i + BATCH < keywords.length) await new Promise(r => setTimeout(r, 400));
  }

  return [...resultMap.values()].sort((a, b) => b.score - a.score);
}

function printTable(rows) {
  const COMP_LABEL = { low: "낮음", medium: "중간", high: "높음", null: "  -  " };
  const header = ["키워드", "PC", "모바일", "합계", "경쟁도", "평균깊이", "기회점수"];
  const pad = (s, n) => String(s).padStart(n);
  const lpad = (s, n) => String(s).padEnd(n);

  console.log("\n" + "─".repeat(80));
  console.log(
    lpad(header[0], 24) + pad(header[1], 8) + pad(header[2], 9) +
    pad(header[3], 9) + pad(header[4], 8) + pad(header[5], 9) + pad(header[6], 9)
  );
  console.log("─".repeat(80));

  for (const r of rows) {
    const star = r.score >= 60 ? " ★" : r.score >= 40 ? " ◎" : "";
    console.log(
      lpad(r.keyword, 24) +
      pad(r.pc.toLocaleString(), 8) +
      pad(r.mobile.toLocaleString(), 9) +
      pad(r.total.toLocaleString(), 9) +
      pad(COMP_LABEL[r.comp] ?? "-", 8) +
      pad(r.avgDepth ?? "-", 9) +
      pad(r.score, 9) + star
    );
  }

  console.log("─".repeat(80));
  const top = rows[0];
  console.log(`\n★ 추천 메인 키워드: ${top.keyword} (합계 ${top.total.toLocaleString()}, 기회점수 ${top.score})`);

  const subs = rows.slice(1, 5).filter(r => r.total > 0);
  if (subs.length) {
    console.log(`◎ 서브 키워드 후보: ${subs.map(r => `${r.keyword}(${r.total.toLocaleString()})`).join(", ")}`);
  }
  console.log();
}

function saveResults(rows, topic) {
  const date = new Date().toISOString().slice(0, 10);
  const slug = (topic || rows[0]?.keyword || "result").replace(/\s+/g, "-");
  const outPath = path.join(ROOT, "content-input", "keywords", `${date}-${slug}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ date, topic, keywords: rows }, null, 2), "utf-8");
  console.log(`결과 저장: ${outPath}\n`);
}

// ─── main ───────────────────────────────────────────────────────────────────

loadEnv();

const args = process.argv.slice(2);
if (!args.length) {
  console.error("Usage: node scripts/keyword-research.mjs [--topic 주제명] [--discover] keyword1 keyword2 ...");
  console.error("       node scripts/keyword-research.mjs --file content-input/keywords/candidates.txt");
  console.error("  --discover: 입력 키워드 외 네이버 연관 키워드도 모두 수집");
  process.exit(1);
}

let topic = "";
let keywords = [];

let rest = [...args];

// 플래그 파싱
if (rest.includes("--discover")) {
  discoverMode = true;
  rest = rest.filter(a => a !== "--discover");
}

if (rest[0] === "--file") {
  const filePath = path.resolve(ROOT, rest[1]);
  keywords = fs.readFileSync(filePath, "utf-8")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);
} else {
  if (rest[0] === "--topic") {
    topic = rest[1];
    rest = rest.slice(2);
  }
  keywords = rest;
}

if (!keywords.length) {
  console.error("키워드를 하나 이상 입력하세요.");
  process.exit(1);
}

console.log(`\n네이버 키워드 분석 — ${topic || "미지정"} (${keywords.length}개)`);
const rows = await analyzeKeywords(keywords);
printTable(rows);
saveResults(rows, topic || keywords[0]);
