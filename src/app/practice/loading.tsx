import { Skeleton, TextSkeleton } from "@/components/Skeleton";

export default function PracticeLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <Skeleton className="h-2.5 w-20" />
      <Skeleton className="mt-4 h-8 w-72" />
      <div className="mt-3 max-w-xl">
        <TextSkeleton lines={2} />
      </div>

      <div className="mt-10 rounded border border-card-border bg-card p-6">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-4 h-6 w-2/3" />
        <div className="mt-3 max-w-2xl">
          <TextSkeleton lines={2} />
        </div>
        <Skeleton className="mt-6 h-10 w-32" />
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded border border-card-border bg-card p-5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="mt-4 h-1 w-full" />
            <Skeleton className="mt-3 h-2.5 w-40" />
          </div>
        ))}
      </div>

      <p className="sr-only" role="status">
        Loading challenges
      </p>
    </div>
  );
}
