import { OptimizeRequest, OptimizeResponse, PromptMode } from '@promptly/types';
import { localOptimize, buildSystemPrompt, buildUserPrompt } from '@promptly/prompt-engine';

class LRUCache<K, V> {
  private max: number;
  private cache: Map<K, V>;

  constructor(max = 50) {
    this.max = max;
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    const val = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, val);
    return val;
  }

  set(key: K, val: V) {
    if (this.cache.has(key)) this.cache.delete(key);
    this.cache.set(key, val);
    if (this.cache.size > this.max) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }
}

const PROMPT_CACHE = new LRUCache<string, OptimizeResponse>(50);

function getLevelConfig(level: string, isCritique: boolean = false) {
  if (isCritique) return { temperature: 0.3, maxOutputTokens: 2048 };
  switch (level) {
    case "light": return { temperature: 0.2, maxOutputTokens: 512 };
    case "medium": return { temperature: 0.4, maxOutputTokens: 1024 };
    case "aggressive": return { temperature: 0.6, maxOutputTokens: 2048 };
    case "expert": return { temperature: 0.7, maxOutputTokens: 2048 };
    default: return { temperature: 0.7, maxOutputTokens: 2048 };
  }
}

async function directAIFetch(endpoint: string, apiKey: string | undefined, messages: any[], config: any, stream: boolean, onChunk?: (chunk: string) => void, signal?: AbortSignal) {
  const payload = {
    model: "gpt-4o",
    messages,
    temperature: config.temperature,
    max_tokens: config.maxOutputTokens,
    stream
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      ...(apiKey ? { "Authorization": `Bearer ${apiKey}` } : {})
    },
    body: JSON.stringify(payload),
    signal
  });

  if (!res.ok) throw new Error("API responded with " + res.status);

  if (stream && onChunk && res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') continue;
          try {
            const data = JSON.parse(dataStr);
            if (data.choices && data.choices[0]?.delta?.content) {
              const delta = data.choices[0].delta.content;
              fullText += delta;
              onChunk(delta);
            }
          } catch (e) {}
        }
      }
    }
    return fullText.trim();
  } else {
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || "";
  }
}

function keywordClassify(text: string): PromptMode {
  const t = text.toLowerCase();
  if (/\b(money|income|earn|profit|cash|wealth|affiliate|ecommerce|side[- ]hustle|passive[- ]income|monetiz|invest|trading|crypto)\b/.test(t)) return "business";
  if (/\b(code|function|api|database|bug|typescript|python|react|sql|deploy|refactor|implement)\b/.test(t)) return "developer";
  if (/\b(design|mockup|wireframe|ux|ui|figma|typography|color|logo)\b/.test(t)) return "designer";
  if (/\b(marketing|campaign|ad copy|seo|funnel|landing page|lead magnet|growth)\b/.test(t)) return "marketing";
  if (/\b(research|study|paper|evidence|citation|thesis|literature)\b/.test(t)) return "research";
  if (/\b(blog|article|story|essay|video script|newsletter|caption|headline|tweet)\b/.test(t)) return "content-creator";
  if (/\b(mvp|launch|founder|investor|pitch|startup|go-to-market)\b/.test(t)) return "startup-founder";
  return "general";
}

async function resolveMode(req: OptimizeRequest, config: { categorizerApiUrl?: string; categorizerApiKey?: string; }): Promise<PromptMode> {
  if (req.mode !== "auto") return req.mode;
  if (config.categorizerApiUrl) {
    try {
      const categorizerPrompt = `Classify this user request into EXACTLY ONE of the following categories: general, developer, designer, marketing, research, business, content-creator, startup-founder. Output ONLY the category name. Do not include punctuation or explanation.\n\nRequest: "${req.text}"`;
      const isDirectCategorizer = config.categorizerApiUrl.includes('/chat/completions') || config.categorizerApiUrl.includes('/v1');
      if (isDirectCategorizer) {
        const endpoint = config.categorizerApiUrl.endsWith('/chat/completions') ? config.categorizerApiUrl : `${config.categorizerApiUrl.replace(/\/+$/, "")}/chat/completions`;
        const catResult = await directAIFetch(endpoint, config.categorizerApiKey, [{ role: "user", content: categorizerPrompt }], { temperature: 0.1, maxOutputTokens: 20 }, false);
        const rawCategory = catResult.trim().toLowerCase();
        if (["general", "developer", "designer", "marketing", "research", "business", "content-creator", "startup-founder"].includes(rawCategory)) {
          return rawCategory as any;
        }
      }
    } catch (e) {
      console.warn("Categorizer API failed, falling back to keyword classify", e);
    }
  }
  return keywordClassify(req.text);
}

