import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategoryBySlug, getPostsByCategory, getCategories } from "@/lib/db";
import { PostCard } from "@/components/content/PostCard";
import { Breadcrumb } from "@/components/seo/Breadcrumb";
import { generateCategoryMetadata } from "@/lib/seo";

interface CategoryPageProps {
  params: { category: string };
}

export const revalidate = 60;

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const cat = await getCategoryBySlug(params.category);
  if (!cat) return {};
  return generateCategoryMetadata(cat.name, cat.description ?? "", cat.slug);
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const [cat, posts] = await Promise.all([
    getCategoryBySlug(params.category),
    getPostsByCategory(params.category, 20),
  ]);

  if (!cat) notFound();

  return (
    <div className="mx-auto max-w-content px-4 sm:px-6 py-8">
      <Breadcrumb items={[{ name: cat.name, url: `/${cat.slug}` }]} />

      <div className="mb-8">
        <h1 className="text-display-sm md:text-display-md font-bold text-foreground mb-2">
          {cat.name}
        </h1>
        {cat.description && (
          <p className="text-body-lg text-foreground/50">{cat.description}</p>
        )}
      </div>

      {posts.length === 0 ? (
        <p className="text-body-md text-foreground/40 py-16 text-center">
          곧 찐 비교, 찐 추천이 시작됩니다.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {posts.map((post, i) => (
            <PostCard
              key={post.id}
              post={post}
              categoryName={cat.name}
              priority={i < 3}
            />
          ))}
        </div>
      )}
    </div>
  );
}
