/**
 * 예약 발행 자동 전환 Cron
 * status='scheduled' AND published_at <= now() 포스트를 published로 전환
 * 매일 01:00 UTC (KST 10:00) 실행
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorize(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "server-not-configured" },
      { status: 500 },
    );
  }
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (token !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

interface ScheduledPost {
  id: string;
  slug: string;
  title: string;
}

async function publishScheduledPosts(): Promise<NextResponse> {
  const started = Date.now();
  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();

  /* 1. 발행 대상 조회 */
  const { data: candidates, error: fetchError } = await supabase
    .from("posts")
    .select("id, slug, title")
    .eq("status", "scheduled")
    .lte("published_at", nowIso);

  if (fetchError) {
    return NextResponse.json(
      { ok: false, error: fetchError.message },
      { status: 500 },
    );
  }

  const posts = (candidates ?? []) as ScheduledPost[];

  if (posts.length === 0) {
    return NextResponse.json({
      ok: true,
      published: 0,
      message: "no-scheduled-posts",
      durationMs: Date.now() - started,
    });
  }

  /* 2. status → published 일괄 전환 */
  const postIds = posts.map((p) => p.id);
  const { error: updateError } = await supabase
    .from("posts")
    .update({ status: "published", updated_at: nowIso })
    .in("id", postIds);

  if (updateError) {
    return NextResponse.json(
      { ok: false, error: updateError.message, attempted: postIds.length },
      { status: 500 },
    );
  }

  const slugs = posts.map((p) => p.slug);

  return NextResponse.json({
    ok: true,
    published: posts.length,
    slugs,
    durationMs: Date.now() - started,
  });
}

export async function GET(request: NextRequest) {
  const authFail = authorize(request);
  if (authFail) return authFail;
  return publishScheduledPosts();
}

export async function POST(request: NextRequest) {
  const authFail = authorize(request);
  if (authFail) return authFail;
  return publishScheduledPosts();
}
