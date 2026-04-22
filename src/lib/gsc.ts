/**
 * Google Search Console API 클라이언트
 * OAuth2 refresh token으로 서버사이드 무인증 접근
 */

import { google } from "googleapis";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aisoom.co.kr/";

function getOAuth2Client() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI ?? `${SITE_URL}api/auth/gsc/callback`
  );
  const refreshToken = process.env.GOOGLE_GSC_REFRESH_TOKEN;
  if (refreshToken) {
    client.setCredentials({ refresh_token: refreshToken });
  }
  return client;
}

export interface GscSearchRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscPageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscDailySummary {
  date: string;
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
  topQueries: GscSearchRow[];
  topPages: GscPageRow[];
}

/** 기간별 검색 쿼리 성과 */
export async function fetchTopQueries(
  startDate: string,
  endDate: string,
  limit = 20
): Promise<GscSearchRow[]> {
  const auth = getOAuth2Client();
  const sc = google.searchconsole({ version: "v1", auth });
  const { data } = await sc.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["query"],
      rowLimit: limit,
      dataState: "all",
    },
  });
  return (data.rows ?? []).map((row) => ({
    query: row.keys?.[0] ?? "",
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));
}

/** 기간별 페이지별 성과 */
export async function fetchTopPages(
  startDate: string,
  endDate: string,
  limit = 20
): Promise<GscPageRow[]> {
  const auth = getOAuth2Client();
  const sc = google.searchconsole({ version: "v1", auth });
  const { data } = await sc.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["page"],
      rowLimit: limit,
      dataState: "all",
    },
  });
  return (data.rows ?? []).map((row) => ({
    page: row.keys?.[0] ?? "",
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));
}

/** 일별 전체 클릭/노출 집계 */
export async function fetchDailyTotals(
  startDate: string,
  endDate: string
): Promise<Array<{ date: string; clicks: number; impressions: number; ctr: number; position: number }>> {
  const auth = getOAuth2Client();
  const sc = google.searchconsole({ version: "v1", auth });
  const { data } = await sc.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["date"],
      rowLimit: 90,
      dataState: "all",
    },
  });
  return (data.rows ?? []).map((row) => ({
    date: row.keys?.[0] ?? "",
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));
}

/** 최근 N일 요약 (모니터링용) */
export async function fetchRecentSummary(days = 7): Promise<GscDailySummary> {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days - 3); // GSC 데이터 3일 지연 반영
  end.setDate(end.getDate() - 3);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const startDate = fmt(start);
  const endDate = fmt(end);

  const [queries, pages, totals] = await Promise.all([
    fetchTopQueries(startDate, endDate, 10),
    fetchTopPages(startDate, endDate, 10),
    fetchDailyTotals(startDate, endDate),
  ]);

  const totalClicks = totals.reduce((s, r) => s + r.clicks, 0);
  const totalImpressions = totals.reduce((s, r) => s + r.impressions, 0);
  const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
  const avgPosition =
    totals.length > 0
      ? totals.reduce((s, r) => s + r.position, 0) / totals.length
      : 0;

  return {
    date: endDate,
    totalClicks,
    totalImpressions,
    avgCtr,
    avgPosition,
    topQueries: queries,
    topPages: pages,
  };
}

/** OAuth2 인증 URL 생성 (최초 1회 셋업용) */
export function getAuthUrl(): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
}

/** 인증 코드로 토큰 교환 (최초 1회) */
export async function exchangeCode(code: string) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}
