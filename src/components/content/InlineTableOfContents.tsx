"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface TocHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

interface InlineTableOfContentsProps {
  contentHtml: string;
}

/**
 * 모바일/태블릿 환경에서 표시되는 인라인 목차.
 * 접기/펼치기 가능.
 */
export function InlineTableOfContents({ contentHtml }: InlineTableOfContentsProps) {
  const [headings, setHeadings] = useState<TocHeading[]>([]);
  const [expanded, setExpanded] = useState(false);

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

  if (headings.length < 2) return null;

  const h2Only = headings.filter((h) => h.level === 2);
  const displayHeadings = expanded ? headings : h2Only.slice(0, 5);

  return (
    <nav
      aria-label="목차"
      className="xl:hidden mb-8 p-4 bg-surface-3 rounded-card border border-border"
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center justify-between w-full text-body-sm font-semibold text-foreground"
      >
        <span>목차</span>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-foreground/40" />
        ) : (
          <ChevronDown className="w-4 h-4 text-foreground/40" />
        )}
      </button>

      <ol className="mt-3 space-y-1.5">
        {displayHeadings.map(({ id, text, level }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className={`block text-body-sm text-foreground/55 hover:text-primary transition-colors ${
                level === 3 ? "pl-4" : ""
              }`}
              onClick={() => setExpanded(false)}
            >
              {text}
            </a>
          </li>
        ))}
      </ol>

      {!expanded && headings.length > 5 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 text-caption text-primary hover:underline"
        >
          전체 보기 ({headings.length}개 섹션)
        </button>
      )}
    </nav>
  );
}
