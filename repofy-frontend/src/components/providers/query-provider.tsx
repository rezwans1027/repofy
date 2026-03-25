"use client";

import { lazy, Suspense, useEffect, useRef } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient, resetQueryClient } from "@/lib/query-client";
import { useAuth } from "@/components/providers/auth-provider";

const ReactQueryDevtools = lazy(() =>
  import("@tanstack/react-query-devtools").then((m) => ({
    default: m.ReactQueryDevtools,
  })),
);

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const { user, isLoading } = useAuth();
  const initializedRef = useRef(false);
  const prevUserId = useRef(user?.id);

  // Clear the entire query cache when the user changes (sign-out, switch account).
  // Skip the initial auth resolution so in-flight queries aren't destroyed on reload.
  useEffect(() => {
    if (isLoading) return;

    if (!initializedRef.current) {
      initializedRef.current = true;
      prevUserId.current = user?.id;
      return;
    }

    if (prevUserId.current !== user?.id) {
      resetQueryClient();
      prevUserId.current = user?.id;
    }
  }, [user?.id, isLoading]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} />
        </Suspense>
      )}
    </QueryClientProvider>
  );
}
