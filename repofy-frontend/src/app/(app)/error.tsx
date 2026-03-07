"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
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
          <span className="text-muted-foreground/30">|</span>
          <Link
            href="/dashboard"
            className="font-mono text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
