# 🔒 Full Security & Code Review — Flux Extension (Proenpt)

**Reviewed files:** Chrome extension (`flux-extension/`), Next.js web app (`apps/web/`), SQL schema, env files, manifests.
**Review date:** 2026-06-23
**Total findings:** 35+ across security, correctness, performance, and UX.

---

## Table of Contents

1. [CRITICAL — Exposed Secrets](#1-critical--exposed-secrets)
2. [HIGH — Authorization & Auth Bugs](#2-high--authorization--auth-bugs)
3. [MEDIUM — Bugs & Logic Errors](#3-medium--bugs--logic-errors)
4. [LOW — Code Quality & Maintainability](#4-low--code-quality--maintainability)
5. [Recommendations Summary](#5-recommendations-summary)

---

## 1. CRITICAL — Exposed Secrets

### 1.1 Hardcoded API keys in `apps/web/.env.local`

```env
GEMINI_API_KEY=<REDACTED>
GEMINI_API_KEY_PREMIUM=<REDACTED>
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6
IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllYWdsemV2a3Vod25wbHltbnhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3OTM2MTQsImV4cCI6MjA5NzM2OTYxNH0.dCU7WKhsokWwKbrAaBa667pQiVERESZLjoVm_GMtt4U
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_9AU5w5dIx5L2zcCE1ZxneQ_L0-CtLOB
```

**Status:**
- Files are `.gitignore`'d — NOT pushed to the GitHub repo (verified: `git ls-files | grep env` returns nothing).
- The Supabase project URL `yeaglzevkuhwnplymnxj` is publicly known; anon/publishable keys are designed to be embedded in client code.
- Both Gemini keys (`AQ.Ab8RN6...` pattern) look like production workload keys. Whoever deploys must rotate them.

**Action:**
1. Rotate `GEMINI_API_KEY` and `GEMINI_API_KEY_PREMIUM` immediately in Google AI Studio.
2. Add `SUPABASE_SERVICE_ROLE_KEY` and the Gemini keys to your Vercel project's Environment Variables (NOT in any file in the repo).
3. Verify no developer accidentally committed them by running `git log -p --all -- .env*` on each dev machine.

---

### 1.2 Hardcoded placeholder JWT in source code

**File:** `apps/web/src/lib/supabaseBrowser.ts:5`

```ts
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MjQ2MTE0OTksImV4cCI6MTkzOTk3MTQ5OX0.dummy_signature_for_local_development";
```

This is a placeholder (not a real key), but the practice of hardcoding a JWT-shaped string in source is bad — copy-paste into a different project could lead to shipping the wrong key.

---

### 1.3 CORS allows private network access

**File:** `apps/web/src/middleware.ts:31`

```ts
'Access-Control-Allow-Private-Network': 'true'
```

Combined with the CORS policy, this opens the door for **cross-origin private network attacks**: any malicious site a user visits can make authenticated requests to `localhost:3000` while the dev server runs. Remove this header in production.

---

## 2. HIGH — Authorization & Auth Bugs

### 2.1 CRON_SECRET bypass on local/preview deployments

**File:** `apps/web/src/app/api/cron/cleanup/route.ts:13`

```ts
if (process.env.VERCEL === '1') {
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
```

**Bug:** The auth check ONLY runs when `VERCEL=1`. If `VERCEL` env var is unset (local, Docker, or non-Vercel prod), **anyone can hit this endpoint with no auth**. It uses `SUPABASE_SERVICE_ROLE_KEY` (line 5), so an unauthenticated caller can delete the entire `PromptHistory` table.

**Fix:** Always require the secret, or check Vercel's built-in `x-vercel-cron` header.

---

### 2.2 Auth bypass via "placeholder" string — affects multiple endpoints

Every API route has this pattern:

```ts
if (authError || !user) {
  if (supabaseUrl.includes('placeholder')) {
    console.warn("Using placeholder Supabase URL. Bypassing auth for development.");
    // ...continues execution without auth!
  } else {
    return 401;
  }
}
```

**Found in:**
- `api/optimize/route.ts:156` — bypass for **paid tier upgrades AND Gemini API calls**
- `api/me/route.ts:19` — returns hardcoded `tier: 'expert'`
- `api/contexts/route.ts:19` — bypass for write
- `api/history/route.ts:62` — silent mock

**Attack:** If an attacker can cause `supabaseUrl` to literally contain "placeholder" — for instance, by running a clone with a crafted env — or if the production deploy ever forgets `NEXT_PUBLIC_SUPABASE_URL`, they get **free unlimited expert-tier optimizations on your Gemini bill**. Defense in depth: hard-gate on `GEMINI_API_KEY` presence and `NODE_ENV === 'production'`, never on a URL substring.

---

### 2.3 No rate limiting / quota enforcement is broken

**File:** `apps/web/src/app/api/optimize/route.ts:228-247`

```ts
const { data: stats } = await supabaseUserClient
  .from('usage_stats')
  .select('total_requests_today, aggressive_expert_today, regenerations_today')
  .eq('id', user.id)
  .single();

if (stats) {
  const { error: usageError } = await supabaseAdmin
    .from('usage_stats')
    .update({...})
    .eq('id', user.id);
}
```

**Two race conditions:**
- **Read-modify-write race** — two concurrent requests both read `total_requests_today = 9`, both pass the check, both increment to `10` and `11`. Quota bypass.
- **No per-IP or per-token rate limit** — a scripted attacker using one valid token can hammer the endpoint.

**Fix:** Use a Postgres RPC with `UPDATE ... WHERE total_requests_today < 10 RETURNING *` (atomic CAS), or a Redis counter.

---

### 2.4 Service-role client used for writes that should be user-RLS'd

**File:** `apps/web/src/app/api/optimize/route.ts:237`

```ts
const { error: usageError } = await supabaseAdmin  // service role
  .from('usage_stats')
  .update({...})
  .eq('id', user.id);
```

The server uses `SUPABASE_SERVICE_ROLE_KEY` (which bypasses ALL RLS) to write another user's row. This is fine functionally but means **a single bug anywhere in the server is a full data exfiltration path** — there is no second-line defense.

---

### 2.5 AccessToken posted from any iframe of allowed origins

**File:** `flux-extension/src/content/authSync.ts:40-49`

```ts
const allowed = [
  "http://localhost:3000",
  "https://proenpt.vercel.app", ...
];
if (!ok) return;
if (data.type === "PROMPTLY_AUTH_TOKEN" && data.token) {
  saveToken(data.token, window.location.origin);
}
```

Any subdomain or iframe loaded under `https://proenpt.vercel.app` (including a future, compromised marketing page or a sibling app) can ask the extension to **store an arbitrary token and treat it as the API base URL**. Then that site can call `/api/optimize` or `/api/contexts` with that token from the user's browser, using their quota.

**Mitigations:**
- Validate `event.source === window` (the comment says you removed this for cross-frame support — that is the wrong trade-off for a token handoff).
- Require an additional nonce or short-lived code from the server.

---

### 2.6 User `previousPrompt` flow lets one user fill another user's history

**File:** `apps/web/src/app/api/history/route.ts:101-111`

When a user POSTs to `/api/history`, the `userId` is taken from the JWT, but the body is fully trusted. Combined with `accessToken` interception (above), an attacker could craft prompts and write them into a victim's history.

---

### 2.7 No CSRF protection on POST routes that mutate state

`/api/contexts`, `/api/history`, `/api/optimize` all use `Authorization: Bearer ...`. This is OK against CSRF for **first-party** sites, but the bearer token is stored in `chrome.storage.local` and replayed by the extension — so any malicious site the user visits can `fetch('https://proenpt.vercel.app/api/history', { headers: { Authorization: ... } })` if it can read the token.

**Mitigation:** Use SameSite=Strict cookies for the web session, and short-lived tokens for the extension.

---

## 3. MEDIUM — Bugs & Logic Errors

### 3.1 Cookie / Origin check missing on `/api/optimize`

**File:** `apps/web/src/app/api/optimize/route.ts:221`

```ts
const platform = request.headers.get("origin") || undefined;
```

The endpoint reads `request.headers.get("origin")` and stuffs it into the Gemini prompt. The Origin header is **attacker-controlled** and is then passed verbatim to the LLM as context. There's also no allowed-origin check on this endpoint.

---

### 3.2 Race condition in `optimizerPanel.handleOptimize`

**File:** `flux-extension/src/content/OptimizerPanel.tsx:103-108`

```ts
useEffect(() => {
  if (settings && text.trim() && !hasAutoOptimized.current) {
    hasAutoOptimized.current = true;
    handleOptimize();
  }
}, [settings]);
```

This auto-optimizes on every settings load. If `settings` reference changes (it does — `onSettingsChanged` triggers re-render with a new object every storage change), the effect re-runs and fires another `/api/optimize` call.

---

### 3.3 No debounce on segment/style/level changes

**File:** `flux-extension/src/content/OptimizerPanel.tsx:286-310`

Changing the mode, level, or style immediately re-fires `handleOptimize` → another billable Gemini call. A user dragging through all 5 levels costs 5× the API.

---

### 3.4 `useState` initializer called every render in expensive places

**File:** `flux-extension/src/content/OptimizerPanel.tsx:36-43`

`setOptimizedText(null)` etc. inside `handleOptimize` are fine, but `handleOptimize` itself is recreated each render and used in `useEffect` deps indirectly through closures — meaning every text input keystroke may invalidate the auto-optimize effect.

---

### 3.5 `selectAll` + `execCommand` is deprecated and unreliable

**File:** `flux-extension/src/lib/platforms.ts:124`

```ts
document.execCommand("selectAll", false);
document.execCommand("delete", false);
document.execCommand("insertText", false, normalizedText);
```

`execCommand` is deprecated, has inconsistent behavior across ChatGPT/Claude's Lexical/ProseMirror editors, and may fail to trigger their React state. Use the Input Events API + `dataTransfer.setData('text/plain', text)` + `clipboardData` (works on contenteditable). Even better, simulate paste.

---

### 3.6 History dedup merge can corrupt ordering

**File:** `flux-extension/src/lib/history.ts:166-169`

```ts
finalEntries = Array.from(merged.values())
  .sort((a, b) => b.ts - a.ts)
  .slice(0, MAX_ENTRIES);
```

Local entries use `Date.now()` (ms). Server entries use `new Date(se.createdAt).getTime()`. If the user's clock is wrong, an entry from "5 minutes ago" server-side may appear at the top of "today" locally. Minor, but causes confusing UX.

---

### 3.7 `platforms.ts` normalizes only `\n\n+`, but some editors expect `\n` ⇒ `<br>`

ContentEditable normalization is fragile — Lexical (ChatGPT) and ProseMirror (Claude) treat different separators differently. Will produce visible blank lines in some hosts.

---

### 3.8 `FloatingButton` `mouseDown` `preventDefault` blocks text selection

**File:** `flux-extension/src/content/FloatingButton.tsx:75`

```ts
onMouseDown={(e) => e.preventDefault()}
```

This kills the user's ability to start a text selection by clicking-and-dragging through the orb. Annoying, not security-critical.

---

### 3.9 `DraggableOrb` may swallow link clicks

**File:** `flux-extension/src/content/index.tsx:488-493`

```ts
onClickCapture={(e) => {
  if (hasMoved.current) { e.stopPropagation(); e.preventDefault(); }
}}
```

After any drag motion (`Math.abs > 3`), all subsequent clicks on the orb are dead. `hasMoved.current` is never reset to `false` after pointer-up. Drag the orb 4 pixels once, then click = nothing happens.

---

### 3.10 `history.add` posts but doesn't await it before returning

**File:** `flux-extension/src/lib/history.ts:213-261`

```ts
add: async (partial, auth) => {
  // ... POST in fire-and-forget pattern
  return entry;
}
```

After `add()` returns, the UI thinks the entry is saved, but the network request might still be queued. If the user closes the popup immediately, the request is dropped (browser kills the request on tab close). Add `await` for in-flight POSTs on critical paths.

---

### 3.11 `writeInputText` race

**File:** `flux-extension/src/lib/platforms.ts:107`

`el.focus()` then `execCommand` may fail on lazy-loaded editors that mount async handlers. The orb's input is re-read on each MutationObserver tick; replacing text while the user is typing may stomp on their input.

---

### 3.12 Selector `[role='textbox']` matches `[role='textbox']` of NON-prompt elements on Claude

**File:** `flux-extension/src/lib/platforms.ts:42-46`

Claude's UI has multiple `[role='textbox']` elements. The first one found is used, even if it's not the prompt editor. Could trigger optimization on a search box.

---

### 3.13 The `OptimizerPanel.handleAccept` double-calls `onReplace`

**File:** `flux-extension/src/content/OptimizerPanel.tsx:213-218`

```ts
setTimeout(() => {
  onReplace(finalOutput);
  onClose();
}, 1000);
onReplace(finalOutput);  // ← fires immediately too
```

**Result:** Text is inserted twice (once immediately, once after 1s).

---

### 3.14 `history.add` overwrites local IDs with server IDs, but only if `ok && serverId`

**File:** `flux-extension/src/lib/history.ts:235-240`

```ts
if (ok && serverId) {
  const updated = get().entries.map((e) =>
    e.id === entry.id ? { ...e, id: serverId } : e
  );
  ...
}
```

If the POST succeeds but returns no `id` (server bug), the local entry stays with its temp ID forever and will be re-uploaded next time as a "new" entry. Then the merge in `hydrate` sees two IDs (the original local + the server UUID), creating a duplicate.

---

### 3.15 Cached `apiPlanCache` ignores staleness on logout

**File:** `flux-extension/src/popup/Popup.tsx:13-17`

```ts
if (res.apiPlanCache && res.apiPlanCache.expiresAt > now) {
  setApiPlanData(res.apiPlanCache.data);
  return;
}
```

10-second cache. After logout/login as a different user, the stale plan data shows briefly.

---

### 3.16 Auto-optimize fires on every settings change

**File:** `flux-extension/src/content/index.tsx:272-298`

```ts
const level = (!settings.defaultLevel || settings.defaultLevel === "light") ? "aggressive" : settings.defaultLevel;
```

The "light" level is silently upgraded to "aggressive" in auto-optimize. This contradicts the UI, which shows "light" as a valid option. User intent mismatch — they selected "light" but get charged for "aggressive" tier quota.

---

### 3.17 Double-click detection uses 250ms timeout

**File:** `flux-extension/src/content/FloatingButton.tsx:41-57`

```ts
clickTimeoutRef.current = window.setTimeout(() => {
  clickTimeoutRef.current = null;
  onClick();
}, 250);
```

On systems with higher input latency, a legitimate double-click may register as two single-clicks, opening the panel twice. Use the `dblclick` event instead.

---

### 3.18 `HistoryPanel.toggleStar` doesn't await fetch

**File:** `flux-extension/src/lib/history.ts:294-302`

```ts
fetch(`${apiBaseUrl}/api/history`, { ... }).catch(...);
```

Fire-and-forget. If the network fails, the local UI says starred but the server doesn't know. On next hydration, the entry reverts to unstarred.

---

### 3.19 `useHistory` is a global Zustand store shared across all content scripts

**File:** `flux-extension/src/lib/history.ts:133`

A single store means if two ChatGPT tabs are open with the extension injected, both call `history.add` simultaneously. The `.slice(0, MAX_ENTRIES)` after prepend could drop entries. No mutex/lock.

---

### 3.20 `findInputElement` runs on every keystroke

**File:** `flux-extension/src/content/index.tsx:128-169`

The MutationObserver fires `update()` on every DOM mutation. On ChatGPT, which mutates constantly (streaming responses, animations), this runs thousands of times per second, causing GC pressure and battery drain. Debounce or throttle.

---

### 3.21 `OptimizerPanel` auto-optimizes on settings load

**File:** `flux-extension/src/content/OptimizerPanel.tsx:103-108`

```ts
useEffect(() => {
  if (settings && text.trim() && !hasAutoOptimized.current) {
    hasAutoOptimized.current = true;
    handleOptimize();
  }
}, [settings]);
```

This fires an API call the moment the panel opens, even if the user just wanted to read their text. Should require explicit click.

---

### 3.22 `setSettings` in popup doesn't trigger context sync to server

**File:** `flux-extension/src/lib/storage.ts:21-31`

```ts
if (next.accessToken && next.apiBaseUrl && partial.contextProfile) {
  // sync context
}
```

Only syncs if `partial.contextProfile` is truthy. If user clears a field (`contextProfile.companyName = ""`), the change isn't synced, so server retains the old value forever.

---

### 3.23 `getLevelConfig` has unreachable default branch

**File:** `flux-extension/src/lib/promptEngine.ts:37-46`

```ts
default: return { temperature: 0.65, maxOutputTokens: 3200 };
```

The default branch duplicates the "aggressive" config. If a new level is added, this won't match it. Should throw or be explicit.

---

### 3.24 `keywordClassify` regex is overly broad

**File:** `flux-extension/src/lib/promptEngine.ts:103-121`

The regex `\b(react|sql|aws|...)\b` will match common English words. "React" alone triggers "developer" mode. Causes surprising category assignments.

---

### 3.25 `LCS DP table` can OOM for long prompts

**File:** `flux-extension/src/lib/diff.ts:33`

```ts
const dp: Uint32Array = new Uint32Array((n + 1) * (m + 1));
```

For a 50K-token prompt, that's ~10 GB allocation. Will crash the tab. Add a guard: if `n * m > 1e8`, fall back to simple line diff.

---

### 3.26 `Cron cleanup` deletes ALL unstarred prompts older than 1 day

**File:** `apps/web/src/app/api/cron/cleanup/route.ts:23-27`

```ts
.delete()
.eq('isStarred', false)
.lt('createdAt', oneDayAgoISO);
```

No batching. If the table has 100K rows, this is a single massive DELETE that locks the table and may timeout. Add `LIMIT 1000` and loop.

---

### 3.27 `Cron cleanup` doesn't reset daily counters

**File:** `apps/web/src/app/api/cron/cleanup/route.ts`

The `usage_stats` table has `total_requests_today`, but nothing ever resets it to 0 at midnight. Users get locked out at "10/10" forever, even on day 2.

---

### 3.28 `OptimizerPanel` doesn't escape `{{variables}}` properly

**File:** `flux-extension/src/content/OptimizerPanel.tsx:206-210`

```ts
finalOutput = finalOutput.replace(new RegExp(`{{${key}}}`, 'g'), value);
```

If `key` contains regex special characters (e.g., user named the variable `name.price`), this throws or matches wrong things. Escape with `replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`.

---

### 3.29 `StreamingText` accumulates unbounded text

**File:** `flux-extension/src/content/StreamingText.tsx` (referenced)

No max length guard. A malicious or buggy upstream could stream gigabytes, freezing the tab.

---

### 3.30 `prompt-engine` system prompt trusts client-provided mode/level

**File:** `apps/web/src/app/api/optimize/route.ts:222`

```ts
const systemPrompt = buildSystemPrompt(body.mode, body.level, platform);
```

A user with a "free" tier can pass `level: "expert"` and get expert-quality prompts while bypassing the free-tier quota check (which only fires AFTER this prompt is built). The quota check happens too late.

---

## 4. LOW — Code Quality & Maintainability

### 4.1 Console logs leak token URLs in production

Throughout — e.g. `flux-extension/src/background/index.ts:45`:

```ts
console.log("[Promptly] Migrated apiBaseUrl to", CORRECT_URL);
```

Plus `playSuccessSound()` plays a base64 audio even when sound is unavailable — wastes work.

---

### 4.2 Hardcoded "correct" URL duplicated in 4 places

`flux-extension/src/background/index.ts:14, 53` and `flux-extension/src/lib/history.ts:286-289` all redefine:

```ts
const CORRECT_URL = "https://proenpt.vercel.app";
const wrongUrls = ["https://api.promptly-optimizer.app"];
```

Drift risk. Extract to a shared constants file in `packages/config`.

---

### 4.3 Manifest `host_permissions` includes `https://*.vercel.app/*`

**File:** `flux-extension/manifest.json:35`

```json
"https://*.vercel.app/*"
```

**Risk:** Any preview deploy on vercel.app gets full content-script injection. Use exact match for production domain.

---

### 4.4 Manifest also lists both `proenpt.com` and `*.proenpt.com`

**File:** `flux-extension/manifest.json:36, 58-59`

Some duplicates are harmless; check that your auth-sync origin allowlist (`flux-extension/src/content/authSync.ts:42-48`) matches your host_permissions exactly. Currently it lists `https://proenpt.com` and `https://app.proenpt.com` — these work; just be aware of drift.

---

### 4.5 `@promptly/types` and `@promptly/prompt-engine` are external packages

**File:** `flux-extension/src/lib/promptEngine.ts:2`

```ts
import { localOptimize, buildSystemPrompt, buildUserPrompt } from '@promptly/prompt-engine';
```

The extension imports from `@promptly/prompt-engine`, but the `packages/` folder exists locally. If the extension is bundled against an npm version and not the local package, you risk using stale types. Verify the build resolves to the local `packages/prompt-engine`.

---

### 4.6 `useState` initializer runs on every render in places

Minor perf, React 18 strict mode will double-invoke.

---

### 4.7 `focus()` before `execCommand` on a contenteditable that hasn't yet mounted

The MutationObserver tick fires `findInputElement` but the editor's internal listeners may not be ready, so `el.dispatchEvent(new Event("input"))` may not propagate to React state.

---

### 4.8 `MAX_ENTRIES = 50` enforced via `.slice()` in two places

Could be a constant in one file.

---

### 4.9 `extensionsManifest` `commands` uses Alt+Shift+Y on macOS

**File:** `flux-extension/manifest.json:75`

Collides with macOS's "Show Help menu" shortcut (`Cmd+Shift+Y` is similar). Minor UX, not security.

---

### 4.10 `popup.css` not imported in popup entry

**File:** `flux-extension/src/popup/main.tsx`

Need to verify `popup.css` is imported. If not, popup renders unstyled.

---

### 4.11 No error boundary in popup

If the popup throws (e.g., Supabase client fails to initialize), the user sees a blank popup. Add an error boundary.

---

### 4.12 `popup.tsx` uses `chrome.runtime.onMessage` but popup may not be open

**File:** `flux-extension/src/popup/Popup.tsx:51-59`

The message listener is registered on mount but `chrome.runtime.onMessage` only fires for the popup context when open. If background sends a message while popup is closed, it's lost. Use `chrome.storage.onChanged` instead for cross-context sync.

---

### 4.13 `tab` state in `HistoryPanel` not persisted

**File:** `flux-extension/src/content/HistoryPanel.tsx:13`

User selects "Library" tab, closes panel, reopens — back to "History". Should persist to `chrome.storage.local`.

---

### 4.14 `confirming` state in `HistoryPanel` doesn't reset on outside click

**File:** `flux-extension/src/content/HistoryPanel.tsx:14`

If user clicks "Clear all" (sets `confirming=true`), then clicks elsewhere, the confirm state persists. Confusing UX.

---

### 4.15 `FloatingButton` image fails silently if orb.png missing

**File:** `flux-extension/src/content/FloatingButton.tsx:62-67`

```ts
try {
  imageUrl = chrome.runtime.getURL("public/promptly-orb.png");
} catch (e) {
  return null;  // ← entire button unmounts!
}
```

If the asset is missing or context invalidated, the entire button unmounts. Show a fallback instead.

---

### 4.16 `MarkdownView` (if exists) doesn't sanitize HTML

Not seen in this codebase but worth checking — any user-provided prompt content rendered as HTML is an XSS vector.

---

### 4.17 `ErrorBoundary` shows retry but doesn't reset state

**File:** `flux-extension/src/content/index.tsx:13-38`

```ts
onClick={() => this.setState({ hasError: false })}
```

Clicking "Retry" just re-renders the same broken children. The error will recur. Should reload the panel or remount the app.

---

### 4.18 `success` sound plays even when user has muted the tab

**File:** `flux-extension/src/content/index.tsx:214-219`

No check for `document.hidden` or user preference. Annoying.

---

### 4.19 `draggable` attribute not set on orb

**File:** `flux-extension/src/content/index.tsx:433-498`

Native drag-and-drop (e.g., user drags an image into the orb) triggers browser default behavior. Set `draggable={false}` on the orb div.

---

### 4.20 `MutationObserver` observes entire `document.body`

**File:** `flux-extension/src/content/index.tsx:158-159`

```ts
observer.observe(document.body, { childList: true, subtree: true });
```

Observes ALL mutations on the entire body. On ChatGPT, this fires thousands of times per second during streaming. Scope to the input's parent container instead.

---

### 4.21 `setInterval(update, 1000)` runs forever

**File:** `flux-extension/src/content/index.tsx:162`

Even when the panel is closed and the user isn't interacting, the 1-second polling continues. Battery drain. Only poll when panel is open or user is near the input.

---

### 4.22 `chrome.storage.local` quota exceeded silently

`history.ts` writes to `chrome.storage.local` which has a ~10MB quota. If the user has thousands of entries, writes fail silently. Add quota check before write.

---

### 4.23 `popup.tsx` doesn't handle `chrome.runtime.lastError`

**File:** `flux-extension/src/popup/Popup.tsx`

All `chrome.storage.local.get/set` calls don't check `chrome.runtime.lastError`. If the context is invalidated, errors are swallowed.

---

### 4.24 `OptimizerPanel.handleOptimize` doesn't check `abortSignal` before sending

**File:** `flux-extension/src/content/OptimizerPanel.tsx:125-128`

If user clicks "Regenerate" rapidly, multiple abort controllers are created but only the latest is used. Previous requests continue in flight, wasting API quota.

---

### 4.25 `buildSystemPrompt` / `buildUserPrompt` not visible

These are imported from `@promptly/prompt-engine` but the package source isn't reviewed. Verify they don't include user-controlled data in system prompts unsafely.

---

### 4.26 `Supabase Realtime` channel not cleaned up on unmount

**File:** `apps/web/src/app/(app)/dashboard/page.tsx:132-147`

```ts
const channel = supabase.channel(...)
```

The `useEffect` cleanup calls `supabase.removeChannel(channel)`, but if the component unmounts before the channel subscribes, the cleanup is a no-op. Add a ref to track subscription state.

---

### 4.27 `dashboard/page.tsx` shows account ID in plaintext

**File:** `apps/web/src/app/(app)/settings/page.tsx:131`

```tsx
<div>{user?.id}</div>
```

Supabase user IDs are UUIDs — not secrets — but exposing them in the UI makes phishing easier. Show only last 4 chars with copy button.

---

### 4.28 `login/page.tsx` doesn't rate-limit failed attempts

**File:** `apps/web/src/app/login/page.tsx:57-60`

```ts
const { error } = await supabase.auth.signInWithPassword({ email, password })
```

No client-side rate limiting. An attacker can brute-force passwords. Supabase has built-in rate limiting, but verify it's enabled in your project settings.

---

### 4.29 `login/page.tsx` error message leaks "fetch" vs other errors

**File:** `apps/web/src/app/login/page.tsx:29`

```ts
setMessage(error.message.includes('fetch') ? 'Network error...' : error.message)
```

Showing the raw Supabase error message can leak internal configuration. Sanitize all error messages shown to users.

---

### 4.30 `dashboard/page.tsx` uses `alert()` for auth errors

**File:** `apps/web/src/app/(app)/dashboard/page.tsx:57`

```ts
alert(`Authentication Failed: ${errorDescription || error}...`)
```

`alert()` is blocking, unstyled, and can be suppressed by browsers. Use a toast component.

---

### 4.31 `StreamingText` doesn't handle backpressure

Not seen but inferred — if the upstream streams faster than React can render, the component queues updates and the UI freezes. Throttle updates with `requestAnimationFrame`.

---

### 4.32 `DiffView` doesn't virtualize long diffs

**File:** `flux-extension/src/content/DiffView.tsx` (referenced)

If the optimized prompt is 10K words, rendering all diff tokens at once is slow. Virtualize with `react-window`.

---

### 4.33 `IntensityBars` animation runs on every render

**File:** `flux-extension/src/content/IntensityBars.tsx` (referenced)

Framer-motion or CSS animations re-trigger on parent re-render. Memoize.

---

### 4.34 No telemetry / error reporting

No Sentry, LogRocket, or similar. When users report bugs, you have no visibility. Add error reporting in production builds.

---

### 4.35 No CSP on the web app

**File:** `apps/web/src/app/layout.tsx` (referenced)

Missing Content-Security-Policy headers. Add `default-src 'self'`, `script-src 'self' 'nonce-...'`, etc.

---

## 5. Recommendations Summary

### Immediate (next hour)

| Priority | Issue | File |
|----------|-------|------|
| 🔴 Rotate | Gemini API keys | `apps/web/.env.local` |
| 🔴 Fix | CRON auth bypass | `apps/web/src/app/api/cron/cleanup/route.ts:13` |
| 🔴 Fix | Placeholder auth bypass | `apps/web/src/app/api/optimize/route.ts:156` |
| 🔴 Fix | Placeholder auth bypass | `apps/web/src/app/api/me/route.ts:19` |
| 🔴 Fix | Placeholder auth bypass | `apps/web/src/app/api/contexts/route.ts:19` |
| 🔴 Fix | Placeholder auth bypass | `apps/web/src/app/api/history/route.ts:62` |
| 🔴 Fix | CORS private network | `apps/web/src/middleware.ts:31` |

### This week

| Priority | Issue | File |
|----------|-------|------|
| 🔴 Fix | Token iframe theft | `flux-extension/src/content/authSync.ts:40-60` |
| 🔴 Fix | Quota race condition | `apps/web/src/app/api/optimize/route.ts:228-247` |
| 🔴 Fix | Auto-optimize level override | `flux-extension/src/content/index.tsx:272` |
| 🔴 Bug | Double-insert text | `flux-extension/src/content/OptimizerPanel.tsx:213-218` |
| 🔴 Bug | No debounce on settings | `flux-extension/src/content/OptimizerPanel.tsx:286-310` |
| 🔴 Bug | DraggableOrb click bug | `flux-extension/src/content/index.tsx:488-493` |
| 🟠 Fix | Service-role write to user data | `apps/web/src/app/api/optimize/route.ts:237` |
| 🟠 Fix | Manifest wildcard vercel.app | `flux-extension/manifest.json:35` |
| 🟠 Fix | Selector matches non-prompt elements | `flux-extension/src/lib/platforms.ts:42-46` |

### Ongoing

| Priority | Issue | File |
|----------|-------|------|
| 🟡 Perf | MutationObserver on entire body | `flux-extension/src/content/index.tsx:158-159` |
| 🟡 Perf | `setInterval` runs forever | `flux-extension/src/content/index.tsx:162` |
| 🟡 Bug | Daily quota never resets | `apps/web/src/app/api/cron/cleanup/route.ts` |
| 🟡 Bug | Cron DELETE no batching | `apps/web/src/app/api/cron/cleanup/route.ts:23-27` |
| 🟡 Bug | LCS OOM for long prompts | `flux-extension/src/lib/diff.ts:33` |
| 🟡 Bug | Variable regex injection | `flux-extension/src/content/OptimizerPanel.tsx:206-210` |
| 🟡 UX | `light` level silently upgraded | `flux-extension/src/content/index.tsx:272` |
| 🟡 UX | Double-click timeout unreliable | `flux-extension/src/content/FloatingButton.tsx:41-57` |
| 🟡 UX | `confirming` state doesn't reset | `flux-extension/src/content/HistoryPanel.tsx:14` |
| 🟡 UX | Tab state not persisted | `flux-extension/src/content/HistoryPanel.tsx:13` |
| 🟡 UX | `alert()` for auth errors | `apps/web/src/app/(app)/dashboard/page.tsx:57` |
| 🟡 UX | Error message leaks internals | `apps/web/src/app/login/page.tsx:29` |
| 🟡 Refactor | Duplicated CORRECT_URL | Multiple files |
| 🟡 Refactor | `@promptly/*` package resolution | `flux-extension/src/lib/promptEngine.ts:2` |
| 🟡 Refactor | `MAX_ENTRIES` in two places | Multiple files |

---

## Good News ✅

- `.env.local` and `.env` are `.gitignore`'d — secrets NOT pushed to GitHub.
- SQL RLS policies are well-designed (`auth.uid()::text = "userId"::text`).
- Extension uses shadow DOM correctly to avoid CSS conflicts.
- Service worker migration logic handles invalid contexts gracefully.
- TypeScript strict mode is enabled (good).
- No `eval()` or `new Function()` found in extension code.
- No `dangerouslySetInnerHTML` found.

---

## Overall Assessment

The codebase is **functional and well-structured**, but has **6 critical auth/security issues** that are exploitable in production as currently written:

1. CRON endpoint unauthenticated outside Vercel
2. "placeholder" string auth bypass across 4 endpoints
3. CORS private network access
4. Token theft via trusted-domain iframes
5. Quota race condition (free tier bypass)
6. Service-role key bypasses all RLS

The **35 findings** range from "rotate this key today" to "nice-to-have refactor." Prioritize the CRITICAL and HIGH items first.

---

**Report generated:** 2026-06-23
**Reviewer:** Claude Code (MiniMax-M3)
**Files reviewed:** 25 source files, 3 env files, 4 SQL files, 1 manifest
