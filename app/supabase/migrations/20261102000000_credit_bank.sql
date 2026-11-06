-- Credit bank for NEW lifetime buyers (owner decision 2026-11-02).
--
-- NOT APPLIED. Run it in the Supabase SQL editor when the owner says so. The app code
-- that ships with it is safe before this runs: every call into these tables and
-- functions treats "not installed" as "feature off", so all accounts keep today's
-- behaviour until (1) this migration is applied AND (2) credit_bank_settings.starts_at
-- is set.
--
-- BEFORE APPLYING: compare the live deduct_user_credits with the "legacy" branch below
--   select pg_get_functiondef('public.deduct_user_credits(uuid,integer,text,jsonb)'::regprocedure);
-- The legacy branch is a verbatim copy of 20260225000001_fix_deduct_credits_logging.sql,
-- and the guards at its top are those of 20261102000001_credit_rpc_guard.sql (apply that
-- one first; this file keeps its guards and grants). If the live body differs, merge the
-- difference into the legacy branch first.
--
-- Model
--   * A bank buyer has a row in credit_bank_accounts. Nobody else does, so nothing
--     changes for existing lifetime buyers or the $37 monthly plan.
--   * Bank credits live in user_credits.total_credits (5,000) / used_credits, with a
--     credit period ending in ~100 years, so no renewal path ever sees them as lapsed.
--   * Credit pack credits stay in user_credits.bonus_credits (where the FastSpring
--     CREDIT_PACK handler and the admin "add credits" already put them). For bank
--     buyers a pack spend LOWERS bonus_credits instead of raising used_credits, so the
--     two buckets never mix. available_credits (generated: total - used + bonus) is
--     still the full balance.
--   * Fixed 30-day periods (owner choice 2026-11-02): the first bank spend starts a
--     period (credit_bank_accounts.period_started_at); within it at most window_limit
--     (1,500) bank credits can be used. When window_days (30) have passed, the next
--     bank spend starts a new period with all 1,500 available again. The roll happens
--     inside the locked deduction. Every bank buyer's debit carries
--     metadata.credit_bank = {bank, pack}; every refund of one carries
--     metadata.credit_bank = {bank, pack, debit_id}. Period usage = bank part of the
--     debits since period_started_at minus the bank part refunded on THOSE debits (a
--     refund of a debit from an older period never touches the current period).
--   * Pack credits are never limited. Spends take bank credits first (as far as the
--     period allows), the rest from pack credits; a spend can be split.
--   * Security: deduct_user_credits keeps the guards of 20261102000001_credit_rpc_guard
--     (positive amounts only, a signed-in caller only for itself, no anon).

-- 1) Launch switch + numbers (one row). starts_at NULL = OFF.
CREATE TABLE IF NOT EXISTS public.credit_bank_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  starts_at TIMESTAMPTZ NULL,
  bank_credits INTEGER NOT NULL DEFAULT 5000 CHECK (bank_credits > 0),
  window_limit INTEGER NOT NULL DEFAULT 1500 CHECK (window_limit > 0),
  window_days INTEGER NOT NULL DEFAULT 30 CHECK (window_days > 0),
  notice_from INTEGER NOT NULL DEFAULT 1200 CHECK (notice_from >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO public.credit_bank_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.credit_bank_settings ENABLE ROW LEVEL SECURITY;

-- 2) Who is on the bank model (the numbers are copied at purchase time, so a later
--    settings change never alters an existing buyer).
CREATE TABLE IF NOT EXISTS public.credit_bank_accounts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_credits INTEGER NOT NULL,
  window_limit INTEGER NOT NULL,
  window_days INTEGER NOT NULL,
  source TEXT NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL,
  -- Start of the current 30-day period; NULL until the first bank spend.
  period_started_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.credit_bank_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own credit bank" ON public.credit_bank_accounts;
CREATE POLICY "Users read own credit bank" ON public.credit_bank_accounts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- The period query reads a user's recent ledger rows.
CREATE INDEX IF NOT EXISTS credit_transactions_user_created_idx
  ON public.credit_transactions (user_id, created_at DESC);

