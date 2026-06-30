import { OptimizeRequest } from "@promptly/types";
import { STYLE_GUIDELINES } from "./modeRecipes";
import { LEVEL_CONFIGS } from "./levelConfigs";
import { contextLine, stripPoliteness, detectIntentSignals } from "./utils";

export function buildUserPrompt(req: OptimizeRequest): string {
  const { text, level, style, context, refinement, previousPrompt } = req;
  const rawText = stripPoliteness(text.trim());
  const signals = detectIntentSignals(rawText);
  const levelConfig = LEVEL_CONFIGS[level];

  // ── REFINEMENT FLOW ────────────────────────────────────────────────────────
  if (previousPrompt) {
    return `You are refining an existing generated prompt based on user feedback.

<original_user_input>
${rawText}
</original_user_input>

<current_prompt>
${previousPrompt}
</current_prompt>

<user_feedback>
${refinement}
</user_feedback>

Apply the feedback to improve the current prompt. Output only the revised prompt using the same format (Act as... Requirements... Output...). Then add the footer: "---\\nPrompt Strength: [X]/10 → [Y]/10"
`;
  }

  // ── STANDARD FLOW ─────────────────────────────────────────────────────────
  // Context memory: prominently surfaced so the system prompt can reference it
  const contextBlock = context ? contextLine(context) : "";
  const styleGuideline = STYLE_GUIDELINES[style] || STYLE_GUIDELINES.neutral;
  const depth = levelConfig?.reasoningDepth ?? 3;

  let userPrompt = `<user_input>
${rawText}
</user_input>

INTENSITY: ${level} (reasoning depth ${depth}/5)
STYLE TARGET: ${styleGuideline}
`;

  // Context memory — promoted to its own block with explicit instructions
  if (contextBlock) {
    userPrompt += `
USER CONTEXT PROFILE (MUST be woven into the generated prompt):
${contextBlock}
At least 2 requirements in the generated prompt must directly reference this context.
`;
  }

  // Intent signals — help calibrate output format
  const signalLines: string[] = [];
  if (signals.lengthHint)   signalLines.push(`Implied length: ${signals.lengthHint}`);
  if (signals.audience)     signalLines.push(`Implied audience: ${signals.audience}`);
  if (signals.outputFormat) signalLines.push(`Implied format: ${signals.outputFormat}`);
  if (signals.hasConstraints) signalLines.push(`User included constraints — preserve and strengthen them.`);

  if (signalLines.length > 0) {
    userPrompt += `\nDetected signals (use to calibrate the generated prompt):\n${signalLines.map(s => `- ${s}`).join("\n")}\n`;
  }

  return userPrompt;
}
