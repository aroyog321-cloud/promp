
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export async function makeGeminiCall(
  systemPrompt: string, 
  userPrompt: string, 
  stream: boolean, 
  config: { temperature: number, maxOutputTokens: number }, 
  apiKey: string,
  routeSignal?: AbortSignal
) {
  // FIX #11: Pass API key as a header instead of a URL query param.
  // Query params are logged by proxies, CDNs, and Vercel log drains.
  const endpoint = stream 
    ? `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`
    : `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  let attempt = 0;
  const maxAttempts = 3;
  let lastError: Error | null = null;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      let finalSignal: AbortSignal;
      
      if (routeSignal) {
        // If AbortSignal.any is available (Node 20+), use it to combine the route timeout and the retry timeout.
        // Otherwise, fall back to the routeSignal which has a 50s timeout.
        finalSignal = typeof AbortSignal.any === 'function' 
          ? AbortSignal.any([routeSignal, AbortSignal.timeout(45000)])
          : routeSignal;
      } else {
        finalSignal = AbortSignal.timeout(45000);
      }
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: config.temperature,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: config.maxOutputTokens,
          }
        }),
        signal: finalSignal
      });

      if (!response.ok) {
        const isRetryable = [429, 500, 502, 503, 504].includes(response.status);
        if (isRetryable && attempt < maxAttempts) {
          // FIX #12: Start at 1s (attempt-1), not 2s, so retries fit within the 50s route timeout.
          const baseDelay = Math.pow(2, attempt - 1) * 1000;
          const jitter = baseDelay * (0.8 + Math.random() * 0.4);
          await new Promise(res => setTimeout(res, Math.min(jitter, 8000)));
          continue;
        }
        
        let errorMsg = `Gemini API error: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg += ` - ${errorData.error?.message || 'Unknown error'}`;
        } catch {}
        throw new Error(errorMsg);
      }

      return response;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const isError = e instanceof Error;
      
      if (routeSignal?.aborted || (isError && e.name === 'AbortError')) {
        throw e;
      }
      
      if (isError && e.name === 'TimeoutError' && attempt < maxAttempts) {
        const baseDelay = Math.pow(2, attempt - 1) * 1000;
        const jitter = baseDelay * (0.8 + Math.random() * 0.4);
        await new Promise(res => setTimeout(res, Math.min(jitter, 8000)));
        continue;
      }
      if (attempt >= maxAttempts) throw e;
    }
  }
  
  throw lastError;
}