-- 3) Status of one account: bank left, pack left, period usage, when the next 1,500 unlock.
--    (The keys keep the name "window" for the period.) A period that has run its 30 days
--    counts as over: usage 0, next_free_at NULL, until the next bank spend starts one.
CREATE OR REPLACE FUNCTION public.credit_bank_status(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acct credit_bank_accounts%ROWTYPE;
  v_total INTEGER;
  v_used INTEGER;
  v_available INTEGER;
  v_bank_left INTEGER;
  v_pack_left INTEGER;
  v_window_used INTEGER;
  v_window_left INTEGER;
  v_next_free TIMESTAMPTZ;
  v_notice INTEGER;
BEGIN
  SELECT * INTO v_acct FROM credit_bank_accounts WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('is_bank', false);
  END IF;

  SELECT total_credits, used_credits, available_credits
    INTO v_total, v_used, v_available
  FROM user_credits WHERE user_id = p_user_id;

  v_bank_left := GREATEST(COALESCE(v_total, 0) - COALESCE(v_used, 0), 0);
  v_pack_left := GREATEST(COALESCE(v_available, 0) - v_bank_left, 0);

  IF v_acct.period_started_at IS NULL
     OR NOW() >= v_acct.period_started_at + make_interval(days => v_acct.window_days) THEN
    v_window_used := 0;
    v_next_free := NULL;
  ELSE
    WITH d AS (
      SELECT t.id, COALESCE((t.metadata->'credit_bank'->>'bank')::INTEGER, 0) AS bank
      FROM credit_transactions t
      WHERE t.user_id = p_user_id
        AND t.transaction_type = 'debit'
        AND t.metadata ? 'credit_bank'
        AND t.created_at >= v_acct.period_started_at
    ), r AS (
      SELECT (t.metadata->'credit_bank'->>'debit_id')::UUID AS debit_id,
             SUM(COALESCE((t.metadata->'credit_bank'->>'bank')::INTEGER, 0)) AS bank
      FROM credit_transactions t
      WHERE t.user_id = p_user_id
        AND t.operation_type = 'refund'
        AND t.metadata ? 'credit_bank'
        AND t.created_at >= v_acct.period_started_at
      GROUP BY 1
    )
    SELECT COALESCE(SUM(GREATEST(d.bank - COALESCE(r.bank, 0), 0)), 0)::INTEGER
      INTO v_window_used
    FROM d LEFT JOIN r ON r.debit_id = d.id;
    v_next_free := v_acct.period_started_at + make_interval(days => v_acct.window_days);
  END IF;

  v_window_left := GREATEST(v_acct.window_limit - v_window_used, 0);
  SELECT notice_from INTO v_notice FROM credit_bank_settings WHERE id = 1;

  RETURN jsonb_build_object(
    'is_bank', true,
    'bank_credits', v_acct.bank_credits,
    'bank_left', v_bank_left,
    'pack_left', v_pack_left,
    'window_limit', v_acct.window_limit,
    'window_days', v_acct.window_days,
    'window_used', v_window_used,
    'window_left', v_window_left,
    'spendable_now', v_pack_left + LEAST(v_bank_left, v_window_left),
    'next_free_at', v_next_free,
    'period_started_at', v_acct.period_started_at,
    -- The note shows from 1,200 of 1,500 (80%); a smaller test limit keeps the same 80%.
    'notice_from', LEAST(COALESCE(v_notice, 1200), FLOOR(v_acct.window_limit * 0.8)::INTEGER)
  );
END;
$$;

-- 4) Put a new lifetime buyer on the bank. Idempotent (webhook retries). Does nothing
--    while the switch is off or before starts_at, unless p_force (manual/test grants).
CREATE OR REPLACE FUNCTION public.grant_credit_bank(
  p_user_id UUID,
  p_source TEXT,
  p_purchased_at TIMESTAMPTZ DEFAULT NULL,
  p_force BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings credit_bank_settings%ROWTYPE;
  v_at TIMESTAMPTZ := COALESCE(p_purchased_at, NOW());
  v_row user_credits%ROWTYPE;
  v_has_row BOOLEAN;
  v_pack INTEGER := 0;
BEGIN
  SELECT * INTO v_settings FROM credit_bank_settings WHERE id = 1;
  IF NOT p_force AND (v_settings.starts_at IS NULL OR v_at < v_settings.starts_at) THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'off');
  END IF;

  IF EXISTS (SELECT 1 FROM credit_bank_accounts WHERE user_id = p_user_id) THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'already on the bank');
  END IF;

  -- Pack credits the buyer already owns carry over, exactly as many as are unspent
  -- (a legacy account spends packs by pushing used_credits past total_credits).
  SELECT * INTO v_row FROM user_credits WHERE user_id = p_user_id FOR UPDATE;
  v_has_row := FOUND;
  IF v_has_row THEN
    v_pack := GREATEST(COALESCE(v_row.bonus_credits, 0)
                       - GREATEST(COALESCE(v_row.used_credits, 0) - COALESCE(v_row.total_credits, 0), 0), 0);
  END IF;

  INSERT INTO credit_bank_accounts (user_id, bank_credits, window_limit, window_days, source, purchased_at)
  VALUES (p_user_id, v_settings.bank_credits, v_settings.window_limit, v_settings.window_days, p_source, v_at);

  PERFORM set_config('bluefx.credit_bank_write', 'on', true);
  IF v_has_row THEN
    UPDATE user_credits
    SET total_credits = v_settings.bank_credits,
        used_credits = 0,
        bonus_credits = v_pack,
        period_start = NOW(),
        period_end = NOW() + INTERVAL '100 years',
        updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSE
    INSERT INTO user_credits (user_id, total_credits, used_credits, bonus_credits, period_start, period_end)
    VALUES (p_user_id, v_settings.bank_credits, 0, 0, NOW(), NOW() + INTERVAL '100 years');
  END IF;
  PERFORM set_config('bluefx.credit_bank_write', 'off', true);

  INSERT INTO credit_transactions (user_id, transaction_type, amount, balance_after, operation_type, description, metadata, status)
  VALUES (p_user_id, 'credit', v_settings.bank_credits, v_settings.bank_credits + v_pack, 'credit_bank_grant',
          'Lifetime credit bank: ' || v_settings.bank_credits || ' credits',
          jsonb_build_object('source', p_source, 'pack_carried_over', v_pack, 'forced', p_force), 'completed');

  RETURN jsonb_build_object('granted', true, 'bank_credits', v_settings.bank_credits, 'pack_credits', v_pack);
