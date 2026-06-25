import { NextResponse } from 'next/server';
import type { OptimizeRequest, OptimizeResponse } from '@promptly/types';
import { buildSystemPrompt, buildUserPrompt, localOptimize } from '@promptly/prompt-engine';

import { requireEnv } from '@/lib/env';
import { createOpenAIStream } from '@/services/streaming';
import { checkQuotaAndTier, getDynamicApiKey } from '@/services/billing';
import { validateOptimizeRequest } from '@/services/validators';
import { captureError } from '@/services/monitoring';
import { withMetrics } from '@/lib/metrics';

import { authenticateRequest } from './authenticate';
import { classifyPromptMode } from './classify';
import { executeOptimization } from './execute';

const GEMINI_API_KEY = requireEnv('GEMINI_API_KEY');
const GEMINI_API_KEY_PREMIUM = process.env.GEMINI_API_KEY_PREMIUM;

export const POST = withMetrics(async (request: Request) => {
  const routeController = new AbortController();
  const routeTimeout = setTimeout(() => routeController.abort(), 50000); // 50s route timeout

  const startTime = Date.now();
  try {
    const bodyText = await request.text();
    const validation = validateOptimizeRequest(bodyText);
    
    if (validation.error) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }
    const body = validation.body!;

    const authRes = await authenticateRequest(request);
    if (authRes.error || !authRes.user) {
      return NextResponse.json({ error: authRes.error }, { status: authRes.status });
    }
    const { user, supabaseUserClient, supabaseAdmin } = authRes;

    const isTwoPass = body.level === "aggressive" || body.level === "expert";
    const isRegeneration = !!body.refinement || !!body.previousPrompt;
    const hasContextMemory = !!body.context && Object.values(body.context).some(v => !!v);

    // Parallelize independent remote calls
    const billingPromise = checkQuotaAndTier(supabaseUserClient, user.id, isRegeneration, hasContextMemory);
    const apiKeyPromise = getDynamicApiKey(supabaseAdmin, GEMINI_API_KEY);
    let classifyPromise: Promise<any> | null = null;
    
    if (body.mode === "auto") {
      // Use fallback key for classification to parallelize
      classifyPromise = classifyPromptMode(body.text, GEMINI_API_KEY);
    }

    const [billingResult, dynamicApiKey, classifiedMode] = await Promise.all([
      billingPromise,
      apiKeyPromise,
      classifyPromise
    ]);

    if (billingResult.error) {
      return NextResponse.json({ error: billingResult.error }, { status: billingResult.status });
    }
    const tier = billingResult.tier || 'free';
    const FINAL_API_KEY = dynamicApiKey || GEMINI_API_KEY;

    if (!FINAL_API_KEY) {
      console.warn("GEMINI_API_KEY is not set. Falling back to local template.");
      if (body.stream) {
        return NextResponse.json({ error: "Streaming not supported for local fallback" }, { status: 400 });
      }
      return NextResponse.json<OptimizeResponse>({
        optimized: localOptimize(body),
        source: "local-fallback"
      });
    }

    const rawOrigin = request.headers.get("origin") || "";
    const ALLOWED_ORIGINS = [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://proenpt.vercel.app",
      "https://proenpt.com",
      "https://app.proenpt.com",
    ];
    const isTrustedOrigin = rawOrigin.startsWith("chrome-extension://") || ALLOWED_ORIGINS.includes(rawOrigin);
    const platform = isTrustedOrigin ? rawOrigin : undefined;

    const resolvedMode = classifiedMode ? classifiedMode : body.mode;

    const systemPrompt = await buildSystemPrompt(resolvedMode, body.level, platform);
    const userPrompt = buildUserPrompt(body);

    const activeApiKey = isTwoPass ? (GEMINI_API_KEY_PREMIUM || FINAL_API_KEY) : FINAL_API_KEY;

    const finalRes = await executeOptimization(
      systemPrompt, 
      userPrompt, 
      body.level, 
      isTwoPass, 
      activeApiKey, 
      !!body.stream,
      routeController.signal
    );

    clearTimeout(routeTimeout);

    if (body.stream) {
      return createOpenAIStream(finalRes, { user, body, platform: platform || "api", supabase: supabaseUserClient });
    } else {
      const finalData = await finalRes.json();
      const optimizedText = finalData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (!optimizedText) {
        return NextResponse.json({ error: "Empty response from AI" }, { status: 502 });
      }

      const responseTime = (Date.now() - startTime) / 1000;

      // Persist history server-side — do not rely on the extension to POST separately.
      // Fire-and-forget: non-fatal if it fails.
      supabaseUserClient.from('PromptHistory').insert([{
        userId: user.id,
        originalPrompt: body.text,
        optimizedPrompt: optimizedText,
        platformUsed: platform || body.platform || 'api',
        promptMode: (resolvedMode as string)?.toUpperCase() ?? 'GENERAL',
        rewriteLevel: body.level?.toUpperCase() ?? 'MEDIUM',
        responseTime,
      }]).then(({ error }) => {
        if (error) console.error('[Promptly] PromptHistory insert failed:', error.message);
      });

      return NextResponse.json<OptimizeResponse>({
        optimized: optimizedText,
        source: "api"
      });
    }

  } catch (error: any) {
    clearTimeout(routeTimeout);
    const duration = Date.now() - startTime;

    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      captureError(error, { route: '/api/optimize', error: 'request_timeout', duration, provider: 'gemini', tier: 'unknown' });
      return NextResponse.json({ error: "request_timeout" }, { status: 504 });
    }

    captureError(error, { route: '/api/optimize', duration, provider: 'gemini' });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});