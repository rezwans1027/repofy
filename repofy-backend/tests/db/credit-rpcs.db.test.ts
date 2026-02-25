import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  createCreditTestDb,
  createTestProfile,
  getWalletBalance,
  getTransactionCount,
} from "../helpers/pglite-db";

const USER_ID = "11111111-1111-1111-1111-111111111111";

let db: PGlite;

beforeAll(async () => {
  db = await createCreditTestDb();
  await createTestProfile(db, USER_ID);
}, 30_000);

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.exec("DELETE FROM credit_transactions");
  await db.exec("DELETE FROM credit_wallets");
});

// ── helpers ──

async function grant(
  userId: string,
  amount: number,
  paymentIntent: string,
  meta: string | null = null,
): Promise<boolean> {
  const r = await db.query<{ grant_growth_credits: boolean }>(
    "SELECT grant_growth_credits($1, $2, $3, $4::jsonb)",
    [userId, amount, paymentIntent, meta],
  );
  return r.rows[0].grant_growth_credits;
}

async function deduct(
  userId: string,
  requestId: string,
  meta: string | null = null,
): Promise<boolean> {
  const r = await db.query<{ deduct_growth_credit: boolean }>(
    "SELECT deduct_growth_credit($1, $2, $3::jsonb)",
    [userId, requestId, meta],
  );
  return r.rows[0].deduct_growth_credit;
}

async function refund(
  userId: string,
  requestId: string,
  meta: string | null = null,
): Promise<boolean> {
  const r = await db.query<{ refund_growth_credit: boolean }>(
    "SELECT refund_growth_credit($1, $2, $3::jsonb)",
    [userId, requestId, meta],
  );
  return r.rows[0].refund_growth_credit;
}

// ── grant_growth_credits ──

describe("grant_growth_credits (real SQL)", () => {
  it("creates wallet and transaction, returns true", async () => {
    expect(await grant(USER_ID, 2, "pi_001")).toBe(true);
    expect(await getWalletBalance(db, USER_ID)).toBe(2);
    expect(await getTransactionCount(db, USER_ID, "purchase")).toBe(1);
  });

  it("returns false on duplicate payment_intent — no double credit", async () => {
    await grant(USER_ID, 2, "pi_dup");
    expect(await grant(USER_ID, 2, "pi_dup")).toBe(false);

    expect(await getWalletBalance(db, USER_ID)).toBe(2);
    expect(await getTransactionCount(db, USER_ID, "purchase")).toBe(1);
  });

  it("accumulates balance from distinct payment intents", async () => {
    await grant(USER_ID, 2, "pi_a");
    await grant(USER_ID, 2, "pi_b");

    expect(await getWalletBalance(db, USER_ID)).toBe(4);
    expect(await getTransactionCount(db, USER_ID, "purchase")).toBe(2);
  });

  it("rejects amount <= 0", async () => {
    await expect(grant(USER_ID, 0, "pi_zero")).rejects.toThrow(
      "p_amount must be > 0",
    );
  });

  it("persists metadata as JSONB", async () => {
    const meta = JSON.stringify({ stripe_event_id: "evt_abc" });
    await grant(USER_ID, 2, "pi_meta", meta);

    const r = await db.query<{ metadata: { stripe_event_id: string } }>(
      "SELECT metadata FROM credit_transactions WHERE stripe_payment_intent_id = 'pi_meta'",
    );
    expect(r.rows[0].metadata).toEqual({ stripe_event_id: "evt_abc" });
  });
});

// ── deduct_growth_credit ──

