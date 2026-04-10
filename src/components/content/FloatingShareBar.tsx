"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Link as LinkIcon, X } from "lucide-react";

interface FloatingShareBarProps {
  url: string;
  title: string;
  description: string;
  imageUrl?: string;
}

const SCROLL_THRESHOLD = 400;

export function FloatingShareBar({
  url,
  title,
  description: _description,
  imageUrl,
}: FloatingShareBarProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function onScroll() {
      if (!dismissed) {
        setVisible(window.scrollY > SCROLL_THRESHOLD);
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [dismissed]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 클립보드 접근 불가 환경 */
    }
  }

  function openShare(shareUrl: string) {
    window.open(shareUrl, "_blank", "width=600,height=400,noopener,noreferrer");
  }

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const targets = [
    {
      name: "카카오",
      action: () =>
        openShare(`https://story.kakao.com/share?url=${encodedUrl}`),
      bgClass: "bg-[#FEE500] text-[#3a1d1d] hover:brightness-95",
    },
    {
      name: "X",
      action: () =>
        openShare(
          `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`
        ),
      bgClass:
        "bg-surface-1 text-foreground border border-border hover:bg-muted",
    },
    {
      name: "페이스북",
      action: () =>
        openShare(
          `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
        ),
      bgClass: "bg-surface-1 text-foreground border border-border hover:bg-muted",
    },
  ];

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ${
        visible && !dismissed ? "translate-y-0" : "translate-y-full"
      }`}
      role="complementary"
      aria-label="공유 바"
    >
      <div className="bg-surface-1 border-t border-border shadow-card-lg">
        <div className="mx-auto max-w-content px-4 sm:px-6 py-3 flex items-center gap-3">
          {/* 썸네일 */}
          {imageUrl && (
            <div className="relative w-10 h-10 rounded-badge overflow-hidden flex-shrink-0">
              <Image src={imageUrl} alt="" fill className="object-cover" sizes="40px" />
            </div>
          )}

          {/* 타이틀 */}
          <p className="flex-1 text-body-sm font-medium text-foreground truncate min-w-0">
            {title}
          </p>

          {/* 공유 버튼 */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {targets.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={t.action}
                className={`px-2.5 py-1.5 text-caption font-medium rounded-badge transition-all ${t.bgClass}`}
              >
                {t.name}
              </button>
            ))}
            <button
              type="button"
              onClick={copyLink}
              className="px-2.5 py-1.5 text-caption font-medium text-foreground/60 border border-border rounded-badge hover:text-primary hover:border-primary/30 transition-all flex items-center gap-1"
            >
              <LinkIcon className="w-3 h-3" />
              {copied ? "완료" : "링크"}
            </button>
          </div>

          {/* 닫기 */}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1 text-foreground/30 hover:text-foreground/60 transition-colors flex-shrink-0"
            aria-label="공유 바 닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
