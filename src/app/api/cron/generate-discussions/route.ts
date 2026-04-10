import { NextRequest, NextResponse } from "next/server";
import { getPostsNeedingDiscussions } from "@/lib/discussion-db";
import { generateDiscussionsForPost } from "@/lib/discussion-generator";
import { getPostBySlug } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_POSTS_PER_RUN = 3;

export async function GET(request: NextRequest) {
  const authFail = authorize(request);
  if (authFail) return authFail;
  return runCron();
}

export async function POST(request: NextRequest) {
  const authFail = authorize(request);
  if (authFail) return authFail;
  return runCron();
}

function authorize(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron:generate-discussions] CRON_SECRET 미설정");
    return NextResponse.json({ error: "server-not-configured" }, { status: 500 });
  }
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (token !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

async function runCron(): Promise<NextResponse> {
  const started = Date.now();
  const candidates = await getPostsNeedingDiscussions(MAX_POSTS_PER_RUN);
  if (candidates.length === 0) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      message: "no-candidates",
      durationMs: Date.now() - started,
    });
  }

  const results = await Promise.all(candidates.map(processCandidate));
  return NextResponse.json({
    ok: true,
    processed: results.length,
    results,
    durationMs: Date.now() - started,
  });
}

async function processCandidate(candidate: { slug: string }) {
  const post = await getPostBySlug(candidate.slug);
  if (!post) return { slug: candidate.slug, skipped: true };
  const outcome = await generateDiscussionsForPost({ post });
  return {
    slug: candidate.slug,
    comments: outcome.commentsCreated,
    replies: outcome.repliesCreated,
    errorCount: outcome.errors.length,
  };
}
