import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { JsonLd } from "./JsonLd";
import { buildBreadcrumbJsonLd } from "@/lib/seo";

interface BreadcrumbItem {
  name: string;
  url?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  const jsonLd = buildBreadcrumbJsonLd([{ name: "홈", url: "/" }, ...items]);

  return (
    <>
      <JsonLd structuredData={jsonLd} />
      <nav aria-label="경로" className="mb-6">
        <ol className="flex items-center gap-1 text-body-sm text-foreground/50 flex-wrap">
          <li>
            <Link
              href="/"
              className="hover:text-primary transition-colors"
            >
              홈
            </Link>
          </li>
          {items.map((breadcrumbItem, index) => (
            <li key={breadcrumbItem.name} className="flex items-center gap-1">
              <ChevronRight className="w-3.5 h-3.5" />
              {index === items.length - 1 || !breadcrumbItem.url ? (
                <span className="text-foreground/70 font-medium">
                  {breadcrumbItem.name}
                </span>
              ) : (
                <Link
                  href={breadcrumbItem.url}
                  className="hover:text-primary transition-colors"
                >
                  {breadcrumbItem.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
