"use client";

import { useEffect, useRef } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { getQueryClient, resetQueryClient } from "@/lib/query-client";
import { useAuth } from "@/components/providers/auth-provider";

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
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
