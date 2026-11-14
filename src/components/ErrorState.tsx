interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  actionLabel?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message = "An error occurred while loading this content. Please try again.",
  onRetry,
  actionLabel = "Try again",
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="w-12 h-12 rounded-full bg-[var(--destructive)] bg-opacity-10 flex items-center justify-center mb-4">
        <svg
          className="w-6 h-6 text-[var(--destructive)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-[var(--foreground)]">{title}</h3>
      <p className="mt-2 text-sm text-[var(--muted-foreground)] max-w-sm">
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center justify-center rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  title?: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  title = "No data found",
  message = "There is nothing to display here yet.",
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="w-12 h-12 rounded-full bg-[var(--muted)] bg-opacity-10 flex items-center justify-center mb-4">
        <svg
          className="w-6 h-6 text-[var(--muted)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-[var(--foreground)]">{title}</h3>
      <p className="mt-2 text-sm text-[var(--muted-foreground)] max-w-sm">
        {message}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 inline-flex items-center justify-center rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
