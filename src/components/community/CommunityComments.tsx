"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, CornerDownRight } from "lucide-react";
import type { CommunityCommentThread } from "@/lib/community-types";
import { CommunityCommentForm } from "./CommunityCommentForm";

interface CommunityCommentsProps {
  postId: string;
  comments: CommunityCommentThread[];
}

export function CommunityComments({ postId, comments }: CommunityCommentsProps) {
  const totalCount = countDeep(comments);
  return (
    <section className="nv-comments" aria-label="댓글">
      <header className="nv-comments__header">
        <span className="nv-comments__count-label">댓글</span>
        <span className="nv-comments__count">{totalCount}</span>
      </header>

      <CommunityCommentForm postId={postId} />

      {comments.length === 0 ? (
        <p className="nv-comments__empty">첫 댓글을 남겨 보세요.</p>
      ) : (
        <ul className="nv-comments__list">
          {comments.map((comment) => (
            <CommentItem key={comment.id} postId={postId} comment={comment} />
          ))}
        </ul>
      )}
    </section>
  );
}

function countDeep(comments: CommunityCommentThread[]): number {
  return comments.reduce((acc, c) => acc + 1 + c.replies.length, 0);
}

// ─── 댓글 아이템 ──────────────────────────────────────────────────────────

interface CommentItemProps {
  postId: string;
  comment: CommunityCommentThread;
}

function CommentItem({ postId, comment }: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);

  return (
    <li className="nv-comment">
      <CommentBody
        commentId={comment.id}
        nickname={comment.nickname}
        content={comment.content}
        createdAt={comment.created_at}
        onReply={() => setShowReplyForm((v) => !v)}
        replyOpen={showReplyForm}
      />

      {showReplyForm && (
        <div className="nv-comment__reply-form">
          <CommunityCommentForm
            postId={postId}
            parentId={comment.id}
            placeholder="답글을 입력하세요"
            onCancel={() => setShowReplyForm(false)}
          />
        </div>
      )}

      {comment.replies.length > 0 && (
        <ul className="nv-comment__replies">
          {comment.replies.map((reply) => (
            <li key={reply.id} className="nv-comment__reply">
              <span className="nv-comment__reply-arrow" aria-hidden>
                <CornerDownRight size={13} />
              </span>
              <CommentBody
                commentId={reply.id}
                nickname={reply.nickname}
                content={reply.content}
                createdAt={reply.created_at}
                isReply
              />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

// ─── 댓글 본문 ───────────────────────────────────────────────────────────

interface CommentBodyProps {
  commentId: string;
  nickname: string;
  content: string;
  createdAt: string;
  isReply?: boolean;
  onReply?: () => void;
  replyOpen?: boolean;
}

function CommentBody({
  commentId,
  nickname,
  content,
  createdAt,
  isReply = false,
  onReply,
  replyOpen,
}: CommentBodyProps) {
  const router = useRouter();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(seedLikeCount(commentId));
  const [deleting, setDeleting] = useState(false);

  function toggleLike() {
    setLiked((prev) => !prev);
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1));
  }

  async function handleDelete() {
    const password = window.prompt("댓글 삭제 — 비밀번호를 입력하세요");
    if (!password) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/community/comments/${commentId}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        window.alert(body.error ?? "댓글 삭제에 실패했습니다");
        setDeleting(false);
        return;
      }
      router.refresh();
    } catch {
      window.alert("네트워크 오류로 삭제에 실패했습니다");
      setDeleting(false);
    }
  }

  return (
    <div className="nv-comment__body">
      {!isReply && (
        <div className="nv-comment__avatar" aria-hidden style={avatarStyle(nickname)}>
          {nickname.slice(0, 1)}
        </div>
      )}
      <div className="nv-comment__main">
        <div className="nv-comment__meta">
          <span className="nv-comment__nickname">{nickname}</span>
          <span className="nv-comment__time">{formatRelative(createdAt)}</span>
        </div>
        <p className="nv-comment__content">{content}</p>
        <div className="nv-comment__footer">
          <button
            type="button"
            className={`nv-comment__like ${liked ? "nv-comment__like--active" : ""}`}
            onClick={toggleLike}
            aria-label={liked ? "좋아요 취소" : "좋아요"}
          >
            <Heart size={13} fill={liked ? "currentColor" : "none"} />
            {likeCount > 0 && <span>{likeCount}</span>}
          </button>
          {!isReply && onReply && (
            <button
              type="button"
              className="nv-comment__reply-btn"
              onClick={onReply}
            >
              {replyOpen ? "답글 닫기" : "답글"}
            </button>
          )}
          <button
            type="button"
            className="nv-comment__delete"
            onClick={handleDelete}
            disabled={deleting}
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 유틸 ─────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  { bg: "#e8f4ff", text: "#1a73e8" },
  { bg: "#fff3e8", text: "#e67600" },
  { bg: "#e8fff0", text: "#1a8a45" },
  { bg: "#f5e8ff", text: "#8a2be2" },
  { bg: "#ffe8e8", text: "#d32f2f" },
  { bg: "#e8fffc", text: "#00897b" },
  { bg: "#fff8e8", text: "#f9a825" },
];

function avatarStyle(nickname: string): React.CSSProperties {
  let hash = 0;
  for (let i = 0; i < nickname.length; i++) {
    hash = (hash * 31 + nickname.charCodeAt(i)) % AVATAR_COLORS.length;
  }
  const color = AVATAR_COLORS[hash] ?? AVATAR_COLORS[0];
  return {
    backgroundColor: color?.bg,
    color: color?.text,
  };
}

function seedLikeCount(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 13 + id.charCodeAt(i)) & 0xffff;
  }
  return hash % 12;
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  const d = date;
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}
