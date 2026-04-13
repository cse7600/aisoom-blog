"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Bookmark } from "lucide-react";

interface CommunityPostActionsProps {
  postId: string;
  likeCount: number;
  bookmarkCount: number;
}

export function CommunityPostActions({
  postId,
  likeCount,
  bookmarkCount,
}: CommunityPostActionsProps) {
  const router = useRouter();
  const [working, setWorking] = useState(false);

  const likedKey = `community_liked_${postId}`;
  const bookmarkedKey = `community_bookmarked_${postId}`;

  const [liked, setLiked] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem(likedKey) === "1"
  );
  const [bookmarked, setBookmarked] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem(bookmarkedKey) === "1"
  );
  const [displayLike, setDisplayLike] = useState(likeCount);
  const [displayBookmark, setDisplayBookmark] = useState(bookmarkCount);

  const handleLike = async () => {
    if (liked) return;
    setLiked(true);
    setDisplayLike((prev) => prev + 1);
    localStorage.setItem(likedKey, "1");
    try {
      await fetch(`/api/community/posts/${postId}/like`, { method: "POST" });
    } catch {
      setLiked(false);
      setDisplayLike((prev) => prev - 1);
      localStorage.removeItem(likedKey);
    }
  };

  const handleBookmark = async () => {
    if (bookmarked) return;
    setBookmarked(true);
    setDisplayBookmark((prev) => prev + 1);
    localStorage.setItem(bookmarkedKey, "1");
    try {
      await fetch(`/api/community/posts/${postId}/bookmark`, { method: "POST" });
    } catch {
      setBookmarked(false);
      setDisplayBookmark((prev) => prev - 1);
      localStorage.removeItem(bookmarkedKey);
    }
  };

  const handleDelete = async () => {
    const password = window.prompt("게시글 삭제 — 비밀번호를 입력하세요");
    if (!password) return;
    setWorking(true);
    try {
      const response = await fetch(`/api/community/posts/${postId}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        window.alert(payload.error ?? "게시글 삭제에 실패했습니다");
        setWorking(false);
        return;
      }
      router.push("/community");
      router.refresh();
    } catch {
      window.alert("네트워크 오류로 삭제에 실패했습니다");
      setWorking(false);
    }
  };

  return (
    <div className="community-detail__actions">
      <button
        type="button"
        className={`community-detail__action community-detail__action--like${liked ? " is-active" : ""}`}
        onClick={handleLike}
        aria-pressed={liked}
        aria-label={`좋아요 ${displayLike}`}
      >
        <Heart
          size={16}
          aria-hidden="true"
          fill={liked ? "currentColor" : "none"}
        />
        {displayLike > 0 && <span>{displayLike}</span>}
      </button>
      <button
        type="button"
        className={`community-detail__action community-detail__action--bookmark${bookmarked ? " is-active" : ""}`}
        onClick={handleBookmark}
        aria-pressed={bookmarked}
        aria-label={`스크랩 ${displayBookmark}`}
      >
        <Bookmark
          size={16}
          aria-hidden="true"
          fill={bookmarked ? "currentColor" : "none"}
        />
        {displayBookmark > 0 && <span>{displayBookmark}</span>}
      </button>
      <button
        type="button"
        className="community-detail__action"
        onClick={handleDelete}
        disabled={working}
      >
        {working ? "처리 중..." : "삭제"}
      </button>
    </div>
  );
}
