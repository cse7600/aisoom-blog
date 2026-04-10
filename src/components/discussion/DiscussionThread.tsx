import { PersonaBadge } from "./PersonaBadge";
import type {
  DiscussionWithReplies,
  DiscussionReplyWithPersona,
} from "@/lib/discussion-types";
import { ThumbsUp } from "lucide-react";

interface DiscussionThreadProps {
  discussion: DiscussionWithReplies;
}

export function DiscussionThread({ discussion }: DiscussionThreadProps) {
  return (
    <article className="discussion-thread">
      <header className="mb-2">
        <PersonaBadge persona={discussion.persona} createdAt={discussion.created_at} />
      </header>
      <p className="discussion-body">{discussion.content}</p>
      <UpvoteRow upvotes={discussion.upvotes} size={13} />
      {discussion.replies.length > 0 && (
        <ul className="discussion-replies">
          {discussion.replies.map((reply) => (
            <ReplyItem key={reply.id} reply={reply} />
          ))}
        </ul>
      )}
    </article>
  );
}

function ReplyItem({ reply }: { reply: DiscussionReplyWithPersona }) {
  return (
    <li className="discussion-reply">
      <header className="mb-1">
        <PersonaBadge persona={reply.persona} createdAt={reply.created_at} />
      </header>
      <p className="discussion-body">{reply.content}</p>
      <UpvoteRow upvotes={reply.upvotes} size={12} />
    </li>
  );
}

function UpvoteRow({ upvotes, size }: { upvotes: number; size: number }) {
  return (
    <footer className="discussion-footer">
      <span className="discussion-upvote">
        <ThumbsUp size={size} aria-hidden />
        {upvotes}
      </span>
    </footer>
  );
}
