import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";

vi.mock("../../src/config/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));
vi.mock("../../src/config/stripe", () => ({
  getStripe: vi.fn(),
}));
vi.mock("../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { getSupabaseAdmin } from "../../src/config/supabase";
import { getStripe } from "../../src/config/stripe";
import { handleWebhook } from "../../src/controllers/stripe.controller";
import { createControllerMocks } from "../helpers/controller-mocks";
import {
  createCreditTestDb,
  createTestProfile,
  getTransactionCount,
  getWalletBalance,
} from "../helpers/pglite-db";

const mockGetSupabaseAdmin = getSupabaseAdmin as ReturnType<typeof vi.fn>;
const mockGetStripe = getStripe as ReturnType<typeof vi.fn>;
const USER_ID = "11111111-1111-1111-1111-111111111111";

let db: PGlite;

beforeAll(async () => {
  db = await createCreditTestDb();
  await createTestProfile(db, USER_ID);
}, 30_000);

afterAll(async () => {
  await db.close();
});

type GrantRpcArgs = {
  p_user_id: string;
  p_amount: number;
  p_stripe_payment_intent_id: string;
  p_metadata: Record<string, unknown> | null;
};

function buildSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "cs_123",
    client_reference_id: USER_ID,
    customer_email: "test@example.com",
    amount_total: 500,
    currency: "usd",
    payment_status: "paid",
    mode: "payment",
    payment_intent: "pi_abc",
    metadata: { product: "growth_credits_2" },
    ...overrides,
  };
}

describe("credit webhook idempotency (integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(async () => {
    await db.exec("DELETE FROM credit_transactions");
    await db.exec("DELETE FROM credit_wallets");

    mockGetSupabaseAdmin.mockReturnValue({
      rpc: vi.fn(async (fnName: string, args: GrantRpcArgs) => {
        if (fnName !== "grant_growth_credits") {
          throw new Error(`Unexpected RPC in webhook test: ${fnName}`);
        }

        const result = await db.query<{ grant_growth_credits: boolean }>(
          "SELECT grant_growth_credits($1, $2, $3, $4::jsonb)",
          [
            args.p_user_id,
            args.p_amount,
            args.p_stripe_payment_intent_id,
            args.p_metadata ? JSON.stringify(args.p_metadata) : null,
          ],
        );

        return { data: result.rows[0].grant_growth_credits, error: null };
      }),
    });
  });

  function setupStripeEvent(eventId: string, session: Record<string, unknown>) {
    mockGetStripe.mockReturnValue({
      webhooks: {
        constructEvent: vi.fn().mockReturnValue({
          id: eventId,
          type: "checkout.session.completed",
          data: { object: session },
        }),
      },
    });
  }

  async function callWebhook(eventId: string, session: Record<string, unknown>) {
    setupStripeEvent(eventId, session);
    const { req, res, next } = createControllerMocks();
    (req as any).headers = { "stripe-signature": "sig_valid" };
    (req as any).body = Buffer.from("{}");
    await handleWebhook(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ received: true });
  }

  it("same event.id replayed twice — second grant is idempotent skip", async () => {
    const session = buildSession();

    await callWebhook("evt_001", session);
    await callWebhook("evt_001", session);

    expect(await getWalletBalance(db, USER_ID)).toBe(2);
    expect(await getTransactionCount(db, USER_ID, "purchase")).toBe(1);

    const tx = await db.query<{ metadata: { stripe_event_id: string } }>(
      "SELECT metadata FROM credit_transactions WHERE user_id = $1 AND source = 'purchase'",
      [USER_ID],
    );
    expect(tx.rows[0].metadata).toEqual({ stripe_event_id: "evt_001" });
  });

  it("different event.id but same payment_intent — idempotent on payment_intent", async () => {
    const session = buildSession();

    await callWebhook("evt_001", session);
    await callWebhook("evt_002", session);

    expect(await getWalletBalance(db, USER_ID)).toBe(2);
    expect(await getTransactionCount(db, USER_ID, "purchase")).toBe(1);

    const tx = await db.query<{ metadata: { stripe_event_id: string } }>(
      "SELECT metadata FROM credit_transactions WHERE user_id = $1 AND source = 'purchase'",
      [USER_ID],
    );
    expect(tx.rows[0].metadata).toEqual({ stripe_event_id: "evt_001" });
  });
});
