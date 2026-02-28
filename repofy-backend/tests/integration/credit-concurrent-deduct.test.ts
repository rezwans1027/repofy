import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";

vi.mock("../../src/config/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));

import { getSupabaseAdmin } from "../../src/config/supabase";
import { deductGrowthCredit } from "../../src/services/credit.service";
import {
  createCreditTestDb,
  createTestProfile,
  getTransactionCount,
  getWalletBalance,
} from "../helpers/pglite-db";

const mockGetSupabaseAdmin = getSupabaseAdmin as ReturnType<typeof vi.fn>;
const USER_ID = "11111111-1111-1111-1111-111111111111";

let db: PGlite;

beforeAll(async () => {
  db = await createCreditTestDb();
  await createTestProfile(db, USER_ID);
}, 30_000);

afterAll(async () => {
  await db.close();
});

type DeductRpcArgs = {
  p_user_id: string;
  p_request_id: string;
  p_metadata: Record<string, unknown> | null;
};

describe("concurrent credit deduction (integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(async () => {
    await db.exec("DELETE FROM credit_transactions");
    await db.exec("DELETE FROM credit_wallets");

    mockGetSupabaseAdmin.mockReturnValue({
      rpc: vi.fn(async (fnName: string, args: DeductRpcArgs) => {
        if (fnName !== "deduct_growth_credit") {
          throw new Error(`Unexpected RPC in deduct integration test: ${fnName}`);
        }

        const result = await db.query<{ deduct_growth_credit: boolean }>(
          "SELECT deduct_growth_credit($1, $2, $3::jsonb)",
          [
            args.p_user_id,
            args.p_request_id,
            args.p_metadata ? JSON.stringify(args.p_metadata) : null,
          ],
        );

        return { data: result.rows[0].deduct_growth_credit, error: null };
      }),
    });
  });

  it("with 1 remaining credit, only one of two concurrent deducts succeeds", async () => {
    await db.query(
      "INSERT INTO credit_wallets (user_id, growth_balance, eval_balance) VALUES ($1, 1, 0)",
      [USER_ID],
    );

    // Two concurrent deductions with different request IDs
    const [result1, result2] = await Promise.all([
      deductGrowthCredit(USER_ID, "req-aaa"),
      deductGrowthCredit(USER_ID, "req-bbb"),
    ]);

    // Exactly one succeeds
    const results = [result1, result2];
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.filter((r) => !r)).toHaveLength(1);

    expect(await getWalletBalance(db, USER_ID)).toBe(0);
    expect(await getTransactionCount(db, USER_ID, "usage")).toBe(1);
  });
});
