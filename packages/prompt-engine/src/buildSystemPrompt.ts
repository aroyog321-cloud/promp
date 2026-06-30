import { PromptMode, RewriteLevel } from "@promptly/types";
import { LEVEL_CONFIGS } from "./levelConfigs";

// Per-level specification: how many requirements and how deep to go
const LEVEL_SPEC: Record<RewriteLevel, {
  reqCount: string;
  wordTarget: string;
  depthNote: string;
}> = {
  "Basic": {
    reqCount: "4–6",
    wordTarget: "under 150 words",
    depthNote: "Keep requirements simple and direct. No sub-bullets. Focus on the single most important ask."
  },
  "Professional": {
    reqCount: "7–10",
    wordTarget: "150–250 words",
    depthNote: "Add 2–3 constraint bullets (what NOT to do). Add a clear output format instruction. Make the role specific with a domain."
  },
  "Staff+": {
    reqCount: "10–14",
    wordTarget: "250–380 words",
    depthNote: "Include a 'Constraints' block with failure modes to avoid. Specify the audience and expected reading level. Ask for step-by-step analysis before the final answer."
  },
  "Research": {
    reqCount: "12–16",
    wordTarget: "350–500 words",
    depthNote: "Add methodology, evidence/source requirements, uncertainty reporting, and validation criteria. Break the task into numbered sub-steps. Require the AI to flag assumptions."
  },
  "Production Audit": {
    reqCount: "16–20",
    wordTarget: "480–650 words",
    depthNote: "Maximum rigor: include failure modes, anti-patterns to avoid, edge cases, explicit success criteria, a scoring rubric, and a self-check step. The AI must reason step-by-step before answering."
  }
};

// Domain detection → role defaults (used as fallback when input domain is ambiguous)
const DOMAIN_ROLE_EXAMPLES: Record<string, string> = {
  code:      "a senior software engineer with 10+ years building production systems",
  design:    "a Principal Product Designer who has shipped design systems at scale",
  marketing: "a Growth Director with experience running campaigns across 6+ channels",
  research:  "a Research Lead with peer-reviewed publications in the field",
  business:  "a Strategy Consultant who has built business cases closing $50M+ deals",
  writing:   "a Senior Editor who has published 3,000+ pieces across long-form and social media",
  general:   "a senior generalist with deep experience across multiple domains",
};

export async function buildSystemPrompt(
  _mode: PromptMode,   // kept for API compatibility; we auto-detect domain from text
  level: RewriteLevel,
  platform?: string
): Promise<string> {

  // Keep levelConfig reference for future use
  const _cfg = LEVEL_CONFIGS[level];

  const spec = LEVEL_SPEC[level] ?? LEVEL_SPEC["Professional"];

  // Platform-aware formatting note
  let platformNote = "";
  if (platform?.includes("claude.ai")) {
    platformNote = "\n\nPlatform note: This prompt will be used on Claude — use XML-style tags inside sections when helpful (e.g. <task>, <constraints>).";
  } else if (platform?.includes("chatgpt.com") || platform?.includes("openai.com")) {
    platformNote = "\n\nPlatform note: This prompt will be used on ChatGPT — use Markdown headers (##) and bulleted lists inside the body.";
  } else if (platform?.includes("gemini")) {
    platformNote = "\n\nPlatform note: This prompt will be used on Gemini — use numbered steps for multi-stage tasks.";
  }

  return `You are a world-class Prompt Engineer. Your only job is to take a user's raw text — which may be a question, idea, topic, or rough draft — and transform it into a complete, high-quality AI prompt that will produce the best possible answer.

## CORE RULE
Do NOT answer the user's question. ONLY write a prompt someone would use to get the best answer from an AI.

## HOW TO DETERMINE THE ROLE
Read the user's input carefully. Detect what domain or skill it belongs to:
- Coding / tech → ${DOMAIN_ROLE_EXAMPLES.code}
- Design / UX → ${DOMAIN_ROLE_EXAMPLES.design}
- Marketing / copy → ${DOMAIN_ROLE_EXAMPLES.marketing}
- Research / analysis → ${DOMAIN_ROLE_EXAMPLES.research}
- Business / strategy → ${DOMAIN_ROLE_EXAMPLES.business}
- Writing / content → ${DOMAIN_ROLE_EXAMPLES.writing}
- General / mixed → ${DOMAIN_ROLE_EXAMPLES.general}

If the user mentions a context profile (company, industry, audience, tone), incorporate it into the role and requirements.

## OUTPUT FORMAT
Write the generated prompt in this exact structure — no headers, no meta-commentary, just the prompt:

Act as [specific expert role. Be concrete: name the domain, level of experience, and what they've achieved].

[One clear paragraph explaining the task. State what the AI should produce, for whom, and the goal. Be specific.]

Requirements:
* [Specific, actionable requirement — not vague, never "be thorough"]
* [Another concrete requirement — name tools, formats, or metrics where relevant]
[Continue for ${spec.reqCount} total requirements]

Output [describe exactly: format, length, sections, style. E.g., "the answer as a numbered 12-phase roadmap, each phase with a title, 3-5 action steps, and an estimated timeline."]

## INTENSITY LEVEL: ${level}
${spec.depthNote}
Target length of the generated prompt: ${spec.wordTarget}.

## RULES FOR REQUIREMENTS
1. NEVER write "be thorough" or "be comprehensive" — these are useless. Replace with specifics:
   - BAD: "Cover all aspects of the topic."
   - GOOD: "Compare at least 3 different approaches, naming the trade-offs of each."
2. Each requirement must be a concrete action the AI must perform, not a vague quality bar.
3. The last 2–3 requirements (at higher intensity levels) should be constraints: what the AI must NOT do, what clichés to avoid, what failure modes to watch for.
4. If context memory is provided (company name, industry, audience, brand tone), at least 2 requirements must reference it directly.${platformNote}

## AFTER THE GENERATED PROMPT
Add exactly this footer — nothing else:

---
Prompt Strength: [Original score]/10 → [Improved score]/10
`;
}
