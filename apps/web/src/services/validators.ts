import { OptimizeRequest, PromptMode, RewriteLevel, PROMPT_MODES, REWRITE_LEVELS } from '@promptly/types';

// Derive allowlists directly from the canonical type definitions.
// This ensures validators and types are always in sync.
const VALID_MODES = new Set<string>(PROMPT_MODES.map((m) => m.value));
const VALID_LEVELS = new Set<string>(REWRITE_LEVELS.map((l) => l.value));

export function validateOptimizeRequest(bodyText: string): { body: OptimizeRequest | null, error: string | null, status: number } {
  // FIX #4: Measure actual decoded byte length, not the client-supplied Content-Length header.
  // An attacker can send Content-Length: 0 with a large body to bypass the upstream check.
  const MAX_BYTES = Number(process.env.MAX_OPTIMIZE_REQUEST_BYTES ?? 65536);
  if (new TextEncoder().encode(bodyText).length > MAX_BYTES) {
    return { body: null, error: "Payload too large", status: 413 };
  }

  let body: OptimizeRequest;
  try {
    body = JSON.parse(bodyText) as OptimizeRequest;
  } catch {
    return { body: null, error: "Invalid JSON in request body", status: 400 };
  }

  if (!body.text || !body.mode || !body.level) {
    return { body: null, error: "Missing required fields", status: 400 };
  }

  // FIX #10: Validate mode and level against known allowlists to reject garbage values early.
  if (!VALID_MODES.has(body.mode)) {
    return { body: null, error: `Invalid mode '${body.mode}'`, status: 400 };
  }
  if (!VALID_LEVELS.has(body.level)) {
    return { body: null, error: `Invalid level '${body.level}'`, status: 400 };
  }

  // Strip control characters to prevent injection of \u0000 or \r\n\r\n etc.
  body.text = body.text.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '').trim();

  if (body.text.length > 8000) {
    return { body: null, error: "Prompt too long. Maximum 8,000 characters.", status: 400 };
  }

  if (body.refinement && body.refinement.length > 1000) {
    return { body: null, error: "Refinement instruction too long. Maximum 1,000 characters.", status: 400 };
  }

  if (body.context) {
    for (const [field, value] of Object.entries(body.context)) {
      if (typeof value === 'string' && value.length > 500) {
        return { body: null, error: `Context field '${field}' too long. Maximum 500 characters.`, status: 400 };
      }
    }
    if (body.context.websiteUrl) {
      try { new URL(body.context.websiteUrl); } catch {
        body.context.websiteUrl = '';
      }
    }
  }

  return { body, error: null, status: 200 };
}
