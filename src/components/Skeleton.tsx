/**
 * Loading placeholders, built from the same tokens as the rest of the UI.
 *
 * Deliberately flat and unstyled beyond a pulse: a skeleton that draws a
 * detailed fake page is worse than a plain block, because it promises a layout
 * that may not match what arrives.
 */

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded bg-foreground/[0.07] ${className ?? ""}`}
      {...props}
    />
  );
}

export function TextSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className="h-3.5"
          style={{ width: index === lines - 1 ? "75%" : "100%" }}
        />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded border border-card-border bg-card p-6">
      <Skeleton className="mb-4 h-5 w-1/3" />
      <TextSkeleton lines={2} />
    </div>
  );
}

export function ButtonSkeleton() {
  return <Skeleton className="h-10 w-32" />;
}
