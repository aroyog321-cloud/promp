import { getLevelConfig } from '@promptly/prompt-engine';
import { makeGeminiCall } from '@/services/ai';

export async function executeOptimization(
  systemPrompt: string,
  userPrompt: string,
  level: string,
  isTwoPass: boolean,
  activeApiKey: string,
  stream: boolean,
  signal?: AbortSignal
) {
  if (!isTwoPass) {
    // Single-pass — fast path
    return makeGeminiCall(systemPrompt, userPrompt, stream, getLevelConfig(level, false), activeApiKey, signal);
  }

  // ── Two-pass: Draft → Critique ────────────────────────────────────────────
  // Pass 1 is always non-streaming (we need the full draft text for Pass 2).
  let draftText: string | null = null;

  try {
    const draftRes = await makeGeminiCall(
      systemPrompt,
      userPrompt,
      false,                        // non-streaming
      getLevelConfig(level, false),
      activeApiKey,
      signal
    );
    const draftData = await draftRes.json();
    const candidate = draftData.candidates?.[0];

    // Gemini can return a candidate with finishReason=SAFETY and no content.
    // Treat any empty or blocked response as a signal to fall back gracefully.
    draftText = candidate?.content?.parts?.[0]?.text?.trim() ?? null;

    if (!draftText) {
      const finishReason = candidate?.finishReason ?? 'UNKNOWN';
      console.warn(
        `[Promptly] Two-pass draft returned empty (finishReason=${finishReason}). ` +
        'Falling back to single-pass rather than returning 500.'
      );
      // Graceful fallback: run single-pass instead of throwing a hard 500.
      return makeGeminiCall(systemPrompt, userPrompt, stream, getLevelConfig(level, false), activeApiKey, signal);
    }
  } catch (err) {
    // If Pass 1 itself fails (network error, timeout, quota), fall back to
    // single-pass rather than surfacing a 500 to the user.
    console.warn('[Promptly] Two-pass Pass 1 threw — falling back to single-pass:', err);
    return makeGeminiCall(systemPrompt, userPrompt, stream, getLevelConfig(level, false), activeApiKey, signal);
  }

  // Pass 2: Critique / Refinement
  const critiquePrompt =
    `Apply this failure-mode rubric to the draft below. If any check fails, output a REVISED version that fixes the issues. ` +
    `If it already passes all checks, output it unchanged. Do not explain.\n\n` +
    `RUBRIC:\n` +
    `- ROLE: Must be a specific person with opinions, not a generic title.\n` +
    `- CONTEXT: Must contain concrete facts or labeled assumptions, not category descriptions.\n` +
    `- OBJECTIVE: Must have measurable success criteria.\n` +
    `- CONSTRAINTS: Must have ≥2 explicit negative (Do NOT) constraints naming specific clichés or failure modes to avoid.\n` +
    `- OUTPUT FORMAT: Must specify exact structure, sections, and length.\n` +
    `- SUCCESS CRITERIA: Must define what a high-quality output looks like to a skeptic.\n` +
    (level === 'Staff+' || level === 'Production Audit'
      ? '- EDGE CASES: Must explicitly name 2-3 likely failure modes for the model to watch out for.\n'
      : '') +
    `\nDRAFT:\n${draftText}`;

  const critiqueSystem = 'You are a precise editor. Apply the rubric exactly as stated. Output only the revised prompt.';

  return makeGeminiCall(
    critiqueSystem,
    critiquePrompt,
    stream,
    getLevelConfig(level, true),
    activeApiKey,
    signal
  );
}
