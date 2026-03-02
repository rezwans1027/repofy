import { getSupabaseAdmin } from "../config/supabase";

export interface CreditBalance {
  growth_balance: number;
  eval_balance: number;
}

export async function getCreditBalance(userId: string): Promise<CreditBalance> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("credit_wallets")
    .select("growth_balance, eval_balance")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return data ?? { growth_balance: 0, eval_balance: 0 };
}

export async function grantGrowthCredits(
  userId: string,
  amount: number,
  stripePaymentIntentId: string,
  metadata?: Record<string, unknown>,
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("grant_growth_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_stripe_payment_intent_id: stripePaymentIntentId,
    p_metadata: metadata ?? null,
  });

  if (error) throw error;

  return data as boolean;
}

export async function deductGrowthCredit(
  userId: string,
  requestId: string,
  metadata?: Record<string, unknown>,
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("deduct_growth_credit", {
    p_user_id: userId,
    p_request_id: requestId,
    p_metadata: metadata ?? null,
  });

  if (error) throw error;

  return data as boolean;
}