END;
$$;

-- 5) Refund one bank buyer's debit back into the buckets it came from.
CREATE OR REPLACE FUNCTION public.credit_bank_refund(
  p_user_id UUID,
  p_debit_id UUID,
  p_reference TEXT,
  p_operation TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_debit credit_transactions%ROWTYPE;
  v_bank INTEGER;
  v_pack INTEGER;
  v_used INTEGER;
  v_remaining INTEGER;
BEGIN
  SELECT * INTO v_debit FROM credit_transactions
  WHERE id = p_debit_id AND user_id = p_user_id AND transaction_type = 'debit';
  IF NOT FOUND OR NOT (v_debit.metadata ? 'credit_bank') THEN
    RETURN jsonb_build_object('success', false, 'error', 'not a credit bank debit');
  END IF;
  IF EXISTS (SELECT 1 FROM credit_transactions
             WHERE user_id = p_user_id AND operation_type = 'refund'
               AND metadata->'credit_bank'->>'debit_id' = p_debit_id::TEXT) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already refunded');
  END IF;

  SELECT used_credits INTO v_used FROM user_credits WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User credits record not found');
  END IF;

  v_bank := LEAST(COALESCE((v_debit.metadata->'credit_bank'->>'bank')::INTEGER, 0), COALESCE(v_used, 0));
  v_pack := COALESCE((v_debit.metadata->'credit_bank'->>'pack')::INTEGER, 0);
  IF v_bank + v_pack <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'nothing to refund');
  END IF;

  UPDATE user_credits
  SET used_credits = used_credits - v_bank,
      bonus_credits = bonus_credits + v_pack,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  SELECT available_credits INTO v_remaining FROM user_credits WHERE user_id = p_user_id;

  INSERT INTO credit_transactions (user_id, transaction_type, amount, balance_after, operation_type, description, metadata, status)
  VALUES (p_user_id, 'credit', v_bank + v_pack, v_remaining, 'refund', 'Refund: failed ' || COALESCE(p_operation, 'generation'),
          jsonb_build_object('refund_reference', p_reference, 'operation', p_operation,
                             'credit_bank', jsonb_build_object('bank', v_bank, 'pack', v_pack, 'debit_id', p_debit_id)),
          'completed');

  RETURN jsonb_build_object('success', true, 'amount', v_bank + v_pack, 'bank', v_bank, 'pack', v_pack,
                            'remaining_credits', v_remaining);
