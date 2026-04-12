"use client";

import { useState, useEffect } from "react";
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
  title: _title,
  description: _description,
  imageUrl: _imageUrl,
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

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ${
        visible && !dismissed ? "translate-y-0" : "translate-y-full"
      }`}
      role="complementary"
      aria-label="공유 바"
    >
      <div className="bg-surface-1 border-t border-border shadow-card-lg pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-content px-4 sm:px-6 py-3 relative flex items-center justify-center">
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-body-sm font-medium text-foreground border border-border rounded-button hover:text-primary hover:border-primary/40 transition-all"
          >
            <LinkIcon className="w-4 h-4" />
            {copied ? "링크 복사 완료" : "링크 복사"}
          </button>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="absolute right-4 sm:right-6 p-1 text-foreground/30 hover:text-foreground/60 transition-colors"
            aria-label="공유 바 닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
