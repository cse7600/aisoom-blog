import { NextRequest, NextResponse } from "next/server";
import { incrementCommunityPostLike } from "@/lib/community-db";

interface RouteContext {
  params: { id: string };
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
  await incrementCommunityPostLike(params.id);
  return NextResponse.json({ ok: true });
}
