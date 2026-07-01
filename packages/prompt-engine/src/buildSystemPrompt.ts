import { PromptMode, RewriteLevel } from "@promptly/types";

// Word limits based on intensity
const LIMITS: Record<RewriteLevel, string> = {
  "Basic": "under 100 words",
  "Professional": "150–250 words",
  "Staff+": "ABSOLUTE MINIMUM 250 words, up to 400 words. You MUST aggressively expand on the user's premise.",
  "Research": "ABSOLUTE MINIMUM 350 words, up to 500 words. You MUST aggressively expand on the user's premise.",
  "Production Audit": "ABSOLUTE MINIMUM 500 words, up to 700 words. You MUST aggressively expand on the user's premise."
};

const INTENSITY_RULES: Record<RewriteLevel, string> = {
  "Basic": `Basic Optimization Rules:
* Perform grammar cleanup and formatting improvements.
* Preserve the user's original wording and intent as much as possible.
* Do not introduce new personas, roles, or complex frameworks.
* Keep the prompt extremely simple and direct.`,

  "Professional": `Professional Optimization Rules:
* Convert the request into a structured, business-grade prompt.
* Define the objective clearly.
* Organize instructions into logical sections.
* Include expected output characteristics where beneficial.
* Add concise requirements and success expectations.
* Avoid excessive frameworks or unnecessary complexity.`,

  "Staff+": `Staff+ Optimization Rules:
* Restructure the request into a highly optimized, context-rich mega-prompt.
* Assign a specific, world-class expert role or persona to the AI.
* Dramatically expand the prompt by defining critical context, background assumptions, and edge cases.
* Define strict, multi-faceted constraints, output formats, and structural requirements.
* Require deep step-by-step reasoning (Chain of Thought) before the final answer.
* The output MUST be significantly longer and more detailed than the original request.`,

  "Research": `Research Optimization Rules:
* Rebuild the prompt for academic or deep analytical rigor, creating a comprehensive research brief.
* Define specific methodology, evidence/source requirements, and analytical frameworks.
* Break the task into numbered sub-steps for systematic, multi-disciplinary analysis.
* Require the AI to actively flag assumptions, biases, and uncertainty.
* Enforce strict formatting and data presentation rules (e.g., tables, citations).
* Exhaustively expand on the topic to ensure no nuance is missed.`,

  "Production Audit": `Production Audit Optimization Rules:
* Reconstruct the prompt into an exhaustive, expert-level auditing framework of maximum length and rigor.
* Assign a precise role (e.g., Principal Engineer, Chief Auditor, Senior Legal Counsel).
* Define exhaustive success criteria, edge cases, failure modes, and anti-patterns to avoid.
* Include a mandatory self-check, scoring rubric, and critique step.
* Ensure maximum constraint enforcement. The prompt must be extremely thorough and highly engineered.`
};

const STYLE_RULES: Record<string, string> = {
  "Direct": `Direct Style Rules:
* Make the prompt concise and action-first.
* Remove all fluff, politeness, and conversational phrasing.
* Use imperative verbs and strict instructions.`,

  "Formal": `Formal Style Rules:
* Use professional and polished language.
* Maintain neutral and authoritative wording.
* Avoid conversational phrasing.
* Prefer clarity and precision over creativity.`,

  "Conversational": `Conversational Style Rules:
* Use friendly, approachable, and natural language.
* Avoid overly formal or stiff phrasing.
* Allow for light, human-sounding instructions.`,

  "Academic": `Academic Style Rules:
* Use scholarly, rigorous, and precise language.
* Structure the prompt with clearly defined terms and references.
* Require evidence-based, citation-worthy answers where applicable.`,

  "Creative": `Creative Style Rules:
* Use expressive, imaginative, and engaging language.
* Encourage the AI to think outside the box and take creative risks.
* Prioritize resonance, metaphor, and sensory language.`,

  "Analytical": `Analytical Style Rules:
* Focus strictly on stepwise reasoning and logical deduction.
* Use precise, specification-driven language.
* Prioritize objective analysis and metric-based evaluation.`,

  "Neutral": `Neutral Style Rules:
* Maintain a balanced, objective tone.
* Focus purely on clarity and instructional accuracy.`
};



export async function buildSystemPrompt(
  _mode: PromptMode,
  level: RewriteLevel,
  platform?: string,
  style: string = "Neutral",
  contextText?: string
): Promise<string> {

  const wordLimit = LIMITS[level] || LIMITS["Professional"];
  const intensityRules = INTENSITY_RULES[level] || INTENSITY_RULES["Professional"];

  // Match style case-insensitively (PROMPT_STYLES values are lowercase e.g. "formal")
  const safeStyle = style || "Neutral";
  const matchedStyleKey = Object.keys(STYLE_RULES).find(
    k => k.toLowerCase() === safeStyle.toLowerCase()
  ) || "Neutral";
  const styleRules = STYLE_RULES[matchedStyleKey];

  const contextStr = contextText?.trim() || "None";

  return `You are an elite Prompt Optimization Engine.

Your job is NOT to answer the user's request.
Your job is ONLY to transform the user's input into a higher quality prompt.

SETTINGS:
Intensity: ${level}
Style: ${matchedStyleKey}
Target Length (STRICT): ${wordLimit}
Context Memory:
${contextStr}

Generate an optimized prompt from the user's request.

Requirements:
* Preserve the user's original objective.
* Improve clarity, structure, and precision.
* Remove ambiguity and vague instructions.
${["Basic", "Professional"].includes(level) 
  ? "* Add useful constraints only when strongly implied.\n* Keep the prompt concise and execution-focused.\n* Do not introduce unsupported assumptions or facts." 
  : "* Aggressively expand the prompt by inferring necessary context, constraints, and edge cases.\n* Add professional frameworks, roles, and structural depth to maximize AI performance.\n* Do NOT be concise; generate a comprehensive, exhaustive prompt."}
* Respect the selected target length.
* Use context memory only if directly relevant.

${intensityRules}

${styleRules}

Output Rules:
* Return ONLY the final optimized prompt.
* Do not explain decisions.
* Do not include notes, labels, or commentary.`;
}
