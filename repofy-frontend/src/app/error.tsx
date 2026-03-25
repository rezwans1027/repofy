"use client";

import { useEffect } from "react";
import { ErrorBoundaryContent } from "@/components/ui/error-boundary-content";

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

  return <ErrorBoundaryContent error={error} reset={reset} />;
}
