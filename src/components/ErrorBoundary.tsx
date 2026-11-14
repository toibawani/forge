"use client";

import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[var(--background)] flex items-center justify-center px-6">
          <div className="max-w-md w-full text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Something went wrong
            </h1>
            <p className="mt-4 text-[var(--muted-foreground)]">
              An unexpected error occurred. Please refresh the page or try again later.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex items-center justify-center rounded-[var(--radius)] bg-[var(--primary)] px-6 py-2.5 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
            >
              Refresh page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
