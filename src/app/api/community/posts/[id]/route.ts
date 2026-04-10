import { NextRequest, NextResponse } from "next/server";
import {
  getCommunityPostDetail,
  getCommunityPostHash,
  incrementCommunityPostView,
  updateCommunityPost,
  deleteCommunityPost,
} from "@/lib/community-db";
import {
  validatePostInput,
  validatePasswordOnly,
  ValidationError,
} from "@/lib/community-validation";
import { verifyPassword } from "@/lib/community-auth";

interface RouteContext {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const postId = params.id;
  const detail = await getCommunityPostDetail(postId);
  if (!detail) {
    return NextResponse.json(
      { error: "게시글을 찾을 수 없습니다" },
      { status: 404 }
    );
  }

  const skipView = request.nextUrl.searchParams.get("skipView") === "1";
  if (!skipView) {
    await incrementCommunityPostView(postId);
  }
  return NextResponse.json({ ok: true, ...detail });
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const postId = params.id;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "요청 본문을 해석할 수 없습니다" },
      { status: 400 }
    );
  }

  const record = body as Record<string, unknown>;
  const password = typeof record.password === "string" ? record.password : "";
  if (!password) {
    return NextResponse.json(
      { error: "비밀번호가 필요합니다" },
      { status: 400 }
    );
  }

  const authorized = await verifyPostPassword(postId, password);
  if (!authorized) {
    return NextResponse.json(
      { error: "비밀번호가 일치하지 않습니다" },
      { status: 403 }
    );
  }

  let parsed;
  try {
    parsed = validatePostInput(body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "입력값이 올바르지 않습니다" },
      { status: 400 }
    );
  }

  const updated = await updateCommunityPost(postId, {
    title: parsed.title,
    content: parsed.content,
    category: parsed.category,
    image_url: parsed.image_url,
  });
  if (!updated) {
    return NextResponse.json(
      { error: "게시글 수정에 실패했습니다" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const postId = params.id;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "요청 본문을 해석할 수 없습니다" },
      { status: 400 }
    );
  }

  let password: string;
  try {
    password = validatePasswordOnly(body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "비밀번호가 필요합니다" },
      { status: 400 }
    );
  }

  const authorized = await verifyPostPassword(postId, password);
  if (!authorized) {
    return NextResponse.json(
      { error: "비밀번호가 일치하지 않습니다" },
      { status: 403 }
    );
  }

  const deleted = await deleteCommunityPost(postId);
  if (!deleted) {
    return NextResponse.json(
      { error: "게시글 삭제에 실패했습니다" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}

async function verifyPostPassword(
  postId: string,
  password: string
): Promise<boolean> {
  const row = await getCommunityPostHash(postId);
  if (!row) return false;
  return verifyPassword(password, row.password_hash);
}
