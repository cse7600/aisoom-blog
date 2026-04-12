import Link from "next/link";
import type { CommunityPostPublic } from "@/lib/community-types";
import { COMMUNITY_CATEGORIES } from "@/lib/community-types";

interface CommunityPostRowProps {
  post: CommunityPostPublic;
}

export function CommunityPostRow({ post }: CommunityPostRowProps) {
  const categoryName = getCategoryName(post.category);
  const detailHref = `/community/${post.id}`;
  const commentCount = post.comment_count;
  const viewCount = formatCompact(post.view_count);
  const timeLabel = formatTimeLabel(post.created_at);
  const hotClass = post.is_hot
    ? "community-row community-row--hot"
    : "community-row";

  return (
    <li className={hotClass}>
      <Link href={detailHref} className="community-row__link" role="link">
        <span className="community-row__category">[{categoryName}]</span>
        <span className="community-row__title">
          {post.title}
          {commentCount > 0 && (
            <span
              className="community-row__comment--naver"
              aria-label={`댓글 ${commentCount}개`}
            >
              [{commentCount}]
            </span>
          )}
        </span>
      </Link>
      <span className="community-row__author" title={post.nickname}>
        {post.nickname}
      </span>
      <span
        className={
          post.view_count >= 100
            ? "community-row__views-label views--high"
            : "community-row__views-label"
        }
        aria-label="조회수"
      >
        {viewCount}
      </span>
      <span className="community-row__time" title={post.created_at}>
        {timeLabel}
      </span>
    </li>
  );
}

function getCategoryName(slug: string): string {
  const found = COMMUNITY_CATEGORIES.find((cat) => cat.slug === slug);
  return found?.name ?? slug;
}

function formatCompact(value: number): string {
  if (value < 1000) return value.toString();
  const divided = value / 1000;
  return `${divided.toFixed(divided >= 10 ? 0 : 1)}k`;
}

function formatTimeLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }
  return `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}
