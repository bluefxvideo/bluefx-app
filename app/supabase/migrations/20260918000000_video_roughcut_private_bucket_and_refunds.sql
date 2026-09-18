-- Migration: video_roughcut private bucket + credit refunds
--
-- 1. The video-roughcut bucket was public, and a SELECT policy let anyone read or list
--    every object in it: users' extracted audio, transcripts and XMLs. Make it private.
--    The worker uses the service role; the app hands users short-lived signed URLs.
-- 2. refund_user_credits() was called by the rough-cut code but never existed, so
--    failed jobs silently kept the credits. Add it, mirroring deduct_user_credits().
--    Only the service role may execute it.

-- ============================================================================
-- 1. Private bucket
-- ============================================================================

UPDATE storage.buckets
SET public = false,
    allowed_mime_types = ARRAY['audio/mpeg', 'audio/mp3', 'application/xml', 'text/xml', 'application/json']
WHERE id = 'video-roughcut';

DROP POLICY IF EXISTS "Public can read video-roughcut outputs" ON storage.objects;

-- The per-user INSERT/SELECT policies on audio/ and outputs/ from the first migration stay.

-- ============================================================================
-- 2. Refunds
-- ============================================================================

CREATE OR REPLACE FUNCTION refund_user_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining INTEGER;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Refund amount must be positive');
  END IF;

  -- Give the credits back by lowering used_credits (available_credits is generated).
  UPDATE user_credits
  SET used_credits = GREATEST(used_credits - p_amount, 0),
      updated_at = NOW()
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User credits record not found');
  END IF;

  SELECT available_credits INTO v_remaining
  FROM user_credits
  WHERE user_id = p_user_id;

  INSERT INTO credit_transactions (
    user_id, transaction_type, amount, balance_after,
    operation_type, description, metadata, status
  ) VALUES (
    p_user_id,
    'credit',
    p_amount,
    v_remaining,
    'refund',
    COALESCE(p_reason, 'Credit refund'),
    '{}'::jsonb,
    'completed'
  );

  RETURN jsonb_build_object('success', true, 'remaining_credits', v_remaining);
END;
$$;

-- A SECURITY DEFINER function is executable by PUBLIC by default. Users must not be
-- able to refund themselves, so only the service role (server code) may call it.
REVOKE ALL ON FUNCTION refund_user_credits(UUID, INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION refund_user_credits(UUID, INTEGER, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION refund_user_credits(UUID, INTEGER, TEXT) TO service_role;
