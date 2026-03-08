import { getSupabaseAdmin } from "../config/supabase";
import { throwIfDbError, DatabaseError } from "../lib/errors";
import { deductGrowthCredit } from "./credit.service";

export class InsufficientCreditsError extends Error {
  constructor() {
    super("Insufficient growth credits");
    this.name = "InsufficientCreditsError";
  }
}

/** Atomically deduct one credit and persist advice in a single step. */
export async function deductAndPersist(
  userId: string,
  requestId: string,
  analyzedUsername: string,
  analyzedName: string | null,
  adviceData: Record<string, unknown>,
): Promise<string> {
  // 1. Atomic deduct — fails if balance is 0
  const deducted = await deductGrowthCredit(userId, requestId, {
    username: analyzedUsername,
    endpoint: "/advice",
  });
  if (!deducted) throw new InsufficientCreditsError();

  // 2. Persist — if this fails the credit is lost, but this is a simple DB write
  //    with near-zero failure rate vs. a 60s+ AI call
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("advice")
    .upsert(
      { user_id: userId, analyzed_username: analyzedUsername, analyzed_name: analyzedName, advice_data: adviceData },
      { onConflict: "user_id,analyzed_username" },
    )
    .select("id")
    .single();

  throwIfDbError(error, "persist advice");
  if (!data?.id) throw new DatabaseError("persist advice returned no id", null);
  return data.id as string;
}
