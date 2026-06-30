import { OptimizeRequest } from "@promptly/types";
import { stripPoliteness } from "./utils";

export function buildUserPrompt(req: OptimizeRequest): string {
  const { text, refinement, previousPrompt } = req;
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

Apply the feedback to improve the current prompt. Output only the revised prompt.
`;
  }

  // ── STANDARD FLOW ─────────────────────────────────────────────────────────
  return `User Input:\n"${rawText}"`;
}
