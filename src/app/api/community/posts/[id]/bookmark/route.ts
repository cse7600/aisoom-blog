import { NextRequest, NextResponse } from "next/server";
import { incrementCommunityPostBookmark } from "@/lib/community-db";

interface RouteContext {
  params: { id: string };
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
  await incrementCommunityPostBookmark(params.id);
  return NextResponse.json({ ok: true });
}
