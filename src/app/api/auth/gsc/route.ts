/**
 * GSC OAuth2 인증 시작 (최초 1회 실행)
 * GET /api/auth/gsc → 구글 인증 페이지로 리다이렉트
 */
import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/gsc";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = getAuthUrl();
  return NextResponse.redirect(url);
}
