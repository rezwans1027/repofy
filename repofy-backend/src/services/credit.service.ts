import { getSupabaseAdmin } from "../config/supabase";
import { throwIfDbError } from "../lib/errors";

/** @see shared/types/credit.ts for the shared API contract type */
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

  throwIfDbError(error, "fetch credit balance");

  return data ?? { growth_balance: 0, eval_balance: 0 };
}

export async function grantGrowthCredits(
  userId: string,
  amount: number,
  stripePaymentIntentId: string,
  metadata?: Record<string, unknown>,
): Promise<boolean> {
  if (amount <= 0 || !Number.isInteger(amount)) {
    throw new Error("Invalid credit amount");
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("grant_growth_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_stripe_payment_intent_id: stripePaymentIntentId,
    p_metadata: metadata ?? null,
  });

  throwIfDbError(error, "grant growth credits");

  return data === true;
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

  throwIfDbError(error, "deduct growth credit");

  return data === true;
}

export async function refundGrowthCredit(
  userId: string,
  requestId: string,
  metadata?: Record<string, unknown>,
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("refund_growth_credit", {
    p_user_id: userId,
    p_request_id: requestId,
    p_metadata: metadata ?? null,
  });

  throwIfDbError(error, "refund growth credit");

  return data === true;
}

export interface CreditTransaction {
  id: string;
  credit_type: string;
  amount: number;
  source: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface TransactionHistoryResult {
  transactions: CreditTransaction[];
  total: number;
}

export async function getTransactionHistory(
  userId: string,
  limit: number,
  offset: number,
): Promise<TransactionHistoryResult> {
  const supabase = getSupabaseAdmin();

  // Get total count
  const { count, error: countError } = await supabase
    .from("credit_transactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  throwIfDbError(countError, "count credit transactions");

  // Get paginated rows
  const { data, error } = await supabase
    .from("credit_transactions")
    .select("id, credit_type, amount, source, description, metadata, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  throwIfDbError(error, "fetch credit transactions");

  return {
    transactions: data ?? [],
    total: count ?? 0,
  };
}

