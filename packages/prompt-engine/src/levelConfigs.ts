import type { RewriteLevel } from "@promptly/types";

/**
 * Per-level configuration. Drives both the system prompt (what methodology
 * the LLM uses) and the user prompt (what the rewritten prompt must include).
 */
export interface LevelConfig {
  framework: "polish" | "structure" | "engineer" | "strategize";
  instructions: string[];
  /** Minimum structural depth: 'inline' | 'headed' | 'multi-section' | 'full-recipe' */
  minStructure: "inline" | "headed" | "multi-section" | "full-recipe";
  /** Whether to run a 2-pass critique (draft → critique → revise). */
  twoPassCritique: boolean;
  /** Which few-shot examples to show (1-based; pass [] for none). */
  examplesToShow: number[];
}

export const LEVEL_CONFIGS: Record<RewriteLevel, LevelConfig> = {
  light: {
    framework: "polish",
    minStructure: "inline",
    twoPassCritique: false,
    examplesToShow: [1],
    instructions: [
      "Fix ambiguity.",
      "Ensure the core intent is crystal clear.",
      "Correct all spelling and grammatical errors from the raw input before generating the prompt.",
      "Keep the original phrasing largely intact.",
    ],
  },
  medium: {
    framework: "structure",
    minStructure: "headed",
    twoPassCritique: false,
    examplesToShow: [1, 2],
    instructions: [
      "Correct all spelling and grammatical errors from the raw input before generating the prompt.",
      "Establish a clear Role → Task → Format flow.",
      "Fill in obvious missing context.",
      "Specify the desired output format (length, structure, tone).",
    ],
  },
  aggressive: {
    framework: "engineer",
    minStructure: "multi-section",
    twoPassCritique: true,
    examplesToShow: [1, 2],
    instructions: [
      "Correct all spelling and grammatical errors from the raw input before generating the prompt.",
      "Apply the CO-STAR framework fully (Context, Objective, Style, Tone, Audience, Response).",
      "Include negative constraints — at least 2 'Do NOT' / 'Avoid' rules.",
      "Define a specific, high-quality output format (sections, length, structure).",
      "Inject strategic assumptions into the Context section so the model doesn't have to guess.",
      "Include explicit success criteria so the reader knows when the output is good.",
    ],
  },
  expert: {
    framework: "strategize",
    minStructure: "full-recipe",
    twoPassCritique: true,
    examplesToShow: [1, 2],
    instructions: [
      "Correct all spelling and grammatical errors from the raw input before generating the prompt.",
      "Apply CO-STAR + the mode-specific structural recipe in full.",
      "Include at least 2 negative constraints.",
      "Define rigorous, measurable success criteria.",
      "Include an Edge Cases / Failure Modes section that names specific risks.",
      "Apply anti-hallucination discipline.",
      "Use Markdown for structure. For complex tasks, use XML tags (<context>, <task>, <constraints>).",
    ],
  },
};