END;
$$;

-- 6) The one deduction every tool uses. Same guards as 20261102000001_credit_rpc_guard
--    (positive amounts only; a signed-in caller may charge only itself; no anon), then:
--    accounts without a bank row run the old body unchanged; bank accounts get the bucket
--    split and the 30-day period limit, atomically.
CREATE OR REPLACE FUNCTION public.deduct_user_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_operation TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_available INTEGER;
  v_remaining INTEGER;
  v_is_bank BOOLEAN;
  v_row user_credits%ROWTYPE;
  v_acct public.credit_bank_accounts%ROWTYPE;
  v_status JSONB;
  v_bank_left INTEGER;
  v_pack_left INTEGER;
  v_window_left INTEGER;
  v_limit INTEGER;
  v_bank_take INTEGER;
  v_pack_take INTEGER;
  v_unlock TEXT;
  v_next INTEGER;
BEGIN
  -- ===== guards (20261102000001) =====
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid credit amount', 'remaining_credits', 0);
  END IF;
  IF auth.role() IS NOT NULL AND auth.role() <> 'service_role'
     AND (auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not allowed to use these credits', 'remaining_credits', 0);
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.credit_bank_accounts WHERE user_id = p_user_id) INTO v_is_bank;

  IF NOT v_is_bank THEN
    -- ===== legacy branch: verbatim copy of 20260225000001 =====
    SELECT available_credits INTO v_available
    FROM user_credits
    WHERE user_id = p_user_id;

    IF v_available IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'User credits record not found',
        'remaining_credits', 0
      );
    END IF;

    IF v_available < p_amount THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Insufficient credits',
        'remaining_credits', v_available
      );
    END IF;

    UPDATE user_credits
    SET used_credits = used_credits + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    SELECT available_credits INTO v_remaining
    FROM user_credits
    WHERE user_id = p_user_id;

    INSERT INTO credit_transactions (
      user_id, transaction_type, amount, balance_after,
      operation_type, description, metadata, status
    ) VALUES (
      p_user_id,
      'debit',
      -p_amount,
      v_remaining,
      COALESCE(p_operation, 'unknown'),
      'Credits used for ' || COALESCE(p_operation, 'unknown'),
      COALESCE(p_metadata, '{}'::jsonb),
      'completed'
    );

    RETURN jsonb_build_object(
      'success', true,
      'remaining_credits', v_remaining
    );
  END IF;

  -- ===== credit bank branch =====
  -- Lock the balance and the period so two parallel generations cannot both pass the check.
  SELECT * INTO v_row FROM public.user_credits WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User credits record not found', 'remaining_credits', 0);
  END IF;
  SELECT * INTO v_acct FROM public.credit_bank_accounts WHERE user_id = p_user_id FOR UPDATE;

  v_status := public.credit_bank_status(p_user_id);
  v_bank_left := (v_status->>'bank_left')::INTEGER;
  v_pack_left := (v_status->>'pack_left')::INTEGER;
  v_window_left := (v_status->>'window_left')::INTEGER;
  v_limit := (v_status->>'window_limit')::INTEGER;

  v_bank_take := LEAST(p_amount, v_bank_left, v_window_left);
  v_pack_take := p_amount - v_bank_take;

  IF v_pack_take > v_pack_left THEN
    IF v_bank_left > v_bank_take THEN
      -- Bank credits exist but the 30-day period's 1,500 are used.
      v_unlock := COALESCE(to_char((v_status->>'next_free_at')::TIMESTAMPTZ AT TIME ZONE 'UTC', 'Mon FMDD'), 'soon');
      v_next := LEAST(v_limit, v_bank_left - v_window_left);
      RETURN jsonb_build_object(
        'success', false,
        'error', CASE WHEN v_window_left = 0 THEN
            'You''ve used your ' || to_char(v_limit, 'FM999,999,999')
            || ' credits for this ' || (v_status->>'window_days') || '-day period. Your remaining '
            || to_char(v_bank_left, 'FM999,999,999') || ' credits are safe, and your next '
            || to_char(v_next, 'FM999,999,999') || ' unlock on ' || v_unlock
            || '. Need more now? Buy a credit pack, pack credits work right away.'
          ELSE
            'This needs ' || to_char(p_amount, 'FM999,999,999') || ' credits and you have '
            || to_char(v_window_left + v_pack_left, 'FM999,999,999') || ' left for this '
            || (v_status->>'window_days') || '-day period. Your remaining '
            || to_char(v_bank_left - v_window_left, 'FM999,999,999') || ' credits are safe, and your next '
            || to_char(v_next, 'FM999,999,999') || ' unlock on ' || v_unlock
            || '. Need more now? Buy a credit pack, pack credits work right away.'
          END,
        'limit_reached', true,
        'remaining_credits', v_row.available_credits
      );
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient credits', 'remaining_credits', v_row.available_credits);
  END IF;

  -- A bank spend with no running period (first spend, or the last period has ended)
  -- starts a new 30-day period now. credit_bank_status already counted it as fresh.
  IF v_bank_take > 0 AND (v_acct.period_started_at IS NULL
      OR NOW() >= v_acct.period_started_at + make_interval(days => v_acct.window_days)) THEN
    UPDATE public.credit_bank_accounts SET period_started_at = NOW() WHERE user_id = p_user_id;
  END IF;

  UPDATE public.user_credits
  SET used_credits = used_credits + v_bank_take,
      bonus_credits = bonus_credits - v_pack_take,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  SELECT available_credits INTO v_remaining FROM public.user_credits WHERE user_id = p_user_id;

  INSERT INTO public.credit_transactions (
    user_id, transaction_type, amount, balance_after,
    operation_type, description, metadata, status
  ) VALUES (
    p_user_id,
    'debit',
    -p_amount,
    v_remaining,
    COALESCE(p_operation, 'unknown'),
    'Credits used for ' || COALESCE(p_operation, 'unknown'),
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('credit_bank', jsonb_build_object('bank', v_bank_take, 'pack', v_pack_take)),
    'completed'
  );

  RETURN jsonb_build_object('success', true, 'remaining_credits', v_remaining);
