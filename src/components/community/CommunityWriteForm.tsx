"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { WRITABLE_CATEGORIES, COMMUNITY_CATEGORIES } from "@/lib/community-types";

const CATEGORY_OPTIONS = COMMUNITY_CATEGORIES.filter((cat) =>
  (WRITABLE_CATEGORIES as ReadonlyArray<string>).includes(cat.slug)
);

interface FormState {
  category: string;
  title: string;
  content: string;
  nickname: string;
  password: string;
}

const INITIAL_STATE: FormState = {
  category: "free",
  title: "",
  content: "",
  nickname: "",
  password: "",
};

export function CommunityWriteForm() {
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
      const response = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        post?: { id?: string };
      };
      if (!response.ok || !payload.ok) {
        setErrorMessage(payload.error ?? "글 작성 중 오류가 발생했습니다");
        setSubmitting(false);
        return;
      }
      const newId = payload.post?.id;
      if (newId) {
        router.push(`/community/${newId}`);
        router.refresh();
      } else {
        router.push("/community");
        router.refresh();
      }
    } catch {
      setErrorMessage("네트워크 오류로 글 작성에 실패했습니다");
      setSubmitting(false);
    }
  };

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <form className="community-form" onSubmit={handleSubmit} noValidate>
      <div className="community-form__row community-form__row--inline">
        <label className="community-form__label" htmlFor="community-category">
          카테고리
        </label>
        <select
          id="community-category"
          className="community-form__select"
          value={form.category}
          onChange={(event) => updateField("category", event.target.value)}
          required
        >
          {CATEGORY_OPTIONS.map((cat) => (
            <option key={cat.slug} value={cat.slug}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      <div className="community-form__row">
        <label className="community-form__label" htmlFor="community-title">
          제목
        </label>
        <input
          id="community-title"
          className="community-form__input"
          type="text"
          value={form.title}
          onChange={(event) => updateField("title", event.target.value)}
          placeholder="5~100자"
          maxLength={100}
          required
        />
      </div>

      <div className="community-form__row">
        <label className="community-form__label" htmlFor="community-content">
          내용
        </label>
        <textarea
          id="community-content"
          className="community-form__textarea"
          value={form.content}
          onChange={(event) => updateField("content", event.target.value)}
          placeholder="어떤 이야기를 나누고 싶으신가요?"
          rows={12}
          maxLength={10000}
          required
        />
      </div>

      <div className="community-form__row community-form__row--two">
        <div>
          <label className="community-form__label" htmlFor="community-nickname">
            닉네임
          </label>
          <input
            id="community-nickname"
            className="community-form__input"
            type="text"
            value={form.nickname}
            onChange={(event) => updateField("nickname", event.target.value)}
            placeholder="2~10자"
            maxLength={10}
            required
          />
        </div>
        <div>
          <label className="community-form__label" htmlFor="community-password">
            비밀번호
          </label>
          <input
            id="community-password"
            className="community-form__input"
            type="password"
            value={form.password}
            onChange={(event) => updateField("password", event.target.value)}
            placeholder="수정/삭제 시 필요"
            maxLength={40}
            required
          />
        </div>
      </div>

      {errorMessage && (
        <p className="community-form__error" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="community-form__actions">
        <button
          type="submit"
          className="community-form__submit"
          disabled={submitting}
        >
          {submitting ? "등록 중..." : "글 등록"}
        </button>
      </div>
    </form>
  );
}
