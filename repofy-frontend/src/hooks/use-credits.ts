import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useAuth } from "@/components/providers/auth-provider";
import { api } from "@/lib/api-client";

const creditBalanceSchema = z.object({
  growth_balance: z.number(),
  eval_balance: z.number(),
});

export type CreditBalance = z.infer<typeof creditBalanceSchema>;

export function useCreditBalance() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["credits", "balance"],
    queryFn: ({ signal }) =>
      api.get<CreditBalance>("/credits/balance", { signal, schema: creditBalanceSchema }),
    enabled: !!user,
  });
}

/**
 * Poll credit balance until it changes from the initial value.
 * Used after checkout to wait for webhook processing.
 */
export function useAwaitCreditUpdate(
  enabled: boolean,
  initialBalance: number | undefined,
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["credits", "balance", "poll"],
    queryFn: ({ signal }) =>
      api.get<CreditBalance>("/credits/balance", { signal, schema: creditBalanceSchema }),
    enabled: enabled && !!user && initialBalance !== undefined,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Stop polling once balance increases
      if (data && data.growth_balance > (initialBalance ?? 0)) return false;
      return 2000; // poll every 2s
    },
    refetchIntervalInBackground: true,
  });
}
