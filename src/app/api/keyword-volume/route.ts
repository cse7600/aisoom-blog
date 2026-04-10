import { NextRequest, NextResponse } from "next/server";
import { fetchKeywordVolumes } from "@/lib/keyword-volume";

/**
 * POST /api/keyword-volume
 * Body: { keywords: string[] }
 * 네이버 검색광고 API로 검색량 조회 (블로그 내부용)
 */
export async function POST(request: NextRequest) {
  let body: { keywords?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.keywords) || body.keywords.length === 0) {
    return NextResponse.json({ error: "keywords (string[]) 필수" }, { status: 400 });
  }

  const keywords = (body.keywords as unknown[])
    .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
    .map((k) => k.trim())
    .slice(0, 100);

  try {
    const volumes = await fetchKeywordVolumes(keywords);
    return NextResponse.json({ ok: true, count: volumes.length, volumes });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
