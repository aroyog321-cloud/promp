import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  // FIX 1.2: Never hardcode a JWT-shaped fallback in source code.
  // If the env var is missing the client will be misconfigured; fail loudly in dev.
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!supabaseKey && process.env.NODE_ENV === 'development') {
    console.warn("[Promptly] NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Supabase client will not work.");
  }

  return createBrowserClient(
    supabaseUrl,
    supabaseKey
  )
}
