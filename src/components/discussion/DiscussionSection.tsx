import { getDiscussionsByPostSlug } from "@/lib/discussion-db";
import type { DiscussionWithReplies } from "@/lib/discussion-types";
import { DiscussionThread } from "./DiscussionThread";
import { DiscussionJsonLd } from "./DiscussionJsonLd";

interface DiscussionSectionProps {
  postSlug: string;
  postTitle: string;
  postUrl: string;
  postPublishedAt: string;
  postUpdatedAt: string;
  postAuthor?: string | null;
}

export async function DiscussionSection({
  postSlug,
  postTitle,
  postUrl,
  postPublishedAt,
  postUpdatedAt,
  postAuthor,
}: DiscussionSectionProps) {
  const discussions = await getDiscussionsByPostSlug(postSlug);
  if (discussions.length === 0) return <EmptyDiscussion />;

  return (
    <section className="discussion-section" aria-label="토론">
      <DiscussionJsonLd
        postUrl={postUrl}
        postTitle={postTitle}
        postPublishedAt={postPublishedAt}
        postUpdatedAt={postUpdatedAt}
        discussions={discussions}
        postAuthor={postAuthor}
      />
      <header className="discussion-section-header">
        <h2 className="discussion-heading">
          토론 <span className="discussion-count">({countTotal(discussions)})</span>
        </h2>
      </header>
      <div className="space-y-5 mt-4">
        {discussions.map((discussion) => (
          <DiscussionThread key={discussion.id} discussion={discussion} />
        ))}
      </div>
    </section>
  );
}

function EmptyDiscussion() {
  return (
    <section className="discussion-section" aria-label="토론">
      <header className="discussion-section-header">
        <h2 className="discussion-heading">토론</h2>
        <p className="text-body-sm text-foreground/50 mt-2">
          아직 등록된 의견이 없습니다.
        </p>
      </header>
    </section>
  );
}

function countTotal(discussions: DiscussionWithReplies[]): number {
  return discussions.reduce((acc, row) => acc + 1 + row.replies.length, 0);
}
