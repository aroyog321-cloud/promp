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
  if (isTwoPass) {
    // Pass 1: Draft (always non-streaming)
    const draftRes = await makeGeminiCall(systemPrompt, userPrompt, false, getLevelConfig(level, false), activeApiKey, signal);
    const draftData = await draftRes.json();
    const draftText = draftData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!draftText) {
      throw new Error("Failed to generate draft in pass 1");
    }

    // Pass 2: Critique
    const critiquePrompt = `Apply this failure-mode rubric to the draft below. If any check fails, output a REVISED version that fixes the issues. If it already passes all checks, output it unchanged. Do not explain.

RUBRIC:
- ROLE: Must be a specific person with opinions, not a generic title.
- CONTEXT: Must contain concrete facts or labeled assumptions, not category descriptions.
- OBJECTIVE: Must have measurable success criteria.
- CONSTRAINTS: Must have ≥2 explicit negative (Do NOT) constraints naming specific clichés or failure modes to avoid.
- OUTPUT FORMAT: Must specify exact structure, sections, and length.
- SUCCESS CRITERIA: Must define what a high-quality output looks like to a skeptic.
${level === "expert" ? "- EDGE CASES: Must explicitly name 2-3 likely failure modes for the model to watch out for." : ""}

DRAFT:
${draftText}`;
    
    const critiqueSystemPrompt = "You are a precise editor. Apply the rubric exactly as stated. Output only the revised prompt.";
    return await makeGeminiCall(critiqueSystemPrompt, critiquePrompt, stream, getLevelConfig(level, true), activeApiKey, signal);
  } else {
    // 1-Pass
    return await makeGeminiCall(systemPrompt, userPrompt, stream, getLevelConfig(level, false), activeApiKey, signal);
  }
}
