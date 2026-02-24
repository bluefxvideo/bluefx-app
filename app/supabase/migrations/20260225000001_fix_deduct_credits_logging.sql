-- Fix deduct_user_credits: add missing INSERT INTO credit_transactions
-- Without this, the admin panel has no data for daily usage, tool breakdown, etc.

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
