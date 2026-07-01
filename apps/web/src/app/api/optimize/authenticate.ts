import { createClient } from '@supabase/supabase-js';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
// SUPABASE_JWT_SECRET is available in Supabase > Project Settings > API > JWT Secret
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

/**
 * Fast local JWT verification using the Supabase JWT secret.
 * Zero network calls — completes in ~1ms.
 * Falls back to Supabase admin.auth.getUser() only if the secret is not configured.
 */
async function verifyJwtLocal(token: string): Promise<{ id: string; email?: string } | null> {
  if (!JWT_SECRET) return null; // secret not configured → fall through to network verify

  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });

    // Supabase JWTs have `sub` as the user UUID and optional `email`
    if (!payload.sub) return null;

    // Check expiry (jwtVerify already does this, but be explicit)
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;

    return { id: payload.sub, email: payload.email as string | undefined };
  } catch {
    return null; // invalid signature or expired
  }
}

export async function authenticateRequest(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: "Unauthorized. Please log in at proenpt.vercel.app to use the extension.", status: 401 };
  }
  const token = authHeader.split(' ')[1];

  // ── Fast path: local JWT verification (no network) ────────────────────
  const localUser = await verifyJwtLocal(token);
  if (localUser) {
    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    return { user: localUser, supabaseUserClient, supabaseAdmin: getSupabaseAdmin() };
  }

  // ── Slow path: network verify via Supabase admin (fallback) ───────────
  // Used when SUPABASE_JWT_SECRET is not set, or when the local check fails
  // (e.g. a token issued with a rotated secret).
  const { data: { user }, error: authError } = await getSupabaseAdmin().auth.getUser(token);
  if (authError || !user) {
    return { error: "Invalid or expired session. Please log in again at proenpt.vercel.app.", status: 401 };
  }

  const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  return { user, supabaseUserClient, supabaseAdmin: getSupabaseAdmin() };
}
