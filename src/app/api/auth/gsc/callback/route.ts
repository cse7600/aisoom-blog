/**
 * GSC OAuth2 콜백 — 인증 코드로 refresh token 교환
 * 최초 1회 실행 후 토큰을 env에 저장
 */
import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/gsc";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "no code" }, { status: 400 });
  }
  try {
    const tokens = await exchangeCode(code);
    return NextResponse.json({
      message: "성공. 아래 refresh_token을 GOOGLE_GSC_REFRESH_TOKEN 환경변수에 저장하세요.",
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
