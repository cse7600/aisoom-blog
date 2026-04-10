import { NextRequest, NextResponse } from "next/server";
import {
  listCommunityPosts,
  insertCommunityPost,
} from "@/lib/community-db";
import {
  validatePostInput,
  ValidationError,
} from "@/lib/community-validation";
import {
  hashPassword,
  hashIp,
  extractClientIp,
} from "@/lib/community-auth";
import type {
  CommunityCategorySlug,
  CommunitySortKey,
} from "@/lib/community-types";
import { WRITABLE_CATEGORIES } from "@/lib/community-types";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const categoryParam = searchParams.get("category") ?? "all";
  const sortParam = (searchParams.get("sort") ?? "recent") as CommunitySortKey;
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "30");
  const search = searchParams.get("q") ?? undefined;

  const category = normalizeCategoryForList(categoryParam);
  const result = await listCommunityPosts({
    category,
    sort: sortParam,
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 30,
    search,
  });
  return NextResponse.json({ ok: true, ...result });
}

function normalizeCategoryForList(
  raw: string
): CommunityCategorySlug | undefined {
  if (raw === "all") return "all";
  const found = WRITABLE_CATEGORIES.find((slug) => slug === raw);
  return found;
}

export async function POST(request: NextRequest) {
  let parsed;
  try {
    const body = await request.json();
    parsed = validatePostInput(body);
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

  const created = await insertCommunityPost({
    category: parsed.category,
    title: parsed.title,
    content: parsed.content,
    nickname: parsed.nickname,
    password_hash,
    ip_hash,
    image_url: parsed.image_url,
  });

  if (!created) {
    return NextResponse.json(
      { error: "게시글 저장에 실패했습니다" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      post: {
        id: created.id,
        category: created.category,
        title: created.title,
        nickname: created.nickname,
        created_at: created.created_at,
      },
    },
    { status: 201 }
  );
}
