import Link from "next/link";
import type { CommunityPostPublic } from "@/lib/community-types";
import { CommunityPostRow } from "./CommunityPostRow";

interface CommunityPostListProps {
  posts: CommunityPostPublic[];
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  searchParams: Record<string, string | undefined>;
}

export function CommunityPostList({
  posts,
  page,
  pageSize,
  total,
  basePath,
  searchParams,
}: CommunityPostListProps) {
  if (posts.length === 0) {
    return (
      <div className="community-empty">
        <p className="community-empty__title">아직 글이 없습니다</p>
        <p className="community-empty__desc">
          이 카테고리의 첫 글을 작성해 보세요.
        </p>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <ul className="community-list" role="list">
        <li className="community-list__head" aria-hidden="true">
          <span className="community-row__category">구분</span>
          <span className="community-row__title">제목</span>
          <span className="community-row__author">글쓴이</span>
          <span className="community-row__views">조회</span>
          <span className="community-row__time">시간</span>
        </li>
        {posts.map((post) => (
          <CommunityPostRow key={post.id} post={post} />
        ))}
      </ul>
      <Pagination
        page={page}
        totalPages={totalPages}
        basePath={basePath}
        searchParams={searchParams}
      />
    </>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  basePath: string;
  searchParams: Record<string, string | undefined>;
}

function Pagination({
  page,
  totalPages,
  basePath,
  searchParams,
}: PaginationProps) {
  if (totalPages <= 1) return null;
  const pages = buildPageNumbers(page, totalPages);
  return (
    <nav className="community-pagination" aria-label="페이지네이션">
      {page > 1 && (
        <Link
          href={buildHref(basePath, searchParams, page - 1)}
          className="community-pagination__nav"
        >
          이전
        </Link>
      )}
      {pages.map((num) => (
        <Link
          key={num}
          href={buildHref(basePath, searchParams, num)}
          className={
            num === page
              ? "community-pagination__item community-pagination__item--active"
              : "community-pagination__item"
          }
          aria-current={num === page ? "page" : undefined}
        >
          {num}
        </Link>
      ))}
      {page < totalPages && (
        <Link
          href={buildHref(basePath, searchParams, page + 1)}
          className="community-pagination__nav"
        >
          다음
        </Link>
      )}
    </nav>
  );
}

function buildPageNumbers(current: number, total: number): number[] {
  const range: number[] = [];
  const start = Math.max(1, current - 2);
  const end = Math.min(total, start + 4);
  for (let index = start; index <= end; index += 1) {
    range.push(index);
  }
  return range;
}

function buildHref(
  basePath: string,
  params: Record<string, string | undefined>,
  page: number
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "page") search.set(key, value);
  }
  if (page > 1) search.set("page", page.toString());
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}
