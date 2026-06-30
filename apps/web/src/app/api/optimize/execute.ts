import { getLevelConfig } from '@promptly/prompt-engine';
import { makeGeminiCall } from '@/services/ai';

export async function executeOptimization(
  systemPrompt: string,
  userPrompt: string,
  level: string,
  _isTwoPass: boolean,  // kept for API compatibility, no longer used
  activeApiKey: string,
  stream: boolean,
  signal?: AbortSignal
) {
  // Single-pass only. The two-pass critique was removed because:
  // 1. It doubled latency (2 sequential Gemini API calls)
  // 2. The critique rubric forced phases/criteria into every output regardless of input complexity
  // 3. The new system prompt is precise enough to produce correct output in one pass
  return makeGeminiCall(
    systemPrompt,
    userPrompt,
    stream,
    getLevelConfig(level, false),
    activeApiKey,
    signal
  );
}
