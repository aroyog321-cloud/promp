import { OptimizeRequest } from "@promptly/types";
import { STYLE_GUIDELINES } from "./modeRecipes";
import { LEVEL_CONFIGS } from "./levelConfigs";
import { contextLine, stripPoliteness, classifyTaskType, detectIntentSignals } from "./utils";

export function buildUserPrompt(req: OptimizeRequest): string {
  const { text, level, style, context, refinement, previousPrompt } = req;
  const rawText = stripPoliteness(text.trim());
  const detectedTaskType = classifyTaskType(rawText);
  const signals = detectIntentSignals(rawText);
  
  const levelConfig = LEVEL_CONFIGS[level] || LEVEL_CONFIGS.medium;
  
  let instructions = levelConfig.instructions.map((i: string) => `- ${i}`).join('\n');
  
  let userPrompt = previousPrompt ? `You are refining an existing prompt based on user feedback.

1. ORIGINAL INTENT:
<user_input>
${rawText}
</user_input>

2. CURRENTLY GENERATED PROMPT (with any manual edits the user made):
<generated_prompt>
${previousPrompt}
</generated_prompt>

3. USER FEEDBACK / REFINEMENT REQUEST:
<user_feedback>
${refinement}
</user_feedback>

Your task:
Apply the USER FEEDBACK to the CURRENTLY GENERATED PROMPT.
Ensure you still fulfill the ORIGINAL INTENT.
Maintain the existing structural framework, persona, and style unless the feedback explicitly asks to change them.
DO NOT output a "User Refinement" or "Feedback" section or header. Just produce the new, modified prompt directly.
` : `Here is the user's raw input:
<user_input>
${rawText}
</user_input>

Your task:
Rewrite this into a highly effective prompt at ${level} level. Use the ${req.mode} persona. Apply the structural requirements specified in the system prompt.
CRITICAL: If the user's raw input contains typos, grammatical errors, or spelling mistakes, you MUST correct them in your rewritten output. DO NOT copy typos (e.g., 'arn oney') into the final prompt.

${refinement ? `CRITICAL REFINEMENT INSTRUCTION:
The user has reviewed the previous version of this prompt and asked for the following change:
<user_feedback>
${refinement}
</user_feedback>
You MUST apply this feedback by changing the content, style, and structure of the prompt itself. DO NOT output a "User Refinement" section or header. Simply produce the new, refined prompt that satisfies this feedback.\n` : ""}`;

  let signalBlock = "";
  if (signals.lengthHint) {
    signalBlock += `\nThe user has implied a target length: ${signals.lengthHint}.\n`;
  }
  if (signals.audience) {
    signalBlock += `\nThe user is writing for an audience of: ${signals.audience}.\n`;
  }
  if (signals.outputFormat) {
    signalBlock += `\nThe user wants output in this format: ${signals.outputFormat}.\n`;
  }

  userPrompt += `
Detected task type: ${detectedTaskType}${signalBlock}
Target Style: ${STYLE_GUIDELINES[style] || STYLE_GUIDELINES.neutral}
${context ? `Context Profile: ${contextLine(context)}` : ''}

Level Instructions:
${instructions}
`;

  return userPrompt;
}
