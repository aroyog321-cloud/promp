/**
 * Single source of truth for CORS-allowed origins.
 * Import this in middleware.ts and any API route that needs to set CORS headers.
 * 
 * NOTE: 'proenpt' is the canonical domain. All 'prompweb' references have been
 * removed — they were a remnant of an earlier naming iteration.
 */
export const ALLOWED_ORIGINS_LIST = [
  'https://proenpt.vercel.app',
  'https://proenpt.com',
  'https://app.proenpt.com',
] as const;

export const ALLOWED_ORIGINS_SET = new Set<string>(ALLOWED_ORIGINS_LIST);
