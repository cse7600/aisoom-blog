/**
 * Phase 9.1 plan-daily cron
 * 매일 00:10 KST (UTC 15:10) 실행
 * → 오늘 발행 예정 각본을 cue 로 전개
 */

import { NextRequest, NextResponse } from "next/server";
import { planDailyCues } from "@/lib/script-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authFail = authorize(request);
  if (authFail) return authFail;
  return runPlan();
}

export async function POST(request: NextRequest) {
  const authFail = authorize(request);
  if (authFail) return authFail;
  return runPlan();
}

function authorize(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron:plan-daily] CRON_SECRET 미설정");
    return NextResponse.json(
      { error: "server-not-configured" },
      { status: 500 }
    );
  }
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (token !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

async function runPlan(): Promise<NextResponse> {
  if (process.env.SCRIPT_DISPATCH_ENABLED === "false") {
    return NextResponse.json({ ok: true, disabled: true });
  }
  const started = Date.now();
  const result = await planDailyCues({
    nowUtc: new Date(),
    dryRun: false,
  });
  return NextResponse.json({
    ok: true,
    planned: result.planned,
    skipped: result.skipped,
    durationMs: Date.now() - started,
  });
}
