import type {
  DiscussionWithReplies,
  DiscussionReplyWithPersona,
} from "@/lib/discussion-types";
import { SITE_CONFIG } from "@/lib/constants";

interface DiscussionJsonLdProps {
  postUrl: string;
  postTitle: string;
  postPublishedAt: string;
  postUpdatedAt: string;
  discussions: DiscussionWithReplies[];
  postAuthor?: string | null;
}

interface PersonRef {
  "@type": "Person";
  name: string;
  url: string;
}


interface ParentRef {
  "@id": string;
}

interface CommentNode {
  "@type": "Comment";
  "@id": string;
  identifier: string;
  text: string;
  dateCreated: string;
  upvoteCount: number;
  author: PersonRef;
  parentItem?: ParentRef;
  comment?: CommentNode[];
}

interface DiscussionForumPostingNode {
  "@context": "https://schema.org";
  "@type": "DiscussionForumPosting";
  "@id": string;
  url: string;
  headline: string;
  datePublished: string;
  dateModified: string;
  author: PersonRef;
  commentCount: number;
  comment: CommentNode[];
}

export function DiscussionJsonLd({
  postUrl,
  postTitle,
  postPublishedAt,
  postUpdatedAt,
  discussions,
  postAuthor,
}: DiscussionJsonLdProps) {
  if (discussions.length === 0) return null;
  const payload = buildForumPosting(
    postUrl,
    postTitle,
    postPublishedAt,
    postUpdatedAt,
    discussions,
    postAuthor ?? "편집부"
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


function latestTimestamp(
  postUpdatedAt: string,
  discussions: DiscussionWithReplies[]
): string {
  let latest = new Date(postUpdatedAt).getTime();
  for (const discussion of discussions) {
    latest = Math.max(latest, new Date(discussion.created_at).getTime());
    for (const reply of discussion.replies) {
      latest = Math.max(latest, new Date(reply.created_at).getTime());
    }
  }
  return new Date(latest).toISOString();
}

function countAllComments(discussions: DiscussionWithReplies[]): number {
  return discussions.reduce(
    (acc, discussion) => acc + 1 + discussion.replies.length,
    0
  );
}

function buildForumPosting(
  postUrl: string,
  postTitle: string,
  postPublishedAt: string,
  postUpdatedAt: string,
  discussions: DiscussionWithReplies[],
  authorName: string
): DiscussionForumPostingNode {
  return {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    "@id": `${postUrl}#discussion`,
    url: postUrl,
    headline: postTitle,
    datePublished: postPublishedAt,
    dateModified: latestTimestamp(postUpdatedAt, discussions),
    author: buildPersonRef(authorName),
    commentCount: countAllComments(discussions),
    comment: discussions.map((discussion) => buildTopComment(postUrl, discussion)),
  };
}

function buildTopComment(
  postUrl: string,
  discussion: DiscussionWithReplies
): CommentNode {
  const commentId = `${postUrl}#discussion-${discussion.id}`;
  const node: CommentNode = {
    "@type": "Comment",
    "@id": commentId,
    identifier: discussion.id,
    text: discussion.content,
    dateCreated: discussion.created_at,
    upvoteCount: discussion.upvotes ?? 0,
    author: buildPersonRef(discussion.persona.nickname),
  };
  if (discussion.replies.length > 0) {
    node.comment = discussion.replies.map((reply) =>
      buildReplyComment(postUrl, commentId, reply)
    );
  }
  return node;
}

function buildReplyComment(
  postUrl: string,
  parentId: string,
  reply: DiscussionReplyWithPersona
): CommentNode {
  return {
    "@type": "Comment",
    "@id": `${postUrl}#reply-${reply.id}`,
    identifier: reply.id,
    text: reply.content,
    dateCreated: reply.created_at,
    upvoteCount: reply.upvotes ?? 0,
    author: buildPersonRef(reply.persona.nickname),
    parentItem: { "@id": parentId },
  };
}
