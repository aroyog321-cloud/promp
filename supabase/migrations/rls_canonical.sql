-- supabase/migrations/rls_canonical.sql
-- ============================================================
-- Single idempotent source of truth for all RLS policies.
-- Safe to re-run. Supersedes:
--   supabase_rls_setup.sql
--   supabase_rls_writes.sql
--   supabase_rls_fixes.sql
--   master_audit_fixes.sql (RLS sections)
--   migration_audit_fixes.sql (RLS sections)
-- ============================================================

-- ─── Enable RLS ───────────────────────────────────────────────────────────────
ALTER TABLE "PromptHistory"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContextProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_stats      ENABLE ROW LEVEL SECURITY;

-- ─── PromptHistory: full CRUD, owner-only ─────────────────────────────────────
DROP POLICY IF EXISTS "Users read own history"    ON "PromptHistory";
DROP POLICY IF EXISTS "Users insert own history"  ON "PromptHistory";
DROP POLICY IF EXISTS "Users update own history"  ON "PromptHistory";
DROP POLICY IF EXISTS "Users delete own history"  ON "PromptHistory";
DROP POLICY IF EXISTS "Users manage own history"  ON "PromptHistory"; -- FOR ALL variant

CREATE POLICY "Users read own history" ON "PromptHistory"
  FOR SELECT USING (auth.uid()::text = "userId");

CREATE POLICY "Users insert own history" ON "PromptHistory"
  FOR INSERT WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "Users update own history" ON "PromptHistory"
  FOR UPDATE
  USING      (auth.uid()::text = "userId")
  WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "Users delete own history" ON "PromptHistory"
  FOR DELETE USING (auth.uid()::text = "userId");

-- ─── ContextProfile: full CRUD, owner-only ────────────────────────────────────
DROP POLICY IF EXISTS "Users read own context"    ON "ContextProfile";
DROP POLICY IF EXISTS "Users insert own context"  ON "ContextProfile";
DROP POLICY IF EXISTS "Users update own context"  ON "ContextProfile";
DROP POLICY IF EXISTS "Users delete own context"  ON "ContextProfile";
DROP POLICY IF EXISTS "Users manage own context"  ON "ContextProfile"; -- FOR ALL variant

CREATE POLICY "Users read own context" ON "ContextProfile"
  FOR SELECT USING (auth.uid()::text = "userId");

CREATE POLICY "Users insert own context" ON "ContextProfile"
  FOR INSERT WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "Users update own context" ON "ContextProfile"
  FOR UPDATE
  USING      (auth.uid()::text = "userId")
  WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "Users delete own context" ON "ContextProfile"
  FOR DELETE USING (auth.uid()::text = "userId");

-- ─── usage_stats: SELECT + INSERT + UPDATE only ───────────────────────────────
-- NOTE: usage_stats.id IS the user's auth UUID stored as TEXT.
-- (Confirmed by trigger in fix_1_oauth_user_trigger.sql: NEW.id::uuid cast on insert)
-- auth.uid()::text cast is required because auth.uid() returns uuid type.
-- Rename recommendation: consider renaming `id` → `user_id` in a future migration.
DROP POLICY IF EXISTS "Users read own usage"    ON usage_stats;
DROP POLICY IF EXISTS "Users insert own usage"  ON usage_stats;
DROP POLICY IF EXISTS "Users update own usage"  ON usage_stats;
DROP POLICY IF EXISTS "Users delete own usage"  ON usage_stats;
DROP POLICY IF EXISTS "Users manage own usage"  ON usage_stats; -- FOR ALL variant

CREATE POLICY "Users read own usage" ON usage_stats
  FOR SELECT USING (auth.uid()::text = id);

CREATE POLICY "Users insert own usage" ON usage_stats
  FOR INSERT WITH CHECK (auth.uid()::text = id);

CREATE POLICY "Users update own usage" ON usage_stats
  FOR UPDATE
  USING      (auth.uid()::text = id)
  WITH CHECK (auth.uid()::text = id);

-- No DELETE policy for usage_stats — quota rows should be immutable from the client.
-- Server-side admin client bypasses RLS for any legitimate admin deletions.

-- Add descriptive comment to the ambiguously named column
COMMENT ON COLUMN usage_stats.id IS
  'user_id: the Supabase auth.users UUID for this row. Acts as both PK and FK. '
  'Consider renaming to user_id in a future migration for clarity.';

-- ─── Verify ───────────────────────────────────────────────────────────────────
-- Run this to confirm the correct policies are active:
SELECT tablename, policyname, cmd
FROM   pg_policies
WHERE  tablename IN ('PromptHistory', 'ContextProfile', 'usage_stats')
ORDER  BY tablename, cmd;

-- Expected:
--  PromptHistory  | Users delete own history | DELETE
--  PromptHistory  | Users insert own history | INSERT
--  PromptHistory  | Users read own history   | SELECT
--  PromptHistory  | Users update own history | UPDATE
--  ContextProfile | Users delete own context | DELETE
--  ContextProfile | Users insert own context | INSERT
--  ContextProfile | Users read own context   | SELECT
--  ContextProfile | Users update own context | UPDATE
--  usage_stats    | Users insert own usage   | INSERT
--  usage_stats    | Users read own usage     | SELECT
--  usage_stats    | Users update own usage   | UPDATE
