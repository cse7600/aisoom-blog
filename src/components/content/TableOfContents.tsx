"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { TableOfContentsItem } from "@/types/content";

interface TableOfContentsProps {
  items: TableOfContentsItem[];
}

export function TableOfContents({ items }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const headingIds = items.map((tocItem) => tocItem.id);
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries.find((entry) => entry.isIntersecting);
        if (visibleEntry) {
          setActiveId(visibleEntry.target.id);
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0.1 }
    );

    headingIds.forEach((headingId) => {
      const element = document.getElementById(headingId);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="목차"
      className="p-4 bg-surface-3 rounded-card border border-border"
    >
      <h4 className="text-body-md font-semibold text-foreground mb-3">
        목차
      </h4>
      <ol className="space-y-1.5">
        {items.map((tocItem) => (
          <li key={tocItem.id}>
            <a
              href={`#${tocItem.id}`}
              className={cn(
                "block text-body-sm transition-colors hover:text-primary",
                tocItem.level === 3 && "pl-4",
                activeId === tocItem.id
                  ? "text-primary font-medium"
                  : "text-foreground/50"
              )}
            >
              {tocItem.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
