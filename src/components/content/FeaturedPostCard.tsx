import Image from "next/image";
import Link from "next/link";
import { Clock, Eye } from "lucide-react";
import { formatRelativeDate, formatNumber } from "@/lib/utils";
import type { PostRow } from "@/lib/db";

interface FeaturedPostCardProps {
  post: PostRow;
  categoryName?: string;
}

export function FeaturedPostCard({ post, categoryName }: FeaturedPostCardProps) {
  const postUrl = `/${post.category}/${post.slug}`;
  const label = categoryName ?? post.category;

  return (
    <article className="group relative bg-surface-1 border border-border rounded-card overflow-hidden shadow-card-md hover:shadow-card-lg transition-all duration-200">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        <Link
          href={postUrl}
          className="block relative aspect-[16/9] md:aspect-auto overflow-hidden bg-surface-3 min-h-[220px]"
        >
          {post.image_url ? (
            <Image
              src={post.image_url}
              alt={post.title}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
              priority
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-foreground/20 text-body-sm">{label}</span>
            </div>
          )}
        </Link>

        <div className="p-6 md:p-8 flex flex-col justify-center">
          <span className="inline-block w-fit px-2.5 py-1 text-caption font-medium bg-primary text-white rounded-badge mb-4">
            {label}
          </span>

          <Link href={postUrl}>
            <h2 className="text-heading-lg md:text-display-sm font-bold text-foreground line-clamp-3 group-hover:text-primary transition-colors mb-3">
              {post.title}
            </h2>
          </Link>

          {post.description && (
            <p className="text-body-md text-foreground/50 line-clamp-3 mb-4">
              {post.description}
            </p>
          )}

          <div className="flex items-center gap-4 text-body-sm text-foreground/40">
            <span>{formatRelativeDate(post.published_at ?? post.created_at)}</span>
            {post.read_time && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {post.read_time}분 읽기
              </span>
            )}
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              {formatNumber(post.view_count)}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
