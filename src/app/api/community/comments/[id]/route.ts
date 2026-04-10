import { NextRequest, NextResponse } from "next/server";
import {
  deleteCommunityComment,
  getCommunityCommentHash,
} from "@/lib/community-db";
import {
  validatePasswordOnly,
  ValidationError,
} from "@/lib/community-validation";
import { verifyPassword } from "@/lib/community-auth";

interface RouteContext {
  params: { id: string };
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const commentId = params.id;
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

  const row = await getCommunityCommentHash(commentId);
  if (!row) {
    return NextResponse.json(
      { error: "댓글을 찾을 수 없습니다" },
      { status: 404 }
    );
  }

  if (!verifyPassword(password, row.password_hash)) {
    return NextResponse.json(
      { error: "비밀번호가 일치하지 않습니다" },
      { status: 403 }
    );
  }

  const deleted = await deleteCommunityComment(commentId);
  if (!deleted) {
    return NextResponse.json(
      { error: "댓글 삭제에 실패했습니다" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
