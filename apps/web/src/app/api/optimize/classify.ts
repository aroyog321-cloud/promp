import { makeGeminiCall } from '@/services/ai';
import { classifyTaskType } from '@promptly/prompt-engine/src/utils';

export async function classifyPromptMode(text: string, apiKey: string): Promise<string> {
  // 1. Heuristic classify (fast)
  const heuristic = classifyTaskType(text);
  
  // Mapping prompt-engine task types to persona modes
  const modeMap: Record<string, string> = {
    code: 'developer',
    design: 'designer',
    marketing: 'marketing',
    research: 'research',
    business: 'business',
    writing: 'content-creator',
    analysis: 'business' // approximation
  };
  
  // If heuristic found a strong signal (not general), trust it
  if (heuristic && heuristic !== 'general' && modeMap[heuristic]) {
    return modeMap[heuristic];
  }

  // 2. Low confidence -> AI classify
  const classifierPrompt = `Classify into ONE: general, developer, designer, marketing, research, business, content-creator, startup-founder. Output ONLY the category name.\n\n"${text.slice(0, 300)}"`;
  try {
    const classifyRes = await makeGeminiCall(
      "You classify user requests. Output only the category name, nothing else.",
      classifierPrompt,
      false,
      { temperature: 0.1, maxOutputTokens: 20 },
      apiKey
    );
    const classifyData = await classifyRes.json();
    const raw = classifyData.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase();
    const VALID = ["general", "developer", "designer", "marketing", "research", "business", "content-creator", "startup-founder"];
    return VALID.includes(raw) ? raw : "general";
  } catch (e) {
    console.warn("Classification failed, falling back to general", e);
    return "general";
  }
}
