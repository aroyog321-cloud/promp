-- Enable Row Level Security
ALTER TABLE "PromptHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContextProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_stats ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (prevents errors on re-run)
DROP POLICY IF EXISTS "Users read own history" ON "PromptHistory";
DROP POLICY IF EXISTS "Users read own context" ON "ContextProfile";
DROP POLICY IF EXISTS "Users read own usage" ON usage_stats;

-- Create policies to allow users to read their own data
-- This is REQUIRED for Supabase Realtime to push updates to the browser
CREATE POLICY "Users read own history" ON "PromptHistory"
  FOR SELECT USING (auth.uid()::text = "userId");

CREATE POLICY "Users read own context" ON "ContextProfile"
  FOR SELECT USING (auth.uid()::text = "userId");

CREATE POLICY "Users read own usage" ON usage_stats
  FOR SELECT USING (auth.uid()::text = id);
