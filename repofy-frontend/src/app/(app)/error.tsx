"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ErrorBoundaryContent } from "@/components/ui/error-boundary-content";

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
    <ErrorBoundaryContent
      error={error}
      reset={reset}
      wrapperClassName="flex min-h-[40vh] items-center justify-center"
      actions={
        <>
          <span className="text-muted-foreground/30">|</span>
          <Link
            href="/dashboard"
            className="font-mono text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Go to dashboard
          </Link>
        </>
      }
    />
  );
}
