export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded bg-[var(--card-border)] ${className || ""}`}
      {...props}
    />
  );
}

export function TextSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4"
          style={{ width: i === lines - 1 ? "75%" : "100%" }}
        />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="border border-[var(--card-border)] bg-[var(--card)] rounded-[var(--radius)] p-6">
      <Skeleton className="h-6 w-1/3 mb-4" />
      <TextSkeleton lines={2} />
    </div>
  );
}

export function ButtonSkeleton() {
  return <Skeleton className="h-10 w-32" />;
}
