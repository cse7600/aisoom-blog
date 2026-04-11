import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCommunityPostDetail,
  incrementCommunityPostView,
} from "@/lib/community-db";
import { COMMUNITY_CATEGORIES } from "@/lib/community-types";
import { CommunityComments } from "@/components/community/CommunityComments";
import { CommunityPostActions } from "@/components/community/CommunityPostActions";
import { DiscussionJsonLd } from "@/components/community/DiscussionJsonLd";

interface CommunityDetailPageProps {
  params: { id: string };
}

export async function generateMetadata({
  params,
}: CommunityDetailPageProps): Promise<Metadata> {
  const detail = await getCommunityPostDetail(params.id);
  if (!detail) {
    return { title: "게시글 | 소통 | 꿀정보" };
  }
  return {
    title: `${detail.post.title} | 소통 | 꿀정보`,
    description: detail.post.content.slice(0, 140),
    openGraph: {
      title: detail.post.title,
      description: detail.post.content.slice(0, 140),
    },
  };
}

export default async function CommunityDetailPage({
  params,
}: CommunityDetailPageProps) {
  const detail = await getCommunityPostDetail(params.id);
  if (!detail) {
    notFound();
  }

  await incrementCommunityPostView(params.id);
  const { post, comments } = detail;
  const categoryName = COMMUNITY_CATEGORIES.find(
    (cat) => cat.slug === post.category
  )?.name ?? post.category;

  return (
    <article className="community-detail">
      <DiscussionJsonLd post={post} comments={comments} />
      <header className="community-detail__header">
        <Link href="/community" className="community-detail__back">
          소통 목록
        </Link>
        <div className="community-detail__meta">
          <span className="community-detail__category">[{categoryName}]</span>
          {post.is_ai_generated && (
            <span
              className="community-detail__badge"
              title="AI 페르소나 작성"
            >
              AI 씨앗 글
            </span>
          )}
        </div>
        <h1 className="community-detail__title">{post.title}</h1>
        <div className="community-detail__info">
          <span className="community-detail__author">{post.nickname}</span>
          <span className="community-detail__dot" aria-hidden="true">·</span>
          <time className="community-detail__time" dateTime={post.created_at}>
            {formatFull(post.created_at)}
          </time>
          <span className="community-detail__dot" aria-hidden="true">·</span>
          <span className="community-detail__views">
            조회 {post.view_count.toLocaleString("ko-KR")}
          </span>
        </div>
      </header>

      <div className="community-detail__body">
        {post.content.split(/\n{2,}/).map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>

      <CommunityPostActions postId={post.id} />

      <CommunityComments postId={post.id} comments={comments} />
    </article>
  );
}

function formatFull(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hour = date.getHours().toString().padStart(2, "0");
  const min = date.getMinutes().toString().padStart(2, "0");
  return `${year}.${month}.${day} ${hour}:${min}`;
}
