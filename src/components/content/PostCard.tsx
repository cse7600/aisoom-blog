import Image from "next/image";
import Link from "next/link";
import { Clock, Eye } from "lucide-react";
import { formatRelativeDate, formatNumber } from "@/lib/utils";
import type { PostRow } from "@/lib/db";
import { PostThumbnailFallback } from "./PostThumbnailFallback";

interface PostCardProps {
  post: PostRow;
  categoryName?: string;
  priority?: boolean;
}

export function PostCard({ post, categoryName, priority = false }: PostCardProps) {
  const postUrl = `/${post.category}/${post.slug}`;
  const label = categoryName ?? post.category;

  return (
    <article className="group bg-surface-1 border border-border rounded-card overflow-hidden shadow-card-sm hover:shadow-card-md transition-all duration-200">
      <Link href={postUrl} className="block relative aspect-[16/9] overflow-hidden bg-surface-3">
        {post.image_url ? (
          <>
            <Image
              src={post.image_url}
              alt={post.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
              priority={priority}
            />
            <span className="absolute top-3 left-3 px-2 py-1 text-caption font-medium bg-primary text-white rounded-badge">
              {label}
            </span>
          </>
        ) : (
          <PostThumbnailFallback
            categorySlug={post.category}
            categoryName={label}
            title={post.title}
            tags={post.tags}
            keywords={post.keywords}
            readTime={post.read_time}
            variant="card"
          />
        )}
      </Link>

      <div className="p-4">
        <Link href={postUrl}>
          <h3 className="text-heading-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors mb-2">
            {post.title}
          </h3>
        </Link>

        {post.description && (
          <p className="text-body-sm text-foreground/50 line-clamp-2 mb-3">
            {post.description}
          </p>
        )}

        <div className="flex items-center gap-3 text-caption text-foreground/40">
          <span>{formatRelativeDate(post.published_at ?? post.created_at)}</span>
          {post.read_time && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {post.read_time}분
            </span>
          )}
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {formatNumber(post.view_count)}
          </span>
        </div>
      </div>
    </article>
  );
}
