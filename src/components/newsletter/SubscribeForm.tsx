"use client";

import { useState } from "react";

interface SubscribeFormProps {
  variant?: "inline" | "card";
  source?: string;
}

export default function SubscribeForm({
  variant = "inline",
  source = "website",
}: SubscribeFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (data.ok) {
        setStatus("success");
        setMessage(data.message ?? "구독 완료");
        setEmail("");
      } else {
        setStatus("error");
        setMessage(data.error ?? "오류가 발생했습니다");
      }
    } catch {
      setStatus("error");
      setMessage("네트워크 오류. 다시 시도해주세요");
    }
  }

  if (variant === "card") {
    return (
      <div className="subscribe-card">
        <p className="subscribe-card__eyebrow">놓치지 마세요</p>
        <h3 className="subscribe-card__title">찐 정보만 골라서 드립니다</h3>
        <p className="subscribe-card__desc">
          광고 없이. 뻔한 추천 없이. 직접 비교하고 테스트한 것만.
          주 1회, 핵심만.
        </p>
        <form onSubmit={handleSubmit} className="subscribe-card__form">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일 주소"
            disabled={status === "loading" || status === "success"}
            className="subscribe-card__input"
            required
          />
          <button
            type="submit"
            disabled={status === "loading" || status === "success"}
            className="subscribe-card__btn"
          >
            {status === "loading" ? "처리 중..." : status === "success" ? "구독 완료" : "무료 구독"}
          </button>
        </form>
        {message && (
          <p className={`subscribe-card__msg subscribe-card__msg--${status}`}>
            {message}
          </p>
        )}
        <p className="subscribe-card__privacy">언제든지 구독 취소 가능. 스팸 없음.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="subscribe-inline">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="이메일 주소를 입력하세요"
        disabled={status === "loading" || status === "success"}
        className="subscribe-inline__input"
        required
      />
      <button
        type="submit"
        disabled={status === "loading" || status === "success"}
        className="subscribe-inline__btn"
      >
        {status === "loading" ? "..." : status === "success" ? "완료" : "구독"}
      </button>
      {message && (
        <p className={`subscribe-inline__msg subscribe-inline__msg--${status}`}>
          {message}
        </p>
      )}
    </form>
  );
}
