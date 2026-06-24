import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Basic in-memory rate limiter for Edge/Serverless environments
const rateLimitMap = new Map<string, { count: number, resetTime: number }>();

function checkRateLimit(ip: string): boolean {
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

export function middleware(request: NextRequest) {
  // Only apply to /api/* routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Rate Limiting
  const ip = request.headers.get('x-forwarded-for') || request.ip || '127.0.0.1';
  if (!checkRateLimit(ip)) {
    return new NextResponse(JSON.stringify({ error: "Too Many Requests" }), { 
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const origin = request.headers.get('origin') || '';
  
  // The API is consumed by a Chrome extension content script which can be injected 
  // into any webpage (chatgpt.com, claude.ai, etc.). Thus, we must allow any origin.
  // Using 'null' instead of '*' satisfies the spec when Credentials are true.
  const allowedOrigin = origin || 'null';

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