export async function optimizePrompt(
  req: OptimizeRequest,
  config: { apiBaseUrl?: string; apiKey?: string; categorizerApiUrl?: string; categorizerApiKey?: string; accessToken?: string; },
  options?: { onChunk?: (chunk: string) => void, abortSignal?: AbortSignal }
): Promise<OptimizeResponse> {
  let lastError: Error | undefined;

  const cacheKey = JSON.stringify({ 
    text: req.text, 
    mode: req.mode, 
    level: req.level, 
    refinement: req.refinement,
    previousPrompt: req.previousPrompt
  });
  if (!req.refinement && PROMPT_CACHE.has(cacheKey) && !options?.onChunk) {
    // return PROMPT_CACHE.get(cacheKey)!; // Disabled cache to ensure all history syncs to server
  }

  if (config.apiBaseUrl) {
    try {
      const isDirectAI = config.apiBaseUrl.includes('/chat/completions') || config.apiBaseUrl.includes('/v1');
      let endpoint = isDirectAI
        ? (config.apiBaseUrl.endsWith('/chat/completions') ? config.apiBaseUrl : `${config.apiBaseUrl.replace(/\/$/, "")}/chat/completions`)
        : `${config.apiBaseUrl.replace(/\/$/, "")}/api/optimize`;

      if (isDirectAI) {
        let finalMode = await resolveMode(req, config);

        const platform = req.platform || window.location.hostname || "unknown";
        const systemPrompt = buildSystemPrompt(finalMode, req.level, platform);
        const userPrompt = buildUserPrompt({ ...req, mode: finalMode });
        const isTwoPass = req.level === "aggressive" || req.level === "expert";

        if (isTwoPass) {
          // Pass 1: Draft (no stream)
          const draftText = await directAIFetch(
            endpoint, 
            config.apiKey, 
            [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ], 
            getLevelConfig(req.level, false), 
            false,
            undefined,
            options?.abortSignal
          );

          // Pass 2: Critique
          const critiquePrompt = `Apply this rubric point-by-point to the draft below. If any check fails, output a REVISED version that fixes the issues. If it already passes all checks, output it unchanged. Do not explain.

RUBRIC:
- ROLE: Specific expert persona with concrete skills (not "an expert" / "an assistant")
- CONTEXT: Names who, what, why — concrete, not generic
- OBJECTIVE: Single sharp deliverable with measurable criteria
- CONSTRAINTS: ≥2 negative constraints (Do NOT / Avoid)
- OUTPUT FORMAT: Exact structure (sections, length, format)
- SUCCESS CRITERIA: What "done well" looks like
${req.level === "expert" ? "- EDGE CASES: Failure modes the model should watch for" : ""}

DRAFT:
${draftText}`;

          const finalResult = await directAIFetch(
            endpoint,
            config.apiKey,
            [
              { role: "system", content: systemPrompt },
              { role: "user", content: critiquePrompt }
            ],
            getLevelConfig(req.level, true),
            !!req.stream,
            options?.onChunk,
            options?.abortSignal
          );

          const response: OptimizeResponse = { optimized: finalResult, source: "api" };
          if (!req.refinement) PROMPT_CACHE.set(cacheKey, response);
          return response;
        } else {
          // 1-Pass
          const finalResult = await directAIFetch(
            endpoint,
            config.apiKey,
            [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            getLevelConfig(req.level, false),
            !!req.stream,
            options?.onChunk,
            options?.abortSignal
          );

          const response: OptimizeResponse = { optimized: finalResult, source: "api" };
          if (!req.refinement) PROMPT_CACHE.set(cacheKey, response);
          return response;
        }
      } else {
        let finalMode = await resolveMode(req, config);

        // Next.js Route
        let payload: any = { ...req, mode: finalMode, platform: req.platform || window.location.hostname || "unknown" };
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json", 
            ...(config.accessToken ? { "Authorization": `Bearer ${config.accessToken}` } : (config.apiKey ? { "Authorization": `Bearer ${config.apiKey}` } : {})) 
          },
          body: JSON.stringify(payload),
          signal: options?.abortSignal
        });
        if (!res.ok) {
          let errorMsg = "API responded with " + res.status;
          try {
            const errData = await res.json();
            if (errData.error) errorMsg = errData.error;
          } catch (e) {}
          
          if (res.status === 401) {
            // Token is invalid/expired. Request re-auth instead of wiping permanently.
            if (typeof chrome !== 'undefined' && chrome.tabs) {
              chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]?.id) {
                  chrome.tabs.sendMessage(tabs[0].id, { type: "PROMPTLY_REAUTH_REQUEST" });
                }
              });
              chrome.storage.local.remove('apiPlanCache');
            }
          }
          throw new Error(errorMsg);
        }
        
        if (req.stream && options?.onChunk && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let fullText = "";
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6).trim();
                if (dataStr === '[DONE]') continue;
                try {
                  const data = JSON.parse(dataStr);
                  if (data.choices && data.choices[0]?.delta?.content) {
                    const delta = data.choices[0].delta.content;
                    fullText += delta;
                    options.onChunk(delta); // Send delta only
                  }
                } catch (e) {}
              }
            }
          }
          const response: OptimizeResponse = { optimized: fullText.trim(), source: "api" };
          if (!req.refinement) PROMPT_CACHE.set(cacheKey, response);
          return response;
        }

        const data = await res.json();
        if (data.choices && data.choices[0]?.message?.content) {
          const response: OptimizeResponse = { optimized: data.choices[0].message.content.trim(), source: "api" };
          if (!req.refinement) PROMPT_CACHE.set(cacheKey, response);
          return response;
        }
        if (typeof data.optimized === "string" && data.optimized.trim()) {
          const response: OptimizeResponse = { optimized: data.optimized.trim(), source: "api" };
          if (!req.refinement) PROMPT_CACHE.set(cacheKey, response);
          return response;
        }
        throw new Error("Malformed API response");
      }
    } catch (e) {
      if (e instanceof Error && (e.message.includes("401") || e.message.includes("403"))) {
        throw e; // Do not fallback to local if unauthorized
      }
      console.warn("API Optimization failed, falling back to local template", e);
      lastError = e as Error;
    }
  }
  
  const localResponse: OptimizeResponse = { 
    optimized: localOptimize(req), 
    source: "local-fallback",
    degraded: true,
    degradedReason: lastError ? lastError.message : "API URL missing or unreachable"
  };
  if (!req.refinement) PROMPT_CACHE.set(cacheKey, localResponse);
  
  if (options?.onChunk) {
    // Simulate streaming for local fallback
    const text = localResponse.optimized;
    for (let i = 0; i < text.length; i += 5) {
      options.onChunk(text.substring(i, i + 5));
      await new Promise(r => setTimeout(r, 10));
    }
  }

  return localResponse;
}
