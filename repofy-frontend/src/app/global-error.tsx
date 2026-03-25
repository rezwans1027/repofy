"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { ErrorBoundaryContent } from "@/components/ui/error-boundary-content";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-[#0A0A0B] text-white">
        <ErrorBoundaryContent error={error} reset={reset} />
      </body>
    </html>
  );
}
