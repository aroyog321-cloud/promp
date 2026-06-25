import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { requireEnv } from './env';

const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseServiceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
