"use client";

import { Share2, Link as LinkIcon } from "lucide-react";
import { useState } from "react";

interface ShareButtonsProps {
  url: string;
  title: string;
  description: string;
}

export function ShareButtons({ url, title, description }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 클립보드 접근 불가 환경 대응 */
    }
  }

  const shareTargets = [
    {
      name: "카카오톡",
      url: `https://story.kakao.com/share?url=${encodedUrl}`,
      color: "hover:text-[#FEE500]",
    },
    {
      name: "X",
      url: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      color: "hover:text-foreground",
    },
    {
      name: "페이스북",
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedDescription}`,
      color: "hover:text-[#1877F2]",
    },
  ];

  return (
    <div className="flex items-center gap-2">
      <Share2 className="w-4 h-4 text-foreground/40" />
      {shareTargets.map((target) => (
        <a
          key={target.name}
          href={target.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`px-2.5 py-1.5 text-caption font-medium text-foreground/50 border border-border rounded-badge ${target.color} hover:border-foreground/20 transition-all`}
        >
          {target.name}
        </a>
      ))}
      <button
        type="button"
        onClick={copyLink}
        className="px-2.5 py-1.5 text-caption font-medium text-foreground/50 border border-border rounded-badge hover:text-primary hover:border-primary/30 transition-all flex items-center gap-1"
      >
        <LinkIcon className="w-3 h-3" />
        {copied ? "복사됨" : "링크"}
      </button>
    </div>
  );
}
