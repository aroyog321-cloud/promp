-- ============================================================
-- Migration: usage_stats fixes
-- Date: 2026-06-25
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Fix 1: Add missing last_reset_date column
-- Without this column the increment_usage RPC cannot reset daily counters,
-- permanently locking users out after their first day's quota is consumed.
ALTER TABLE usage_stats
  ADD COLUMN IF NOT EXISTS last_reset_date DATE DEFAULT CURRENT_DATE;

-- Fix 2: Add INSERT policy so the dashboard can bootstrap a row for new users.
-- The current schema only has a SELECT policy — INSERT from the browser client
-- is blocked by RLS, causing silent failures on the first dashboard load.
DROP POLICY IF EXISTS "Users insert own usage" ON usage_stats;
CREATE POLICY "Users insert own usage" ON usage_stats
  FOR INSERT WITH CHECK (auth.uid()::text = id::text);

-- Fix 3: Add UPDATE policy so client-side tier/quota updates are allowed.
DROP POLICY IF EXISTS "Users update own usage" ON usage_stats;
CREATE POLICY "Users update own usage" ON usage_stats
  FOR UPDATE USING (auth.uid()::text = id::text)
  WITH CHECK (auth.uid()::text = id::text);

-- Fix 4: Add an index on last_reset_date so the quota-check RPC stays fast
-- even as usage_stats grows to millions of rows.
CREATE INDEX IF NOT EXISTS usage_stats_last_reset_idx ON usage_stats (last_reset_date);

-- Fix 5: Add 'expert' to the SubscriptionTier enum.
-- The application code uses 'expert' throughout but the DB enum only has
-- FREE, PRO, TEAM. This causes silent mismatches when reading tier values.
-- NOTE: Adding to a Postgres enum requires a brief ACCESS EXCLUSIVE lock.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'EXPERT'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'SubscriptionTier')
  ) THEN
    ALTER TYPE "SubscriptionTier" ADD VALUE 'EXPERT';
  END IF;
END$$;

-- ============================================================
-- Verify the changes
-- ============================================================
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'usage_stats' ORDER BY ordinal_position;

-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'usage_stats';
