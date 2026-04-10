"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

interface CommunityCommentFormProps {
  postId: string;
  parentId?: string | null;
  placeholder?: string;
  onCancel?: () => void;
}

interface FormState {
  nickname: string;
  password: string;
  content: string;
}

const INITIAL_STATE: FormState = {
  nickname: "",
  password: "",
  content: "",
};

export function CommunityCommentForm({
  postId,
  parentId = null,
  placeholder = "댓글을 입력하세요",
  onCancel,
}: CommunityCommentFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/community/posts/${postId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname: form.nickname,
          password: form.password,
          content: form.content,
          parent_id: parentId,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        setErrorMessage(payload.error ?? "댓글 등록에 실패했습니다");
        setSubmitting(false);
        return;
      }
      setForm(INITIAL_STATE);
      setSubmitting(false);
      if (onCancel) onCancel();
      router.refresh();
    } catch {
      setErrorMessage("네트워크 오류로 댓글 등록에 실패했습니다");
      setSubmitting(false);
    }
  };

  return (
    <form className="community-comment-form" onSubmit={handleSubmit} noValidate>
      <div className="community-comment-form__meta">
        <input
          className="community-comment-form__input"
          type="text"
          value={form.nickname}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, nickname: event.target.value }))
          }
          placeholder="닉네임"
          maxLength={10}
          required
        />
        <input
          className="community-comment-form__input"
          type="password"
          value={form.password}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, password: event.target.value }))
          }
          placeholder="비밀번호"
          maxLength={40}
          required
        />
      </div>
      <textarea
        className="community-comment-form__textarea"
        value={form.content}
        onChange={(event) =>
          setForm((prev) => ({ ...prev, content: event.target.value }))
        }
        placeholder={placeholder}
        rows={3}
        maxLength={1000}
        required
      />
      {errorMessage && (
        <p className="community-comment-form__error" role="alert">
          {errorMessage}
        </p>
      )}
      <div className="community-comment-form__actions">
        {onCancel && (
          <button
            type="button"
            className="community-comment-form__cancel"
            onClick={onCancel}
          >
            취소
          </button>
        )}
        <button
          type="submit"
          className="community-comment-form__submit"
          disabled={submitting}
        >
          {submitting ? "등록 중..." : "등록"}
        </button>
      </div>
    </form>
  );
}
