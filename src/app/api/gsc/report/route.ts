/**
 * GSC 리포트 API
 * GET /api/gsc/report?days=7&type=summary|queries|pages
 */
import { NextRequest, NextResponse } from "next/server";
import { fetchRecentSummary, fetchTopQueries, fetchTopPages } from "@/lib/gsc";

export const dynamic = "force-dynamic";

function authorize(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  const querySecret = request.nextUrl.searchParams.get("secret");
  return token === secret || querySecret === secret;
}

export async function GET(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const type = request.nextUrl.searchParams.get("type") ?? "summary";
  const days = parseInt(request.nextUrl.searchParams.get("days") ?? "7", 10);

  try {
    if (type === "summary") {
      const data = await fetchRecentSummary(days);
      return NextResponse.json(data);
    }

    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days - 3);
    end.setDate(end.getDate() - 3);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    if (type === "queries") {
      const data = await fetchTopQueries(fmt(start), fmt(end), 50);
      return NextResponse.json(data);
    }
    if (type === "pages") {
      const data = await fetchTopPages(fmt(start), fmt(end), 50);
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "unknown type" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
