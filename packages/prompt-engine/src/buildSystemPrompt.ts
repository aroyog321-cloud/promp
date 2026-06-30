import { PromptMode, RewriteLevel } from "@promptly/types";

// Word limits based on intensity
const LIMITS: Record<RewriteLevel, string> = {
  "Basic": "under 100 words",
  "Professional": "150–250 words",
  "Staff+": "250–400 words",
  "Research": "350–500 words",
  "Production Audit": "500–700 words"
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
* Restructure the request into a highly optimized, context-rich prompt.
* Assign a specific expert role or persona to the AI.
* Add critical context and improve instructions for edge cases.
* Define strict constraints and output formats.
* Require step-by-step reasoning before the final answer.`,

  "Research": `Research Optimization Rules:
* Rebuild the prompt for academic or deep analytical rigor.
* Define specific methodology and evidence/source requirements.
* Break the task into numbered sub-steps for systematic analysis.
* Require the AI to flag assumptions and uncertainty.
* Enforce strict formatting and data presentation rules.`,

  "Production Audit": `Production Audit Optimization Rules:
* Reconstruct the prompt into an exhaustive, expert-level auditing framework.
* Assign a precise role (e.g., Principal Engineer, Chief Auditor).
* Define exhaustive success criteria, edge cases, and anti-patterns to avoid.
* Include a mandatory self-check or scoring rubric step.
* Ensure maximum rigor and constraint enforcement.`
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

// Domain-specific rules injected based on the auto-detected category
// (category selector was removed from UI — now auto-detected server-side via classifyPromptMode)
const DOMAIN_CONTEXT: Partial<Record<PromptMode, string>> = {
  "developer": `Domain: Software Engineering / Tech
* Frame the prompt for an experienced software engineer.
* Use technical precision: mention languages, frameworks, patterns, or system design where relevant.
* Encourage structured reasoning: complexity, trade-offs, edge cases, and production-readiness.`,

  "designer": `Domain: Product Design / UX
* Frame the prompt for a senior product or UX designer.
* Focus on user empathy, design systems, accessibility, and visual hierarchy.
* Encourage output that references design principles, user flows, or Figma/prototyping considerations.`,

  "marketing": `Domain: Marketing / Growth
* Frame the prompt for a growth or marketing professional.
* Focus on audience targeting, conversion, messaging hierarchy, and channel strategy.
* Encourage output that references metrics like CTR, ROAS, CAC, or brand voice.`,

  "research": `Domain: Research / Analysis
* Frame the prompt for a rigorous analyst or researcher.
* Require evidence-based structure: methodology, data sources, assumptions flagged.
* Encourage systematic breakdowns with references to credible sources or prior art.`,

  "business": `Domain: Business / Strategy
* Frame the prompt for a senior business strategist or operator.
* Focus on ROI, stakeholder alignment, risk assessment, and execution planning.
* Encourage structured output: executive summaries, recommendations, and trade-off analysis.`,

  "content-creator": `Domain: Content Creation / Writing
* Frame the prompt for a professional writer, editor, or content strategist.
* Focus on narrative structure, audience engagement, hook crafting, and tone consistency.
* Encourage output formats like blog posts, newsletters, scripts, or social captions.`,

  "startup-founder": `Domain: Startup / Entrepreneurship
* Frame the prompt for a founder or early-stage entrepreneur.
* Focus on go-to-market strategy, lean validation, pitch clarity, and resource constraints.
* Encourage output that references MVPs, investor narratives, product-market fit, or growth loops.`,

  "general": `Domain: General
* Frame the prompt for a knowledgeable generalist.
* Preserve broad applicability — do not over-specialize into a single domain.`
};

export async function buildSystemPrompt(
  mode: PromptMode,
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

  // Inject domain rules based on auto-detected category (replaces the removed UI selector)
  const domainBlock = DOMAIN_CONTEXT[mode] || DOMAIN_CONTEXT["general"] || "";

  return `You are an elite Prompt Optimization Engine.

Your job is NOT to answer the user's request.
Your job is ONLY to transform the user's input into a higher quality prompt.

SETTINGS:
Intensity: ${level}
Style: ${matchedStyleKey}
Target Length: ${wordLimit}
Context Memory:
${contextStr}

${domainBlock}

Generate an optimized prompt from the user's request.

Requirements:
* Preserve the user's original objective.
* Improve clarity, structure, and precision.
* Remove ambiguity and vague instructions.
* Add useful constraints only when strongly implied.
* Keep the prompt concise and execution-focused.
* Do not introduce unsupported assumptions or facts.
* Respect the selected target length.
* Use context memory only if directly relevant.

${intensityRules}

${styleRules}

Output Rules:
* Return ONLY the final optimized prompt.
* Do not explain decisions.
* Do not include notes, labels, or commentary.`;
}
