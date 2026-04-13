"use client";

import { Link as LinkIcon, Check } from "lucide-react";
import { useState } from "react";

interface ShareButtonsProps {
  url: string;
  title: string;
  description: string;
}

export function ShareButtons({ url }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 클립보드 접근 불가 환경 대응 */
    }
  }

  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={copyLink}
        className="inline-flex items-center gap-2 px-5 py-3 text-body-sm font-semibold border-2 rounded-badge transition-all min-h-[44px]
          border-primary text-primary hover:bg-primary hover:text-white
          data-[copied=true]:border-green-500 data-[copied=true]:text-green-600 data-[copied=true]:hover:bg-green-500 data-[copied=true]:hover:text-white"
        data-copied={copied}
      >
        {copied ? (
          <Check className="w-4 h-4" />
        ) : (
          <LinkIcon className="w-4 h-4" />
        )}
        {copied ? "링크 복사됨" : "링크 복사"}
      </button>
    </div>
  );
}
