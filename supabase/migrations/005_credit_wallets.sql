-- ============================================================
-- 005_credit_wallets.sql
-- Credit wallet + append-only transaction ledger
-- ============================================================

-- ────────────────────────────────────────
-- Tables
-- ────────────────────────────────────────

CREATE TABLE credit_wallets (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL UNIQUE
                            REFERENCES public.profiles(id) ON DELETE CASCADE,
  growth_balance integer    NOT NULL DEFAULT 0
                            CONSTRAINT growth_balance_non_negative CHECK (growth_balance >= 0),
  eval_balance   integer    NOT NULL DEFAULT 0
                            CONSTRAINT eval_balance_non_negative CHECK (eval_balance >= 0),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE credit_transactions (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid        NOT NULL
                                        REFERENCES public.profiles(id) ON DELETE CASCADE,
  credit_type               text        NOT NULL
                                        CONSTRAINT valid_credit_type
                                        CHECK (credit_type IN ('growth', 'eval')),
  amount                    integer     NOT NULL,
  source                    text        NOT NULL
                                        CONSTRAINT valid_source
                                        CHECK (source IN ('purchase', 'usage', 'refund', 'admin')),
  stripe_payment_intent_id  text,
  request_id                text,
  description               text,
  metadata                  jsonb,
  created_at                timestamptz NOT NULL DEFAULT now(),

  -- Amount sign must match source
  CONSTRAINT amount_sign_by_source CHECK (
    (source = 'usage' AND amount < 0) OR
    (source IN ('purchase', 'refund', 'admin') AND amount > 0)
  ),

  -- purchase must have a payment intent
  CONSTRAINT purchase_requires_payment_intent CHECK (
    source <> 'purchase' OR stripe_payment_intent_id IS NOT NULL
  ),

  -- usage and refund must have a request_id
  CONSTRAINT usage_refund_requires_request_id CHECK (
    source NOT IN ('usage', 'refund') OR request_id IS NOT NULL
  )
);

-- ────────────────────────────────────────
-- Indexes
-- ────────────────────────────────────────

CREATE INDEX idx_credit_txn_user_created
  ON credit_transactions (user_id, created_at DESC);

CREATE UNIQUE INDEX uniq_credit_txn_payment_intent
  ON credit_transactions (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE UNIQUE INDEX uniq_credit_txn_request_usage
  ON credit_transactions (user_id, request_id)
  WHERE source = 'usage' AND request_id IS NOT NULL;

CREATE UNIQUE INDEX uniq_credit_txn_request_refund
  ON credit_transactions (user_id, request_id)
  WHERE source = 'refund' AND request_id IS NOT NULL;

-- ────────────────────────────────────────
-- updated_at trigger for credit_wallets
-- ────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_credit_wallet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_credit_wallet_updated_at
  BEFORE UPDATE ON credit_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_credit_wallet_updated_at();

-- ────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────

ALTER TABLE credit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet"
  ON credit_wallets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own transactions"
  ON credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- ────────────────────────────────────────
-- RPC: grant_growth_credits
-- ────────────────────────────────────────

CREATE OR REPLACE FUNCTION grant_growth_credits(
  p_user_id                   uuid,
  p_amount                    integer,
  p_stripe_payment_intent_id  text,
  p_metadata                  jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inserted_id uuid;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'p_amount must be > 0';
  END IF;

  -- Atomic idempotency: attempt insert, skip on duplicate payment_intent
  INSERT INTO credit_transactions
    (user_id, credit_type, amount, source, stripe_payment_intent_id, metadata)
  VALUES
    (p_user_id, 'growth', p_amount, 'purchase', p_stripe_payment_intent_id, p_metadata)
  ON CONFLICT (stripe_payment_intent_id)
    WHERE stripe_payment_intent_id IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    RETURN false;  -- duplicate payment_intent
  END IF;

  -- Upsert wallet (only reached if transaction insert succeeded)
  INSERT INTO credit_wallets (user_id, growth_balance)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET growth_balance = credit_wallets.growth_balance + p_amount;

  RETURN true;
END;
$$;

-- ────────────────────────────────────────
-- RPC: deduct_growth_credit
-- ────────────────────────────────────────

CREATE OR REPLACE FUNCTION deduct_growth_credit(
  p_user_id    uuid,
  p_request_id text,
  p_metadata   jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rows integer;
BEGIN
  -- Try to decrement first (row-level lock prevents double-spend)
  UPDATE credit_wallets
     SET growth_balance = growth_balance - 1
   WHERE user_id = p_user_id
     AND growth_balance > 0;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    -- Could be insufficient balance OR idempotent replay — check which
    PERFORM 1 FROM credit_transactions
     WHERE user_id = p_user_id
       AND request_id = p_request_id
       AND source = 'usage';
    IF FOUND THEN
      RETURN true;   -- already processed (idempotent)
    END IF;
    RETURN false;     -- insufficient balance or no wallet
  END IF;

  -- Atomic idempotency: attempt insert, undo wallet on duplicate request_id
  INSERT INTO credit_transactions
    (user_id, credit_type, amount, source, request_id, metadata)
  VALUES
    (p_user_id, 'growth', -1, 'usage', p_request_id, p_metadata)
  ON CONFLICT (user_id, request_id)
    WHERE source = 'usage' AND request_id IS NOT NULL
  DO NOTHING;

  IF NOT FOUND THEN
    -- Duplicate request_id — undo the decrement
    UPDATE credit_wallets
       SET growth_balance = growth_balance + 1
     WHERE user_id = p_user_id;
    RETURN true;  -- idempotent
  END IF;

  RETURN true;
END;
$$;

-- ────────────────────────────────────────
-- RPC: refund_growth_credit
-- ────────────────────────────────────────

CREATE OR REPLACE FUNCTION refund_growth_credit(
  p_user_id    uuid,
  p_request_id text,
  p_metadata   jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inserted_id uuid;
BEGIN
  -- Atomic idempotency: attempt insert, skip on duplicate (user_id, request_id)
  INSERT INTO credit_transactions
    (user_id, credit_type, amount, source, request_id, metadata)
  VALUES
    (p_user_id, 'growth', 1, 'refund', p_request_id, p_metadata)
  ON CONFLICT (user_id, request_id)
    WHERE source = 'refund' AND request_id IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    RETURN true;  -- already refunded (idempotent)
  END IF;

  -- Credit back (only reached if transaction insert succeeded)
  INSERT INTO credit_wallets (user_id, growth_balance)
  VALUES (p_user_id, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET growth_balance = credit_wallets.growth_balance + 1;

  RETURN true;
END;
$$;

-- ────────────────────────────────────────
-- Execute permissions: service_role only
-- ────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION grant_growth_credits(uuid, integer, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION grant_growth_credits(uuid, integer, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION grant_growth_credits(uuid, integer, text, jsonb) FROM authenticated;
GRANT  EXECUTE ON FUNCTION grant_growth_credits(uuid, integer, text, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION deduct_growth_credit(uuid, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION deduct_growth_credit(uuid, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION deduct_growth_credit(uuid, text, jsonb) FROM authenticated;
GRANT  EXECUTE ON FUNCTION deduct_growth_credit(uuid, text, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION refund_growth_credit(uuid, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION refund_growth_credit(uuid, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION refund_growth_credit(uuid, text, jsonb) FROM authenticated;
GRANT  EXECUTE ON FUNCTION refund_growth_credit(uuid, text, jsonb) TO service_role;
