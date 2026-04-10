"use client";

import Image from "next/image";
import { ExternalLink, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductSpec {
  label: string;
  value: string | boolean;
}

interface ComparisonProduct {
  name: string;
  imageUrl: string;
  price: number;
  discountPrice?: number;
  affiliateUrl: string;
  specs: ProductSpec[];
  isPick?: boolean;
}

interface ProductComparisonTableProps {
  products: ComparisonProduct[];
  title?: string;
}

export function ProductComparisonTable({
  products,
  title = "제품 비교",
}: ProductComparisonTableProps) {
  if (products.length === 0) return null;

  const firstProduct = products[0];
  const specLabels = firstProduct ? firstProduct.specs.map((s) => s.label) : [];

  return (
    <div className="my-8 overflow-x-auto scrollbar-thin">
      <h3 className="text-heading-md font-bold text-foreground mb-4">
        {title}
      </h3>
      <table className="w-full min-w-[600px] border-collapse">
        <thead>
          <tr>
            <th className="p-3 text-left text-body-sm font-medium text-foreground/50 bg-surface-3 rounded-tl-badge">
              항목
            </th>
            {products.map((product) => (
              <th
                key={product.name}
                className={cn(
                  "p-3 text-center bg-surface-3",
                  product.isPick && "bg-primary-light"
                )}
              >
                <div className="flex flex-col items-center gap-2">
                  {product.isPick && (
                    <span className="px-2 py-0.5 text-caption font-bold bg-primary text-white rounded-badge">
                      PICK
                    </span>
                  )}
                  <div className="relative w-16 h-16">
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      fill
                      className="object-contain"
                    />
                  </div>
                  <span className="text-body-sm font-semibold text-foreground">
                    {product.name}
                  </span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border">
            <td className="p-3 text-body-sm font-medium text-foreground/70">
              가격
            </td>
            {products.map((product) => (
              <td
                key={product.name}
                className={cn(
                  "p-3 text-center",
                  product.isPick && "bg-primary-light/30"
                )}
              >
                {product.discountPrice ? (
                  <div>
                    <span className="text-caption text-foreground/40 line-through block">
                      {product.price.toLocaleString("ko-KR")}원
                    </span>
                    <span className="text-body-md font-bold text-primary">
                      {product.discountPrice.toLocaleString("ko-KR")}원
                    </span>
                  </div>
                ) : (
                  <span className="text-body-md font-bold text-foreground">
                    {product.price.toLocaleString("ko-KR")}원
                  </span>
                )}
              </td>
            ))}
          </tr>
          {specLabels.map((label) => (
            <tr key={label} className="border-b border-border">
              <td className="p-3 text-body-sm font-medium text-foreground/70">
                {label}
              </td>
              {products.map((product) => {
                const spec = product.specs.find((s) => s.label === label);
                const specValue = spec?.value;
                return (
                  <td
                    key={product.name}
                    className={cn(
                      "p-3 text-center text-body-sm",
                      product.isPick && "bg-primary-light/30"
                    )}
                  >
                    {typeof specValue === "boolean" ? (
                      specValue ? (
                        <Check className="w-4 h-4 text-secondary mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-foreground/30 mx-auto" />
                      )
                    ) : (
                      <span className="text-foreground/70">{specValue ?? "-"}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr>
            <td className="p-3" />
            {products.map((product) => (
              <td key={product.name} className="p-3 text-center">
                <a
                  href={product.affiliateUrl}
                  target="_blank"
                  rel="nofollow noopener noreferrer sponsored"
                  className={cn(
                    "inline-flex items-center gap-1.5 px-4 py-2 text-body-sm font-medium rounded-button transition-all",
                    product.isPick
                      ? "bg-primary text-white hover:bg-primary-hover"
                      : "border border-border text-foreground hover:border-primary hover:text-primary"
                  )}
                >
                  구매하기
                  <ExternalLink className="w-3 h-3" />
                </a>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
