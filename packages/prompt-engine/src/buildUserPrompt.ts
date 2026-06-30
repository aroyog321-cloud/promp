import { OptimizeRequest } from "@promptly/types";
import { contextLine, stripPoliteness } from "./utils";

export function buildUserPrompt(req: OptimizeRequest): string {
  const { text, context, refinement, previousPrompt } = req;
  const rawText = stripPoliteness(text.trim());

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
  let userPrompt = `Convert this into a prompt: "${rawText}"`;

  // Context memory — preserved if enabled by the user
  const contextBlock = context ? contextLine(context) : "";
  if (contextBlock) {
    userPrompt += `\n\nUSER CONTEXT PROFILE (MUST be woven into the generated prompt):\n${contextBlock}\nAt least 2 requirements in the generated prompt must directly reference this context.`;
  }

  return userPrompt;
}
