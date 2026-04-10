import type { Metadata } from "next";
import Link from "next/link";
import { listCommunityPosts } from "@/lib/community-db";
import {
  WRITABLE_CATEGORIES,
  type CommunityCategorySlug,
  type CommunitySortKey,
} from "@/lib/community-types";
import { CommunityCategories } from "@/components/community/CommunityCategories";
import { CommunityPostList } from "@/components/community/CommunityPostList";

export const metadata: Metadata = {
  title: "소통 | 꿀정보",
  description:
    "누구나 자유롭게 이야기 나누는 공간. 자유토크부터 질문/답변, 후기까지.",
  openGraph: {
    title: "소통 | 꿀정보",
    description: "누구나 자유롭게 이야기 나누는 공간.",
  },
};

interface CommunityPageProps {
  searchParams: {
    cat?: string;
    sort?: string;
    page?: string;
    q?: string;
  };
}

export default async function CommunityPage({
  searchParams,
}: CommunityPageProps) {
  const category = normalizeCategory(searchParams.cat);
  const sort = normalizeSort(searchParams.sort);
  const page = normalizePage(searchParams.page);
  const search = searchParams.q?.trim() || undefined;

  const result = await listCommunityPosts({
    category,
    sort,
    page,
    search,
  });

  return (
    <div className="community-page">
      <header className="community-page__hero">
        <div>
          <h1 className="community-page__title">소통</h1>
          <p className="community-page__subtitle">
            누구나 자유롭게 이야기 나누는 공간
          </p>
        </div>
        <Link href="/community/write" className="community-page__write">
          글쓰기
        </Link>
      </header>

      <CommunityCategories totalCount={result.total} />

      <CommunityPostList
        posts={result.posts}
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        basePath="/community"
        searchParams={{
          cat: category === "all" ? undefined : category,
          sort: sort === "recent" ? undefined : sort,
          q: search,
        }}
      />
    </div>
  );
}

function normalizeCategory(raw: string | undefined): CommunityCategorySlug {
  if (!raw || raw === "all") return "all";
  const found = WRITABLE_CATEGORIES.find((slug) => slug === raw);
  return found ?? "all";
}

function normalizeSort(raw: string | undefined): CommunitySortKey {
  if (raw === "popular" || raw === "comments") return raw;
  return "recent";
}

function normalizePage(raw: string | undefined): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}
