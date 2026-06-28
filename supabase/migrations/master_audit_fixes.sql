-- MASTER MIGRATION — apply all fixes in order
-- 1. Extend RewriteLevel enum
DO $$ BEGIN
  BEGIN ALTER TYPE "RewriteLevel" ADD VALUE IF NOT EXISTS 'BASIC'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE "RewriteLevel" ADD VALUE IF NOT EXISTS 'PROFESSIONAL'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE "RewriteLevel" ADD VALUE IF NOT EXISTS 'STAFF+'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE "RewriteLevel" ADD VALUE IF NOT EXISTS 'RESEARCH'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE "RewriteLevel" ADD VALUE IF NOT EXISTS 'PRODUCTION AUDIT'; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- 2. Add EXPERT to SubscriptionTier
DO $$ BEGIN
  BEGIN ALTER TYPE "SubscriptionTier" ADD VALUE IF NOT EXISTS 'EXPERT'; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- 3. Add last_reset_date column if missing
ALTER TABLE public.usage_stats ADD COLUMN IF NOT EXISTS last_reset_date DATE DEFAULT CURRENT_DATE;

-- 4. Ensure usage_stats RLS policies exist
DROP POLICY IF EXISTS "Users insert own usage" ON usage_stats;
DROP POLICY IF EXISTS "Users update own usage" ON usage_stats;
CREATE POLICY "Users insert own usage" ON usage_stats
  FOR INSERT WITH CHECK (auth.uid()::text = id::text);
CREATE POLICY "Users update own usage" ON usage_stats
  FOR UPDATE USING (auth.uid()::text = id::text) WITH CHECK (auth.uid()::text = id::text);

-- 5. Create ApiMetrics table
CREATE TABLE IF NOT EXISTS "ApiMetrics" (
  "id"        BIGSERIAL PRIMARY KEY,
  "route"     TEXT        NOT NULL,
  "method"    TEXT        NOT NULL DEFAULT 'POST',
  "status"    INTEGER     NOT NULL,
  "duration"  INTEGER     NOT NULL,
  "provider"  TEXT,
  "cache"     TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "ApiMetrics_created_at_idx" ON "ApiMetrics" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "ApiMetrics_route_status_idx" ON "ApiMetrics" ("route", "status");
ALTER TABLE "ApiMetrics" ENABLE ROW LEVEL SECURITY;

-- 6. Composite index on PromptHistory (if not already applied)
CREATE INDEX IF NOT EXISTS "PromptHistory_userId_createdAt_idx"
  ON "PromptHistory" ("userId", "createdAt" DESC);

-- 7. Index on ApiKey for fast lookups
CREATE INDEX IF NOT EXISTS "ApiKey_enabled_name_idx" ON "ApiKey" (enabled, name);

-- 8. Verify
SELECT 
  (SELECT count(*) FROM pg_policies WHERE tablename = 'usage_stats') AS usage_stats_policies,
  (SELECT count(*) FROM information_schema.tables WHERE table_name = 'ApiMetrics') AS api_metrics_exists,
  (SELECT string_agg(enumlabel, ', ' ORDER BY enumsortorder)
   FROM pg_enum WHERE enumtypid = 'RewriteLevel'::regtype) AS rewrite_levels;
