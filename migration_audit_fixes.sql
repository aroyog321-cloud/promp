-- 1. Create the atomic increment_usage RPC
CREATE OR REPLACE FUNCTION increment_usage(
  p_user_id TEXT,
  p_is_regen BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(allowed BOOLEAN, tier TEXT, total_requests_today INT, regenerations_today INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row usage_stats;
  v_limit_total INT;
  v_limit_regen INT;
  v_allowed BOOLEAN := FALSE;
BEGIN
  -- Atomic lock on the user's usage row
  SELECT * INTO v_row FROM usage_stats WHERE id = p_user_id FOR UPDATE;

  -- Bootstrap row if missing
  IF NOT FOUND THEN
    INSERT INTO usage_stats (id, tier, total_requests_today, regenerations_today, last_reset_date)
    VALUES (p_user_id, 'free', 0, 0, CURRENT_DATE)
    ON CONFLICT (id) DO NOTHING;
    SELECT * INTO v_row FROM usage_stats WHERE id = p_user_id FOR UPDATE;
  END IF;

  -- Reset counters if new day
  IF v_row.last_reset_date < CURRENT_DATE THEN
    UPDATE usage_stats
    SET total_requests_today = 0, regenerations_today = 0, last_reset_date = CURRENT_DATE
    WHERE id = p_user_id;
    v_row.total_requests_today := 0;
    v_row.regenerations_today := 0;
  END IF;

  -- Determine limits by tier
  v_limit_total := CASE v_row.tier WHEN 'free' THEN 10 WHEN 'pro' THEN 50 ELSE 2147483647 END;
  v_limit_regen := CASE v_row.tier WHEN 'free' THEN 4 WHEN 'pro' THEN 50 ELSE 2147483647 END;

  -- Check and increment
  IF p_is_regen THEN
    v_allowed := v_row.regenerations_today < v_limit_regen;
    IF v_allowed THEN
      UPDATE usage_stats SET regenerations_today = regenerations_today + 1 WHERE id = p_user_id;
    END IF;
  ELSE
    v_allowed := v_row.total_requests_today < v_limit_total;
    IF v_allowed THEN
      UPDATE usage_stats SET total_requests_today = total_requests_today + 1 WHERE id = p_user_id;
    END IF;
  END IF;

  RETURN QUERY SELECT v_allowed, v_row.tier, v_row.total_requests_today, v_row.regenerations_today;
END;
$$;

-- 2. Enable RLS on ApiKey and SystemSetting
ALTER TABLE "ApiKey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SystemSetting" ENABLE ROW LEVEL SECURITY;

-- No policies means default deny for anon/authenticated roles.
-- Service Role bypasses RLS anyway, so `getDynamicApiKey` (which uses supabaseAdmin) still works.

-- 3. Add composite index on PromptHistory
CREATE INDEX IF NOT EXISTS "PromptHistory_userId_createdAt_idx" ON "PromptHistory"("userId", "createdAt" DESC);
