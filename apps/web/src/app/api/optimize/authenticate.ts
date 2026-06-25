import { createClient } from '@supabase/supabase-js';
import { requireEnv } from '@/lib/env';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

export async function authenticateRequest(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: "Unauthorized. Missing or invalid Promptly Access Token.", status: 401 };
  }
  const token = authHeader.split(' ')[1];

  const { data: { user }, error: authError } = await getSupabaseAdmin().auth.getUser(token);
  if (authError || !user) {
    return { error: "Invalid Access Token. Please log in again at proenpt.com.", status: 401 };
  }

  const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  return { user, supabaseUserClient, supabaseAdmin: getSupabaseAdmin() };
}
