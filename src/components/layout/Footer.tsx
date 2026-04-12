import Link from "next/link";
import { SITE_CONFIG, CATEGORIES } from "@/lib/constants";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-surface-1 border-t border-border mt-16">
      <div className="mx-auto max-w-content px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-block mb-3">
              <span className="text-heading-md font-bold text-primary">
                {SITE_CONFIG.name}
              </span>
            </Link>
            <p className="text-body-sm text-foreground/50 max-w-xs">
              {SITE_CONFIG.description}
            </p>
          </div>

          <div>
            <h3 className="text-body-md font-semibold text-foreground mb-3">
              카테고리
            </h3>
            <ul className="space-y-1">
              {CATEGORIES.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={category.path}
                    className="inline-block py-1.5 text-body-sm text-foreground/50 hover:text-primary transition-colors min-h-[44px] leading-[44px]"
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-body-md font-semibold text-foreground mb-3">
              안내
            </h3>
            <ul className="space-y-1">
              <li>
                <Link
                  href="/about"
                  className="inline-block py-1.5 text-body-sm text-foreground/50 hover:text-primary transition-colors min-h-[44px] leading-[44px]"
                >
                  소개
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="inline-block py-1.5 text-body-sm text-foreground/50 hover:text-primary transition-colors min-h-[44px] leading-[44px]"
                >
                  개인정보처리방침
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="inline-block py-1.5 text-body-sm text-foreground/50 hover:text-primary transition-colors min-h-[44px] leading-[44px]"
                >
                  이용약관
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="inline-block py-1.5 text-body-sm text-foreground/50 hover:text-primary transition-colors min-h-[44px] leading-[44px]"
                >
                  문의
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-body-md font-semibold text-foreground mb-3">
              공지
            </h3>
            <p className="text-body-sm text-foreground/50">
              이 사이트는 어필리에이트 링크를 포함하고 있으며, 구매 시 소정의
              수수료를 받을 수 있습니다. 이는 콘텐츠 제작에 도움이 됩니다.
            </p>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8 text-center">
          <p className="text-caption text-foreground/30">
            {currentYear} {SITE_CONFIG.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
