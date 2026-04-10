import Link from "next/link";
import Image from "next/image";
import { Clock, Eye } from "lucide-react";
import { formatRelativeDate, formatNumber } from "@/lib/utils";
import type { PostRow } from "@/lib/db";

interface RelatedPostsSectionProps {
  posts: PostRow[];
  categoryName?: string;
}

/**
 * "함께 읽으면 좋은 글" 섹션.
 * 카드 레이아웃 + 호버 효과.
 */
export function RelatedPostsSection({ posts, categoryName }: RelatedPostsSectionProps) {
  if (posts.length === 0) return null;

  return (
    <section className="mt-16 pt-10 border-t border-border">
      <h2 className="text-heading-lg font-bold text-foreground mb-2">
        함께 읽으면 좋은 글
      </h2>
      <p className="text-body-sm text-foreground/40 mb-6">
        이 글과 관련된 다른 콘텐츠
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {posts.map((post) => {
          const postUrl = `/${post.category}/${post.slug}`;
          const label = categoryName ?? post.category;

          return (
            <article
              key={post.id}
              className="group bg-surface-1 border border-border rounded-card overflow-hidden shadow-card-sm hover:shadow-card-md transition-all duration-200"
            >
              <Link
                href={postUrl}
                className="block relative aspect-[16/9] overflow-hidden bg-surface-3"
              >
                {post.image_url ? (
                  <Image
                    src={post.image_url}
                    alt={post.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-foreground/20 text-body-sm">
                      {label}
                    </span>
                  </div>
                )}
                <span className="absolute top-3 left-3 px-2 py-1 text-caption font-medium bg-primary text-white rounded-badge">
                  {label}
                </span>
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
                  <span>
                    {formatRelativeDate(post.published_at ?? post.created_at)}
                  </span>
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
        })}
      </div>
    </section>
  );
}
