"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { List } from "lucide-react";

interface TocHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

interface ArticleTableOfContentsProps {
  contentHtml: string;
}

/**
 * HTML 콘텐츠에서 h2/h3 heading을 파싱하여 TOC를 생성.
 * Sticky sidebar로 표시하며 현재 읽고 있는 섹션을 하이라이트.
 */
export function ArticleTableOfContents({ contentHtml }: ArticleTableOfContentsProps) {
  const [headings, setHeadings] = useState<TocHeading[]>([]);
  const [activeId, setActiveId] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // HTML에서 heading 파싱
  useEffect(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(contentHtml, "text/html");
    const elements = doc.querySelectorAll("h2[id], h3[id]");
    const parsed: TocHeading[] = [];

    elements.forEach((el) => {
      const level = el.tagName === "H2" ? 2 : 3;
      const id = el.getAttribute("id") ?? "";
      const text = el.textContent ?? "";
      if (id && text) {
        parsed.push({ id, text, level });
      }
    });

    setHeadings(parsed);
  }, [contentHtml]);

  // Intersection observer로 현재 활성 heading 추적
  const observeHeadings = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) {
          setActiveId(visible.target.id);
        }
      },
      { rootMargin: "-80px 0px -65% 0px", threshold: 0.1 }
    );

    headings.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [headings]);

  useEffect(() => {
    const cleanup = observeHeadings();
    return cleanup;
  }, [observeHeadings]);

  if (headings.length < 2) return null;

  return (
    <nav
      aria-label="목차"
      className="hidden xl:block w-56 shrink-0"
    >
      <div className="sticky top-24">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="flex items-center gap-2 text-body-sm font-semibold text-foreground mb-3 hover:text-primary transition-colors"
        >
          <List className="w-4 h-4" />
          목차
        </button>

        {!collapsed && (
          <ol className="space-y-1 border-l-2 border-border pl-3">
            {headings.map(({ id, text, level }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className={cn(
                    "block text-caption leading-relaxed transition-colors hover:text-primary",
                    level === 3 && "pl-3",
                    activeId === id
                      ? "text-primary font-medium border-l-2 border-primary -ml-[calc(0.75rem+2px)] pl-[calc(0.75rem-0px)]"
                      : "text-foreground/45"
                  )}
                >
                  {text}
                </a>
              </li>
            ))}
          </ol>
        )}
      </div>
    </nav>
  );
}
