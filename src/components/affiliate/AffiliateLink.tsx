"use client";

import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AffiliateLink as AffiliateLinkType } from "@/types/content";

interface AffiliateLinkProps {
  link: AffiliateLinkType;
  variant?: "inline" | "button" | "card";
}

function trackAffiliateClick(linkId: string, platform: string) {
  if (typeof window === "undefined") return;

  fetch("/api/track-click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ linkId, platform }),
  }).catch(() => {
    /* 트래킹 실패는 무시 - UX 차단하지 않음 */
  });
}

export function AffiliateLink({
  link,
  variant = "button",
}: AffiliateLinkProps) {
  const handleClick = () => {
    trackAffiliateClick(link.id, link.platform);
  };

  if (variant === "inline") {
    return (
      <a
        href={link.url}
        target="_blank"
        rel="nofollow noopener noreferrer sponsored"
        onClick={handleClick}
        className="text-primary hover:text-primary-hover underline underline-offset-2 inline-flex items-center gap-1"
      >
        {link.label}
        <ExternalLink className="w-3 h-3" />
      </a>
    );
  }

  if (variant === "card") {
    return (
      <a
        href={link.url}
        target="_blank"
        rel="nofollow noopener noreferrer sponsored"
        onClick={handleClick}
        className="block p-4 bg-surface-1 border border-border rounded-card hover:border-primary/30 hover:shadow-card-md transition-all group"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-body-md font-medium text-foreground group-hover:text-primary transition-colors">
              {link.productName}
            </p>
            {link.discountPrice ? (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-body-sm text-foreground/40 line-through">
                  {link.price?.toLocaleString("ko-KR")}원
                </span>
                <span className="text-body-md font-bold text-primary">
                  {link.discountPrice.toLocaleString("ko-KR")}원
                </span>
              </div>
            ) : link.price ? (
              <p className="text-body-md font-bold text-foreground mt-1">
                {link.price.toLocaleString("ko-KR")}원
              </p>
            ) : null}
          </div>
          <span
            className={cn(
              "shrink-0 px-4 py-2 text-body-sm font-medium rounded-button transition-all",
              "bg-primary text-white hover:bg-primary-hover"
            )}
          >
            최저가 확인
          </span>
        </div>
      </a>
    );
  }

  return (
    <a
      href={link.url}
      target="_blank"
      rel="nofollow noopener noreferrer sponsored"
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-2 px-5 py-2.5 font-medium rounded-button transition-all",
        "bg-primary text-white hover:bg-primary-hover shadow-card-sm hover:shadow-card-md"
      )}
    >
      {link.label}
      <ExternalLink className="w-4 h-4" />
    </a>
  );
}
