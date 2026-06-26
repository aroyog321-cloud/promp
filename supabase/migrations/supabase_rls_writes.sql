-- Drop the restrictive SELECT-only policies
DROP POLICY IF EXISTS "Users read own history" ON "PromptHistory";
DROP POLICY IF EXISTS "Users read own context" ON "ContextProfile";
DROP POLICY IF EXISTS "Users read own usage" ON usage_stats;

-- Drop the ALL policies if they exist (prevents errors on re-run)
DROP POLICY IF EXISTS "Users manage own history" ON "PromptHistory";
DROP POLICY IF EXISTS "Users manage own context" ON "ContextProfile";
DROP POLICY IF EXISTS "Users manage own usage" ON usage_stats;

-- Create policies to allow users to fully manage (SELECT, INSERT, UPDATE, DELETE) their own data
CREATE POLICY "Users manage own history" ON "PromptHistory"
  FOR ALL USING (auth.uid()::text = "userId"::text) WITH CHECK (auth.uid()::text = "userId"::text);

CREATE POLICY "Users manage own context" ON "ContextProfile"
  FOR ALL USING (auth.uid()::text = "userId"::text) WITH CHECK (auth.uid()::text = "userId"::text);

CREATE POLICY "Users manage own usage" ON usage_stats
  FOR ALL USING (auth.uid()::text = id::text) WITH CHECK (auth.uid()::text = id::text);
