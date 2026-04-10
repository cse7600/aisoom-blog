import type { DiscussionWithReplies, DiscussionReplyWithPersona } from "@/lib/discussion-types";
import { SITE_CONFIG } from "@/lib/constants";

interface DiscussionJsonLdProps {
  postUrl: string;
  postTitle: string;
  discussions: DiscussionWithReplies[];
}

interface PersonRef {
  "@type": "Person";
  name: string;
  url: string;
}

interface InteractionCounter {
  "@type": "InteractionCounter";
  interactionType: string;
  userInteractionCount: number;
}

interface CommentNode {
  "@type": "Comment";
  "@id": string;
  text: string;
  datePublished: string;
  author: PersonRef;
  interactionStatistic?: InteractionCounter[];
}

interface DiscussionForumPostingNode {
  "@context": "https://schema.org";
  "@type": "DiscussionForumPosting";
  "@id": string;
  mainEntityOfPage: string;
  headline: string;
  text: string;
  datePublished: string;
  author: PersonRef;
  interactionStatistic: InteractionCounter[];
  comment: CommentNode[];
}

export function DiscussionJsonLd({ postUrl, postTitle, discussions }: DiscussionJsonLdProps) {
  if (discussions.length === 0) return null;
  const payload = discussions.map((discussion) =>
    buildDiscussionForumPosting(postUrl, postTitle, discussion)
  );

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}

function profileUrl(nickname: string): string {
  return `${SITE_CONFIG.url}/community/users/${encodeURIComponent(nickname)}`;
}

function buildPersonRef(nickname: string): PersonRef {
  return {
    "@type": "Person",
    name: nickname,
    url: profileUrl(nickname),
  };
}

function buildDiscussionForumPosting(
  postUrl: string,
  postTitle: string,
  discussion: DiscussionWithReplies
): DiscussionForumPostingNode {
  const discussionId = `${postUrl}#discussion-${discussion.id}`;
  return {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    "@id": discussionId,
    mainEntityOfPage: postUrl,
    headline: summarize(discussion.content, 80) || postTitle,
    text: discussion.content,
    datePublished: discussion.created_at,
    author: buildPersonRef(discussion.persona.nickname),
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/LikeAction",
        userInteractionCount: discussion.upvotes ?? 0,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/CommentAction",
        userInteractionCount: discussion.replies.length,
      },
    ],
    comment: discussion.replies.map((reply) => buildCommentNode(postUrl, discussion.id, reply)),
  };
}

function buildCommentNode(
  postUrl: string,
  discussionId: string,
  reply: DiscussionReplyWithPersona
): CommentNode {
  return {
    "@type": "Comment",
    "@id": `${postUrl}#discussion-${discussionId}-reply-${reply.id}`,
    text: reply.content,
    datePublished: reply.created_at,
    author: buildPersonRef(reply.persona.nickname),
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/LikeAction",
        userInteractionCount: reply.upvotes ?? 0,
      },
    ],
  };
}

function summarize(text: string, maxChars: number): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars - 1)}…`;
}
