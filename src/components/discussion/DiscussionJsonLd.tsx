import type { DiscussionWithReplies } from "@/lib/discussion-types";

interface DiscussionJsonLdProps {
  postUrl: string;
  postTitle: string;
  discussions: DiscussionWithReplies[];
}

interface CommentNode {
  "@type": "Comment";
  text: string;
  author: { "@type": "Person"; name: string };
  datePublished: string;
  comment?: CommentNode[];
}

export function DiscussionJsonLd({ postUrl, postTitle, discussions }: DiscussionJsonLdProps) {
  if (discussions.length === 0) return null;
  const payload = buildJsonLdPayload(postUrl, postTitle, discussions);

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}

function buildJsonLdPayload(
  postUrl: string,
  postTitle: string,
  discussions: DiscussionWithReplies[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    "@id": `${postUrl}#discussions`,
    headline: postTitle,
    url: postUrl,
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/CommentAction",
      userInteractionCount: discussions.length,
    },
    comment: discussions.map(toCommentNode),
  };
}

function toCommentNode(discussion: DiscussionWithReplies): CommentNode {
  const node: CommentNode = {
    "@type": "Comment",
    text: discussion.content,
    author: { "@type": "Person", name: discussion.persona.nickname },
    datePublished: discussion.created_at,
  };

  if (discussion.replies.length > 0) {
    node.comment = discussion.replies.map((reply) => ({
      "@type": "Comment",
      text: reply.content,
      author: { "@type": "Person", name: reply.persona.nickname },
      datePublished: reply.created_at,
    }));
  }
  return node;
}
