/**
 * GSC 일별 데이터 Supabase 동기화 크론
 * 매일 새벽 2시 실행 (vercel.json 참고)
 */
import { NextRequest, NextResponse } from "next/server";
import { fetchRecentSummary, fetchTopQueries, fetchTopPages } from "@/lib/gsc";
import { createServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorize(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  return token === secret;
}

export async function GET(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return sync();
}

export async function POST(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return sync();
}

async function sync(): Promise<NextResponse> {
  if (!process.env.GOOGLE_GSC_REFRESH_TOKEN) {
    return NextResponse.json({ error: "GOOGLE_GSC_REFRESH_TOKEN 미설정" }, { status: 500 });
  }

  const db = createServiceClient();
  const end = new Date();
  end.setDate(end.getDate() - 3); // GSC 3일 지연
  const endDate = end.toISOString().slice(0, 10);

  const [summary, queries, pages] = await Promise.all([
    fetchRecentSummary(1),
    fetchTopQueries(endDate, endDate, 50),
    fetchTopPages(endDate, endDate, 20),
  ]);

  const { error } = await db.from("gsc_daily_summary").upsert(
    {
      date: endDate,
      total_clicks: summary.totalClicks,
      total_impressions: summary.totalImpressions,
      avg_ctr: summary.avgCtr,
      avg_position: summary.avgPosition,
      top_queries: queries,
      top_pages: pages,
    },
    { onConflict: "date" }
  );

  if (error) {
    console.error("[cron:gsc-sync]", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    date: endDate,
    clicks: summary.totalClicks,
    impressions: summary.totalImpressions,
  });
}
