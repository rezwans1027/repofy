import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/providers/auth-provider";
import { api } from "@/lib/api-client";

export interface CreditBalance {
  growth_balance: number;
  eval_balance: number;
}

export function useCreditBalance() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["credits", "balance"],
    queryFn: () =>
      api.get<CreditBalance>("/credits/balance", { auth: true }),
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
    queryFn: () =>
      api.get<CreditBalance>("/credits/balance", { auth: true }),
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
