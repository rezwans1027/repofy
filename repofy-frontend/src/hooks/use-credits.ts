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
