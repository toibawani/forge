import { Skeleton, TextSkeleton } from "@/components/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <Skeleton className="h-2.5 w-24" />
      <Skeleton className="mt-4 h-8 w-56" />
      <Skeleton className="mt-2 h-3 w-40" />

      <div className="mt-8 rounded border border-card-border bg-card p-6">
        <Skeleton className="h-3 w-20" />
        <div className="mt-4">
          <TextSkeleton lines={2} />
        </div>
      </div>

      <div className="mt-6 grid gap-px overflow-hidden rounded border border-card-border bg-card-border sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="bg-card p-5">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="mt-3 h-7 w-12" />
            <Skeleton className="mt-2 h-2.5 w-24" />
          </div>
        ))}
      </div>

      <div className="mt-6 rounded border border-card-border bg-card p-6">
        <Skeleton className="h-3 w-28" />
        <div className="mt-5 flex items-end gap-1.5">
          {Array.from({ length: 14 }).map((_, index) => (
            <Skeleton key={index} className="h-14 flex-1" />
          ))}
        </div>
      </div>

      <p className="sr-only" role="status">
        Loading your practice record
      </p>
    </div>
  );
}
