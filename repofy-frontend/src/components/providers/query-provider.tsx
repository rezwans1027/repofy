"use client";

import { useEffect, useRef } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { getQueryClient, resetQueryClient } from "@/lib/query-client";
import { useAuth } from "@/components/providers/auth-provider";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const { user } = useAuth();
  const prevUserId = useRef(user?.id);

  // Clear the entire query cache when the user changes (sign-out, switch account)
  useEffect(() => {
    if (prevUserId.current !== user?.id) {
      resetQueryClient();
      prevUserId.current = user?.id;
    }
  }, [user?.id]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
