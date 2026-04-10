"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Search } from "lucide-react";
import { SITE_CONFIG, CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-surface-1/95 backdrop-blur-sm border-b border-border">
      <div className="mx-auto max-w-content px-4 sm:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="text-heading-md sm:text-heading-lg font-bold text-primary">
              {SITE_CONFIG.name}
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {CATEGORIES.map((category) => (
              <Link
                key={category.slug}
                href={category.path}
                className="px-3 py-2 text-body-md text-foreground/70 hover:text-primary rounded-button hover:bg-primary-light transition-all"
              >
                {category.name}
              </Link>
            ))}
            <Link
              href="/community"
              className="px-3 py-2 text-body-md font-semibold text-primary rounded-button hover:bg-primary-light transition-all"
            >
              소통
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/search"
              className="p-2 text-foreground/60 hover:text-primary rounded-button hover:bg-primary-light transition-all"
              aria-label="검색"
            >
              <Search className="w-5 h-5" />
            </Link>

            <button
              type="button"
              className="md:hidden p-2 text-foreground/60 hover:text-primary rounded-button hover:bg-primary-light transition-all"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "md:hidden border-t border-border overflow-hidden transition-all duration-200",
          mobileMenuOpen ? "max-h-80" : "max-h-0"
        )}
      >
        <nav className="px-4 py-3 space-y-1">
          {CATEGORIES.map((category) => (
            <Link
              key={category.slug}
              href={category.path}
              className="block px-3 py-2.5 text-body-md text-foreground/70 hover:text-primary rounded-button hover:bg-primary-light transition-all"
              onClick={() => setMobileMenuOpen(false)}
            >
              {category.name}
            </Link>
          ))}
          <Link
            href="/community"
            className="block px-3 py-2.5 text-body-md font-semibold text-primary rounded-button hover:bg-primary-light transition-all"
            onClick={() => setMobileMenuOpen(false)}
          >
            소통
          </Link>
        </nav>
      </div>
    </header>
  );
}
