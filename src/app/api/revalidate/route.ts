import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

/**
 * On-demand ISR revalidation endpoint.
 * Usage: POST /api/revalidate?token=SECRET&path=/tech/some-slug
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const secret = process.env.REVALIDATE_SECRET;

  if (!secret || token !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const path = req.nextUrl.searchParams.get("path");
  if (!path) {
    return NextResponse.json({ error: "path required" }, { status: 400 });
  }

  revalidatePath(path);
  return NextResponse.json({ revalidated: true, path });
}
