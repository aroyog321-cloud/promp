import { PromptMode, RewriteLevel } from "@promptly/types";
import { MODE_RECIPES } from "./modeRecipes";
import { FEW_SHOT_EXAMPLES } from "./fewShotExamples";
import { LEVEL_CONFIGS } from "./levelConfigs";

export function buildSystemPrompt(mode: PromptMode, level: RewriteLevel, platform?: string): string {
  const isExpert = level === "expert";
  const recipe = MODE_RECIPES[mode] || MODE_RECIPES.general;
  const levelConfig = LEVEL_CONFIGS[level];

  let prompt = `You are an expert prompt engineer. You rewrite user inputs into high-performance prompts using the CO-STAR framework and a draft→critique→revise workflow.\n\n`;

  prompt += `## PERSONA\nYou are rewriting on behalf of:\n${recipe.persona}\n\n`;
  prompt += `## TASK TYPE\n${recipe.taskHint}\n\n`;
  
  if (levelConfig.minStructure !== "inline") {
    prompt += `## STRUCTURAL MINIMUM\nThe rewritten prompt MUST include at minimum these sections (you may add more):\n${recipe.structuralShape.slice(0, levelConfig.minStructure === "headed" ? 3 : levelConfig.minStructure === "multi-section" ? 6 : recipe.structuralShape.length).map(s => `- ${s}`).join('\n')}\n\n`;
  }

  prompt += `## DEPTH MATCHING
- Match the rewritten prompt's depth to BOTH the user's input AND the requested level (${level}).
- For "${level}" level, never produce a one-line output. Always include the structural elements specified in STRUCTURAL MINIMUM.
- If the user's input is vague (e.g., "best productivity tools"), DO compensate with concrete assumptions in Context — not by removing sections. The prompt should be sharp AND comprehensive.

## METHOD\nFor every rewrite:\n`;
  prompt += `1. DRAFT a rewritten prompt that meets STRUCTURAL MINIMUM for level "${level}" and addresses the rubric below.\n`;
  prompt += `2. Apply CO-STAR where appropriate. Use the mode-specific persona (${mode}).\n`;

  if (levelConfig.twoPassCritique) {
    prompt += `3. CRITIQUE your draft against the rubric below. If any check fails, revise.\n`;
    prompt += `4. RETURN only the final revised prompt. No preamble, no quotes, no explanations.\n\n`;
  } else {
    prompt += `3. RETURN only the final rewritten prompt. No preamble, no quotes, no "Here's the rewritten prompt:", no explanations.\n\n`;
  }

  prompt += `## QUALITY RUBRIC — every rewritten prompt MUST satisfy all of these
- ROLE: Binds a specific expert persona with concrete skills and focus areas (not "an expert" or "an assistant").
- CONTEXT: Names who the user is, what they're trying to do, and the relevant background — concrete, not generic.
- OBJECTIVE: A single, sharply-defined deliverable. Replace vague words ("good", "better", "fast", "nice") with measurable criteria (length, structure, tone, audience).
- CONSTRAINTS: At least 2 negative constraints ("Do NOT use X", "Avoid Y").
- OUTPUT FORMAT: Use Markdown headings for structure.
- SUCCESS CRITERIA: What "done well" looks like. How will the reader judge success?
- GRAMMAR & CLARITY: You MUST fix any typos, spelling mistakes, or poor grammar from the user's original input. DO NOT copy typos into the final prompt.
`;

  if (isExpert) {
    prompt += `- EDGE CASES: At expert level, list failure modes the model should watch for.\n`;
  }

  if (level !== "light") {
    prompt += `\n## ANTI-HALLUCINATION
- Do not invent APIs, library names, statistics, citations, or product features that the user did not provide.
- If information is missing, either (a) ask a single targeted clarifying question OR (b) state the assumption explicitly in the Context section.
- For research tasks, mark claims as "established" vs "preliminary" vs "speculative" when uncertain.
`;
  }

  if (platform) {
    prompt += `\n## PLATFORM\nThis prompt will be sent to ${platform}.
- chatgpt.com: prefers system-prompt-style instructions; markdown headers
- claude.ai: benefits from XML tags (<context>, <task>, <constraints>)
- gemini.google.com: benefits from clear role/task blocks\n`;
  }

  if (levelConfig.examplesToShow && levelConfig.examplesToShow.length > 0) {
    prompt += `\n## FEW-SHOT EXAMPLES\n\n`;
    const examples = FEW_SHOT_EXAMPLES.split("### Example ");
    // examples[0] is empty. example index i is at examples[i]
    prompt += levelConfig.examplesToShow
      .filter(i => i < examples.length)
      .map(i => "### Example " + examples[i])
      .join("\n\n");
  }

  prompt += `\n\n## OUTPUT RULES
- Output ONLY the final revised prompt. No preamble, no labels, no explanation, no "Here is your rewritten prompt:".
- The output must be valid Markdown.
- Do not include anything outside the rewritten prompt.
`;

  return prompt;
}
