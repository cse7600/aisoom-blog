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
import { SITE_CONFIG } from "@/lib/constants";

// 커뮤니티 글은 실시간 반영이 필수. Supabase fetch가 빌드 캐시에 갇히는 것을 방지.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "소통",
  description:
    "누구나 자유롭게 이야기 나누는 공간. 자유토크부터 질문/답변, 후기까지. 구매·선택 고민을 나눠 보세요.",
  alternates: { canonical: `${SITE_CONFIG.url}/community` },
  openGraph: {
    type: "website",
    title: `소통 | ${SITE_CONFIG.name}`,
    description: "누구나 자유롭게 이야기 나누는 공간.",
    url: `${SITE_CONFIG.url}/community`,
    siteName: SITE_CONFIG.name,
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

  const activeCategoryLabel = categoryLabel(category);
  const sortLabel = sortDescription(sort);

  return (
    <div className="community-page">
      <header className="community-page__hero">
        <div>
          <h1 className="community-page__title">소통 커뮤니티</h1>
          <p className="community-page__subtitle">
            구매·계약·선택 고민을 함께 나누는 공간. 자유토크, 질문/답변, 후기까지.
          </p>
        </div>
        <Link href="/community/write" className="community-page__write">
          글쓰기
        </Link>
      </header>

      <section aria-labelledby="community-categories-heading">
        <h2 id="community-categories-heading" className="sr-only">
          카테고리 및 정렬
        </h2>
        <CommunityCategories totalCount={result.total} />
      </section>

      <section aria-labelledby="community-posts-heading">
        <h2 id="community-posts-heading" className="community-page__section-title">
          {activeCategoryLabel} · {sortLabel}
          <span className="community-page__section-count">
            {" "}
            ({result.total.toLocaleString("ko-KR")}건)
          </span>
        </h2>
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
      </section>
    </div>
  );
}

function categoryLabel(slug: CommunityCategorySlug): string {
  switch (slug) {
    case "free":
      return "자유토크";
    case "qna":
      return "질문/답변";
    case "review":
      return "후기/리뷰";
    case "info":
      return "정보공유";
    case "humor":
      return "유머/짤";
    default:
      return "전체 글";
  }
}

function sortDescription(sort: CommunitySortKey): string {
  if (sort === "popular") return "조회수 많은 순";
  if (sort === "comments") return "댓글 많은 순";
  return "최신순";
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