END;
$$;

-- Keep the grants of 20261102000001 (no anon, no PUBLIC).
REVOKE EXECUTE ON FUNCTION public.deduct_user_credits(UUID, INTEGER, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deduct_user_credits(UUID, INTEGER, TEXT, JSONB) TO authenticated, service_role;

-- 7) Safety net: nothing but grant_credit_bank may change a bank buyer's bank size.
--    A stray monthly top-up (topup_user_credits, a webhook re-grant) would otherwise
--    reset 5,000 to 600. Setting total_credits to 0 (a refund taking access away)
--    stays allowed.
CREATE OR REPLACE FUNCTION public.protect_credit_bank()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.total_credits IS DISTINCT FROM OLD.total_credits
     AND NEW.total_credits <> 0
     AND COALESCE(current_setting('bluefx.credit_bank_write', true), '') <> 'on'
     AND EXISTS (SELECT 1 FROM credit_bank_accounts WHERE user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'credit bank: total_credits of % is managed by grant_credit_bank (set bluefx.credit_bank_write=on to override)', NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_credit_bank ON public.user_credits;
CREATE TRIGGER protect_credit_bank
  BEFORE UPDATE ON public.user_credits
  FOR EACH ROW EXECUTE FUNCTION public.protect_credit_bank();

-- Only the server (service role) may call the new functions.
REVOKE ALL ON FUNCTION public.credit_bank_status(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_credit_bank(UUID, TEXT, TIMESTAMPTZ, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_bank_refund(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_bank_status(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_credit_bank(UUID, TEXT, TIMESTAMPTZ, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_bank_refund(UUID, UUID, TEXT, TEXT) TO service_role;

-- Switch it on (owner's choice of day), e.g.:
--   update credit_bank_settings set starts_at = '2026-11-10T00:00:00Z', updated_at = now() where id = 1;
-- Switch it off again (new purchases only; existing bank buyers stay on the bank):
--   update credit_bank_settings set starts_at = null, updated_at = now() where id = 1;
