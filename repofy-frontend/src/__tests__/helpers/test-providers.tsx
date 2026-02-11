import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function TestProviders({ children }: { children: React.ReactNode }) {
  const qc = createTestQueryClient();
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
