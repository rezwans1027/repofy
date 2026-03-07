"use client";

import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
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
        <button
          onClick={reset}
          className="mt-4 font-mono text-xs text-cyan hover:underline"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
