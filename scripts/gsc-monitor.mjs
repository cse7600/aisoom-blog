#!/usr/bin/env node
/**
 * GSC 모니터링 CLI — Claude가 언제든 실행 가능
 * Usage:
 *   node scripts/gsc-monitor.mjs           # 최근 7일 요약
 *   node scripts/gsc-monitor.mjs 28        # 최근 28일
 *   node scripts/gsc-monitor.mjs --queries # 상위 키워드
 *   node scripts/gsc-monitor.mjs --pages   # 상위 페이지
 *   node scripts/gsc-monitor.mjs --history # Supabase 저장 히스토리
 */

import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

const SITE_URL = "https://factnote.co.kr/";
const args = process.argv.slice(2);
const showQueries = args.includes("--queries");
const showPages = args.includes("--pages");
const showHistory = args.includes("--history");
const days = parseInt(args.find((a) => /^\d+$/.test(a)) ?? "7", 10);

function getAuth() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  client.setCredentials({ refresh_token: process.env.GOOGLE_GSC_REFRESH_TOKEN });
  return client;
}

function dateRange(daysBack, offsetFromToday = 3) {
  const end = new Date();
  end.setDate(end.getDate() - offsetFromToday);
  const start = new Date(end);
  start.setDate(end.getDate() - daysBack + 1);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

async function query(requestBody) {
  const auth = getAuth();
  const sc = google.searchconsole({ version: "v1", auth });
  const { data } = await sc.searchanalytics.query({ siteUrl: SITE_URL, requestBody });
  return data.rows ?? [];
}

function fmt(n, decimals = 0) {
  return Number(n).toLocaleString("ko-KR", { maximumFractionDigits: decimals });
}

async function showSummary() {
  const { startDate, endDate } = dateRange(days);
  console.log(`\n📊 GSC 요약 (${startDate} ~ ${endDate})\n${"─".repeat(50)}`);

  const [totals, byDate] = await Promise.all([
    query({ startDate, endDate, dimensions: ["query"], rowLimit: 1 }),
    query({ startDate, endDate, dimensions: ["date"], rowLimit: 90 }),
  ]);

  const sumRows = await query({ startDate, endDate, dimensions: ["date"], rowLimit: 90 });
  const totalClicks = sumRows.reduce((s, r) => s + (r.clicks ?? 0), 0);
  const totalImpressions = sumRows.reduce((s, r) => s + (r.impressions ?? 0), 0);
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) : "0.00";
  const avgPos = sumRows.length > 0
    ? (sumRows.reduce((s, r) => s + (r.position ?? 0), 0) / sumRows.length).toFixed(1)
    : "N/A";

  console.log(`클릭수:     ${fmt(totalClicks)}`);
  console.log(`노출수:     ${fmt(totalImpressions)}`);
  console.log(`평균 CTR:   ${avgCtr}%`);
  console.log(`평균 순위:  ${avgPos}위`);

  // 최근 7일 일별 추이
  if (sumRows.length > 0) {
    console.log(`\n일별 클릭 추이 (최근 ${Math.min(7, sumRows.length)}일):`);
    sumRows.slice(-7).forEach((r) => {
      const bar = "█".repeat(Math.min(20, Math.round((r.clicks ?? 0) / Math.max(...sumRows.map(x => x.clicks ?? 1)) * 20)));
      console.log(`  ${r.keys[0]}  ${String(r.clicks ?? 0).padStart(5)} ${bar}`);
    });
  }
}

async function showTopQueries() {
  const { startDate, endDate } = dateRange(days);
  console.log(`\n🔍 상위 키워드 Top 20 (${startDate} ~ ${endDate})\n${"─".repeat(60)}`);
  const rows = await query({ startDate, endDate, dimensions: ["query"], rowLimit: 20 });
  if (rows.length === 0) { console.log("  데이터 없음"); return; }
  console.log(`${"키워드".padEnd(30)} ${"클릭".padStart(6)} ${"노출".padStart(8)} ${"CTR".padStart(7)} ${"순위".padStart(6)}`);
  console.log("─".repeat(60));
  rows.forEach((r) => {
    const q = (r.keys[0] ?? "").slice(0, 28).padEnd(30);
    const clicks = fmt(r.clicks ?? 0).padStart(6);
    const imp = fmt(r.impressions ?? 0).padStart(8);
    const ctr = ((r.ctr ?? 0) * 100).toFixed(1).padStart(6) + "%";
    const pos = (r.position ?? 0).toFixed(1).padStart(6);
    console.log(`${q} ${clicks} ${imp} ${ctr} ${pos}`);
  });
}

async function showTopPages() {
  const { startDate, endDate } = dateRange(days);
  console.log(`\n📄 상위 페이지 Top 20 (${startDate} ~ ${endDate})\n${"─".repeat(70)}`);
  const rows = await query({ startDate, endDate, dimensions: ["page"], rowLimit: 20 });
  if (rows.length === 0) { console.log("  데이터 없음"); return; }
  console.log(`${"페이지".padEnd(40)} ${"클릭".padStart(6)} ${"노출".padStart(8)} ${"순위".padStart(6)}`);
  console.log("─".repeat(62));
  rows.forEach((r) => {
    const page = (r.keys[0] ?? "").replace(SITE_URL, "").slice(0, 38).padEnd(40);
    const clicks = fmt(r.clicks ?? 0).padStart(6);
    const imp = fmt(r.impressions ?? 0).padStart(8);
    const pos = (r.position ?? 0).toFixed(1).padStart(6);
    console.log(`${page} ${clicks} ${imp} ${pos}`);
  });
}

async function showHistoryFromDb() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data, error } = await db
    .from("gsc_daily_summary")
    .select("date,total_clicks,total_impressions,avg_ctr,avg_position")
    .order("date", { ascending: false })
    .limit(30);

  if (error) { console.log("  DB 오류:", error.message); return; }
  if (!data?.length) { console.log("  저장된 히스토리 없음 (gsc-sync 크론 실행 필요)"); return; }

  console.log(`\n📅 GSC 히스토리 (최근 ${data.length}일)\n${"─".repeat(55)}`);
  console.log(`${"날짜".padEnd(12)} ${"클릭".padStart(6)} ${"노출".padStart(8)} ${"CTR".padStart(7)} ${"순위".padStart(6)}`);
  console.log("─".repeat(42));
  data.forEach((r) => {
    const ctr = ((r.avg_ctr ?? 0) * 100).toFixed(2).padStart(6) + "%";
    console.log(`${r.date}  ${fmt(r.total_clicks).padStart(6)} ${fmt(r.total_impressions).padStart(8)} ${ctr} ${(r.avg_position ?? 0).toFixed(1).padStart(6)}`);
  });
}

async function main() {
  if (!process.env.GOOGLE_GSC_REFRESH_TOKEN) {
    console.error("❌ GOOGLE_GSC_REFRESH_TOKEN 미설정");
    console.error("   Setup 방법: node scripts/gsc-setup.mjs");
    process.exit(1);
  }

  try {
    if (showHistory) {
      await showHistoryFromDb();
    } else if (showQueries) {
      await showTopQueries();
    } else if (showPages) {
      await showTopPages();
    } else {
      await showSummary();
      await showTopQueries();
    }
  } catch (err) {
    console.error("❌ GSC API 오류:", err.message);
    if (err.message?.includes("invalid_grant")) {
      console.error("   refresh token 만료. node scripts/gsc-setup.mjs 재실행 필요");
    }
  }
}

main();
