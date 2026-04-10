import { NextRequest, NextResponse } from "next/server";
import {
  getCommunityPostById,
  insertCommunityComment,
  listCommunityComments,
} from "@/lib/community-db";
import {
  validateCommentInput,
  ValidationError,
} from "@/lib/community-validation";
import {
  hashPassword,
  hashIp,
  extractClientIp,
} from "@/lib/community-auth";

interface RouteContext {
  params: { id: string };
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const comments = await listCommunityComments(params.id);
  return NextResponse.json({ ok: true, comments });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const postId = params.id;
  const post = await getCommunityPostById(postId);
  if (!post) {
    return NextResponse.json(
      { error: "게시글을 찾을 수 없습니다" },
      { status: 404 }
    );
  }

  let parsed;
  try {
    const body = await request.json();
    parsed = validateCommentInput(body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "요청 본문을 해석할 수 없습니다" },
      { status: 400 }
    );
  }

  const password_hash = hashPassword(parsed.password);
  const ip_hash = hashIp(extractClientIp(request.headers));

  const created = await insertCommunityComment({
    post_id: postId,
    parent_id: parsed.parent_id,
    nickname: parsed.nickname,
    password_hash,
    content: parsed.content,
    ip_hash,
  });

  if (!created) {
    return NextResponse.json(
      { error: "댓글 저장에 실패했습니다" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      comment: {
        id: created.id,
        post_id: created.post_id,
        parent_id: created.parent_id,
        nickname: created.nickname,
        content: created.content,
        created_at: created.created_at,
      },
    },
    { status: 201 }
  );
}
