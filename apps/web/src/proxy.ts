import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Strict environment matrix per audit feedback
if (process.env.NODE_ENV === 'production') {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('FATAL: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be defined in production. Missing queue configuration.');
  }
}

let ratelimit: Ratelimit | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(30, '1 m'),
    analytics: true,
  });
}

// Basic in-memory rate limiter for dev fallback
const rateLimitMap = new Map<string, { count: number, resetTime: number }>();

async function checkRateLimit(ip: string): Promise<boolean> {
  if (ratelimit) {
    try {
      const { success } = await ratelimit.limit(ip);
      return success;
    } catch (e) {
      console.warn('Upstash rate limit error, falling back to memory', e);
    }
  }

  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 30;     // 30 requests per minute

  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count += 1;
  return true;
}

export default async function proxy(request: NextRequest) {
  // Only apply to /api/* routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Rate Limiting
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
  if (!(await checkRateLimit(ip))) {
    return new NextResponse(JSON.stringify({ error: "Too Many Requests" }), { 
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const ALLOWED_ORIGINS = new Set([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://proenpt.vercel.app',
    'https://proenpt.com',
    'https://app.proenpt.com',
  ]);
  
  const origin = request.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) || origin.startsWith('chrome-extension://')
    ? origin
    : 'null';

  // FIX 1.3: Only allow private network access for localhost dev origins.
  // Sending Access-Control-Allow-Private-Network: true for public domains lets
  // any malicious site reach the user's local dev server.
  const isLocalhost = origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1');

  // Handle preflight
  if (request.method === 'OPTIONS') {
    const headers: Record<string, string> = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };
    if (isLocalhost) {
      headers['Access-Control-Allow-Private-Network'] = 'true';
    }
    return new NextResponse(null, { status: 204, headers });
  }

  // For actual requests, add headers to the response
  const response = NextResponse.next();
  response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  if (isLocalhost) {
    response.headers.set('Access-Control-Allow-Private-Network', 'true');
  }
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
