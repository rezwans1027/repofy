"use client";

interface ErrorBoundaryContentProps {
  error: Error & { digest?: string };
  reset: () => void;
  actions?: React.ReactNode;
  wrapperClassName?: string;
}

export function ErrorBoundaryContent({
  error,
  reset,
  actions,
  wrapperClassName = "flex min-h-screen items-center justify-center px-4",
}: ErrorBoundaryContentProps) {
  return (
    <div className={wrapperClassName}>
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6 text-center max-w-md">
        <p className="font-mono text-sm text-red-400">
          Something went wrong
        </p>
        <p className="mt-2 text-xs text-muted-foreground/70">
          An unexpected error occurred. Please try again.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-[10px] text-muted-foreground/50">
            Error ID: {error.digest}
          </p>
        )}
        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            onClick={reset}
            className="font-mono text-xs text-cyan hover:underline"
          >
            Try again
          </button>
          {actions}
        </div>
      </div>
    </div>
  );
}
