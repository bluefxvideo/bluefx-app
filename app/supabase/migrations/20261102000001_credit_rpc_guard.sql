-- Guard deduct_user_credits (SECURITY, found 2026-11-02).
--
-- NOT APPLIED. Standalone: can ship before 20261102000000_credit_bank.sql (which keeps
-- these guards and grants when it replaces the function again).
--
-- Problem (confirmed live): the function is SECURITY DEFINER and executable by PUBLIC, so
-- anyone holding the public anon key could call /rest/v1/rpc/deduct_user_credits with ANY
-- user id and ANY amount. A negative amount lowers used_credits (free credits); a positive
-- one drains someone else's balance.
--
-- Fix: same body as 20260225000001 (compare with the live one first:
--   select pg_get_functiondef('public.deduct_user_credits(uuid,integer,text,jsonb)'::regprocedure);
-- ), plus two guards at the top that answer with the usual failure shape (never raise),
-- and EXECUTE only for authenticated + service_role.
--
-- topup_user_credits (body not in the repo, unchanged here): grants only. It sets any
-- account's monthly credits to any target, and is most likely executable by PUBLIC (the Postgres default). Every app
-- caller uses the service role (FastSpring webhook, credit-renewal + subscription-reconcile
-- crons, lib/credits/subscription-entitlement.ts); the only user-session caller
-- (actions/credit-management.ts topupUserCredits/autoTopupCredits) is deleted in the same
-- change. Its argument order is not known from the repo, so the grants match it by name.
--
-- App callers after this: every server path either uses the service role or a signed-in
-- session charging its own id (lib/credits/charge-client.ts refuses a mismatch and uses the
-- service role when there is no session, e.g. webhooks and background work, which until now
-- reached the function as anon). Callers that may compute 0 credits skip the call.

CREATE OR REPLACE FUNCTION deduct_user_credits(
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
BEGIN
  -- ===== guards (20261102000001) =====
  -- Never a zero or negative charge: a negative amount lowered used_credits, i.e. free credits.
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid credit amount', 'remaining_credits', 0);
  END IF;
  -- The server (service role) may charge anyone; a signed-in user only themselves. auth.role()
  -- is NULL only for direct database sessions (SQL editor), which are trusted.
  IF auth.role() IS NOT NULL AND auth.role() <> 'service_role'
     AND (auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not allowed to use these credits', 'remaining_credits', 0);
  END IF;

  -- Read the generated available_credits column
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

  -- Increment used_credits (available_credits recalculates automatically)
  UPDATE user_credits
  SET used_credits = used_credits + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Read the new generated available_credits
  SELECT available_credits INTO v_remaining
  FROM user_credits
  WHERE user_id = p_user_id;

  -- Log transaction for admin analytics
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
END;
$$;

REVOKE EXECUTE ON FUNCTION public.deduct_user_credits(UUID, INTEGER, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deduct_user_credits(UUID, INTEGER, TEXT, JSONB) TO authenticated, service_role;

DO $$
DECLARE
  fn REGPROCEDURE;
BEGIN
  FOR fn IN
    SELECT p.oid::REGPROCEDURE
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'topup_user_credits'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    RAISE NOTICE 'guarded %', fn;
  END LOOP;
END;
$$;
