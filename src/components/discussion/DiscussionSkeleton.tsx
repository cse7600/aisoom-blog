import { Skeleton } from "@/components/ui/Skeleton";

export function DiscussionSkeleton() {
  return (
    <section className="discussion-section" aria-busy="true">
      <header className="discussion-section-header">
        <Skeleton className="h-5 w-24" />
      </header>
      <div className="space-y-6 mt-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={`discussion-skeleton-${index}`} className="discussion-thread">
            <div className="flex items-center gap-2 mb-3">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-5/6 mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </section>
  );
}