describe("deduct_growth_credit (real SQL)", () => {
  beforeEach(async () => {
    await grant(USER_ID, 2, `pi_setup_${Math.random()}`);
  });

  it("deducts one credit and returns true", async () => {
    expect(await deduct(USER_ID, "req-001")).toBe(true);
    expect(await getWalletBalance(db, USER_ID)).toBe(1);
    expect(await getTransactionCount(db, USER_ID, "usage")).toBe(1);
  });

  it("returns false when balance is 0", async () => {
    await deduct(USER_ID, "req-a");
    await deduct(USER_ID, "req-b");
    expect(await getWalletBalance(db, USER_ID)).toBe(0);

    expect(await deduct(USER_ID, "req-c")).toBe(false);
    expect(await getWalletBalance(db, USER_ID)).toBe(0);
  });

  it("returns true on duplicate request_id — no double deduct", async () => {
    await deduct(USER_ID, "req-dup");
    expect(await getWalletBalance(db, USER_ID)).toBe(1);

    // Replay same request_id
    expect(await deduct(USER_ID, "req-dup")).toBe(true);
    expect(await getWalletBalance(db, USER_ID)).toBe(1);
    expect(await getTransactionCount(db, USER_ID, "usage")).toBe(1);
  });

  it("returns false for user with no wallet", async () => {
    const otherUser = "22222222-2222-2222-2222-222222222222";
    await createTestProfile(db, otherUser);

    expect(await deduct(otherUser, "req-no-wallet")).toBe(false);
  });
});

// ── refund_growth_credit ──

describe("refund_growth_credit (real SQL)", () => {
  beforeEach(async () => {
    await grant(USER_ID, 2, `pi_refund_${Math.random()}`);
    await deduct(USER_ID, "req-to-refund");
  });

  it("adds one credit back and returns true", async () => {
    const before = await getWalletBalance(db, USER_ID);
    expect(await refund(USER_ID, "req-to-refund")).toBe(true);

    expect(await getWalletBalance(db, USER_ID)).toBe(before + 1);
    expect(await getTransactionCount(db, USER_ID, "refund")).toBe(1);
  });

  it("returns true on duplicate refund — no double credit", async () => {
    await refund(USER_ID, "req-to-refund");
    const balanceAfterFirst = await getWalletBalance(db, USER_ID);

    expect(await refund(USER_ID, "req-to-refund")).toBe(true);
    expect(await getWalletBalance(db, USER_ID)).toBe(balanceAfterFirst);
    expect(await getTransactionCount(db, USER_ID, "refund")).toBe(1);
  });
});

// ── full lifecycle + constraints ──

describe("full lifecycle (real SQL)", () => {
  it("grant → deduct → refund → deduct yields correct balance and ledger", async () => {
    await grant(USER_ID, 2, "pi_lifecycle");
    expect(await getWalletBalance(db, USER_ID)).toBe(2);

    await deduct(USER_ID, "req-lc-1");
    expect(await getWalletBalance(db, USER_ID)).toBe(1);

    await refund(USER_ID, "req-lc-1");
    expect(await getWalletBalance(db, USER_ID)).toBe(2);

    await deduct(USER_ID, "req-lc-2");
    expect(await getWalletBalance(db, USER_ID)).toBe(1);

    // 1 purchase + 2 usage + 1 refund = 4
    expect(await getTransactionCount(db, USER_ID)).toBe(4);
  });

  it("CHECK constraint prevents negative balance via direct UPDATE", async () => {
    await db.query(
      "INSERT INTO credit_wallets (user_id, growth_balance) VALUES ($1, 0)",
      [USER_ID],
    );

    await expect(
      db.query(
        "UPDATE credit_wallets SET growth_balance = -1 WHERE user_id = $1",
        [USER_ID],
      ),
    ).rejects.toThrow(/growth_balance_non_negative/);
  });

  it("CHECK constraint enforces amount sign by source", async () => {
    // Positive amount on 'usage' source should fail
    await expect(
      db.query(
        `INSERT INTO credit_transactions
           (user_id, credit_type, amount, source, request_id)
         VALUES ($1, 'growth', 1, 'usage', 'req-bad')`,
        [USER_ID],
      ),
    ).rejects.toThrow(/amount_sign_by_source/);
  });

  it("CHECK constraint requires payment_intent on purchase source", async () => {
    await expect(
      db.query(
        `INSERT INTO credit_transactions
           (user_id, credit_type, amount, source)
         VALUES ($1, 'growth', 2, 'purchase')`,
        [USER_ID],
      ),
    ).rejects.toThrow(/purchase_requires_payment_intent/);
  });

  it("CHECK constraint requires request_id on usage source", async () => {
    await expect(
      db.query(
        `INSERT INTO credit_transactions
           (user_id, credit_type, amount, source)
         VALUES ($1, 'growth', -1, 'usage')`,
        [USER_ID],
      ),
    ).rejects.toThrow(/usage_refund_requires_request_id/);
  });
});
