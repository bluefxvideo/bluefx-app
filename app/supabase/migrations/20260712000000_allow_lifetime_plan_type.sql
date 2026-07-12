-- Allow plan_type 'lifetime' on user_subscriptions.
--
-- The live DB has a CHECK constraint (created outside the repo) that rejects
-- 'lifetime', which made the FastSpring webhook fail provisioning for the
-- lifetime products (AI-Media-Machine-Lifetime / ai-media-machine-lifetime-split)
-- AFTER creating the auth user: profile existed, subscription + credits did not.
--
-- The new value set is the union of every plan_type the codebase writes:
--   FastSpring webhook: starter, pro, agency, lifetime
--   ClickBank webhook + admin/signup paths: pro, trial
--   legacy/generated types: free, enterprise

ALTER TABLE public.user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_plan_type_check;

ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_plan_type_check
  CHECK (plan_type IN ('free', 'trial', 'starter', 'pro', 'agency', 'enterprise', 'lifetime'));
