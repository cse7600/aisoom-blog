"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CommunityPostActionsProps {
  postId: string;
}

export function CommunityPostActions({ postId }: CommunityPostActionsProps) {
  const router = useRouter();
  const [working, setWorking] = useState(false);

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
        className="community-detail__action"
        onClick={handleDelete}
        disabled={working}
      >
        {working ? "처리 중..." : "삭제"}
      </button>
    </div>
  );
}
