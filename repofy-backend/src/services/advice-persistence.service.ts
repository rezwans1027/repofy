import { getSupabaseAdmin } from "../config/supabase";
import { throwIfDbError, DatabaseError } from "../lib/errors";
import { deductGrowthCredit, refundGrowthCredit } from "./credit.service";
import { createCrudService } from "./crud.service";
import type { AdviceData } from "../types/shared/advice";

export class InsufficientCreditsError extends Error {
  constructor() {
    super("Insufficient growth credits");
    this.name = "InsufficientCreditsError";
  }
}

const crud = createCrudService({
  table: "advice",
  entityName: "advice",
  listSelect: "id, analyzed_username, analyzed_name, generated_at",
  detailSelect: "id, analyzed_username, advice_data",
  existsColumn: "analyzed_username",
});

export const listAdvice = crud.list;
export const getAdviceById = crud.getById;
export const adviceExists = crud.exists;
export const deleteAdvice = crud.deleteBatch;

/** Atomically deduct one credit and persist advice in a single step. */
export async function deductAndPersist(
  userId: string,
  requestId: string,
  analyzedUsername: string,
  analyzedName: string | null,
  adviceData: AdviceData,
): Promise<string> {
  // 1. Atomic deduct — fails if balance is 0
  const deducted = await deductGrowthCredit(userId, requestId, {
    username: analyzedUsername,
    endpoint: "/advice",
  });
  if (!deducted) throw new InsufficientCreditsError();

  // 2. Persist — if this fails, refund the credit (compensating transaction)
  const supabase = getSupabaseAdmin();
  try {
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
  } catch (err) {
    await refundGrowthCredit(userId, requestId, {
      reason: "persist_failed",
      username: analyzedUsername,
    });
    throw err;
  }
}
