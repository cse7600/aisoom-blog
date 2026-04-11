/**
 * Phase 9.1 DiscussionForumPosting JSON-LD
 * Google SERP "Discussions and Forums" feature 노출 조건 충족.
 * 주의: 스키마 내용은 반드시 실제 DB 내용과 100% 일치해야 함.
 */

import type {
  CommunityPostPublic,
  CommunityCommentThread,
} from "@/lib/community-types";

const SITE_ORIGIN = "https://kkulinfo.com";

interface DiscussionJsonLdProps {
  post: CommunityPostPublic;
  comments: CommunityCommentThread[];
}

export function DiscussionJsonLd({ post, comments }: DiscussionJsonLdProps) {
  const schema = buildDiscussionSchema(post, comments);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

function buildDiscussionSchema(
  post: CommunityPostPublic,
  comments: CommunityCommentThread[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: post.title,
    text: post.content,
    url: `${SITE_ORIGIN}/community/${post.id}`,
    datePublished: post.created_at,
    dateModified: post.updated_at,
    author: buildAuthor(post.nickname),
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/CommentAction",
        userInteractionCount: post.comment_count,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/ViewAction",
        userInteractionCount: post.view_count,
      },
    ],
    comment: comments.map(buildCommentSchema),
  };
}

function buildCommentSchema(thread: CommunityCommentThread) {
  const base = {
    "@type": "Comment",
    text: thread.content,
    author: buildAuthor(thread.nickname),
    datePublished: thread.created_at,
  };
  if (thread.replies.length === 0) return base;
  return {
    ...base,
    comment: thread.replies.map((reply) => ({
      "@type": "Comment",
      text: reply.content,
      author: buildAuthor(reply.nickname),
      datePublished: reply.created_at,
    })),
  };
}

function buildAuthor(nickname: string) {
  return {
    "@type": "Person",
    name: nickname,
    url: `${SITE_ORIGIN}/community/users/${encodeURIComponent(nickname)}`,
  };
}
