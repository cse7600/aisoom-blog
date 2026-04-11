/**
 * Phase 9.1 dispatch-scripts cron
 * 매 15분 실행 → 발사 가능한 cue 를 최대 20개 집행
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchDueCues, fireCue } from "@/lib/script-queue";
import { SCRIPT_LIMITS } from "@/lib/script-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authFail = authorize(request);
  if (authFail) return authFail;
  return runDispatch();
}

export async function POST(request: NextRequest) {
  const authFail = authorize(request);
  if (authFail) return authFail;
  return runDispatch();
}

function authorize(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron:dispatch-scripts] CRON_SECRET 미설정");
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

async function runDispatch(): Promise<NextResponse> {
  if (process.env.SCRIPT_DISPATCH_ENABLED === "false") {
    return NextResponse.json({ ok: true, disabled: true });
  }
  const started = Date.now();
  const cues = await fetchDueCues(SCRIPT_LIMITS.MAX_FIRE_PER_RUN);
  if (cues.length === 0) {
    return NextResponse.json({
      ok: true,
      fired: 0,
      message: "no-due-cues",
      durationMs: Date.now() - started,
    });
  }
  const results = [];
  for (const cue of cues) {
    results.push(await fireCue(cue));
  }
  const succeeded = results.filter((result) => result.success).length;
  return NextResponse.json({
    ok: true,
    fired: succeeded,
    failed: results.length - succeeded,
    total: results.length,
    results,
    durationMs: Date.now() - started,
  });
}
