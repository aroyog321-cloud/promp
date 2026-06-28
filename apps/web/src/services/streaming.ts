import { SupabaseClient } from '@supabase/supabase-js';
import { normalizeLevel, normalizeMode } from '@/lib/levelMap';

interface StreamContext {
  user: { id: string };
  body: {
    text: string;
    mode: string;
    level: string;
    platform?: string;
  };
  platform: string;
  supabase: SupabaseClient;
  clientWillSync?: boolean;
}

/**
 * Converts a raw Gemini SSE response into an OpenAI-compatible SSE stream.
 * On stream completion (flush), persists the full optimized text to PromptHistory
 * so history is always recorded server-side regardless of extension state.
 */
export function createOpenAIStream(response: Response, context?: StreamContext) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let accumulatedText = "";
  let buffer = "";
  const startTime = Date.now();

  const transformStream = new TransformStream({
    async transform(chunk, controller) {
      const text = decoder.decode(chunk, { stream: true });
      buffer += text;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6);
          if (dataStr.trim() === '[DONE]') continue;

          try {
            const data = JSON.parse(dataStr);
            if (data.error) {
              const errorChunk = {
                choices: [{
                  delta: { content: `\n[API Error: ${data.error.message || 'Unknown error during stream'}]` }
                }]
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`));
              continue;
            }
            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
              const content = data.candidates[0].content.parts[0].text;
              accumulatedText += content;
              const openAIChunk = {
                choices: [{ delta: { content } }]
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(openAIChunk)}\n\n`));
            }
          } catch {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    },

    async flush() {
      // Stream complete — persist to PromptHistory server-side.
      // This is the only reliable place: the extension may disconnect, crash,
      // or switch tabs before it can POST to /api/history itself.
      if (context && accumulatedText.trim() && !context.clientWillSync) {
        const responseTime = (Date.now() - startTime) / 1000;
        const mappedLevel = normalizeLevel(context.body.level);
        const mappedMode = normalizeMode(context.body.mode);

        try {
          await context.supabase.from('PromptHistory').insert([{
            userId: context.user.id,
            originalPrompt: context.body.text,
            optimizedPrompt: accumulatedText.trim(),
            platformUsed: context.platform || context.body.platform || 'api',
            promptMode: mappedMode,
            rewriteLevel: mappedLevel,
            responseTime,
          }]);
        } catch (e) {
          // Non-fatal — history write failure should not break the stream response
          console.error('[Promptly] Failed to write PromptHistory on stream flush:', e);
        }
      }
    }
  });

  const readable = response.body?.pipeThrough(transformStream);
  return readable ? new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  }) : new Response("Failed to start stream", { status: 500 });
}
