import { SupabaseClient } from '@supabase/supabase-js';

export async function checkQuotaAndTier(
  supabaseAdmin: SupabaseClient,
  userId: string,
  isRegeneration: boolean,
  hasContextMemory: boolean
) {
  // FIX #17: Gate context-memory BEFORE incrementing quota.
  // Previously, `increment_usage` consumed the user's daily credit and then
  // returned 403. Now we do a cheap pre-flight read so the quota is not charged.
  if (hasContextMemory) {
    const { data: tierCheck } = await supabaseAdmin
      .from('usage_stats')
      .select('tier')
      .eq('id', userId)
      .single();
    const currentTier = tierCheck?.tier || 'free';
    if (currentTier === 'free' || currentTier === 'pro') {
      return { error: "Context Memory is locked. Upgrade to Expert.", status: 403 };
    }
  }

  const { data: usageData, error: usageError } = await supabaseAdmin.rpc('increment_usage', {
    p_user_id: userId,
    p_is_regen: isRegeneration
  });

  if (usageError) {
    console.error("Usage tracking error:", usageError);
    return { error: "Usage tracking error. Please try again.", status: 500 };
  }

  if (!usageData || usageData.length === 0) {
    return { error: "Usage tracking error. No data returned.", status: 500 };
  }

  const tier = usageData[0].tier || 'free';

  if (!usageData[0].allowed) {
    const msg = tier === 'free' 
      ? (isRegeneration ? "Regeneration limit reached for today (4/4). Upgrade to Pro." : "Daily limit reached (10/10). Upgrade to Pro for 50/day.")
      : (isRegeneration ? "Regeneration limit reached for today (50/50). Upgrade to Expert." : "Daily limit reached (50/50). Upgrade to Expert for unlimited.");
    return { error: msg, status: 403 };
  }

  return { tier, error: null };
}


export async function getDynamicApiKey(supabaseAdmin: SupabaseClient, defaultKey: string | undefined) {
  try {
    // 1. Find which key name is currently active
    const { data: settingData, error: settingError } = await supabaseAdmin
      .from('SystemSetting')
      .select('value')
      .eq('key', 'optimize_key')
      .single();

    if (settingError || !settingData?.value) {
      console.warn('[Proenpt] SystemSetting "optimize_key" not found — falling back to GEMINI_API_KEY env var.');
      return defaultKey;
    }

    // 2. Fetch the actual secret for that key name
    const { data: keyData, error: keyError } = await supabaseAdmin
      .from('ApiKey')
      .select('secret')
      .eq('name', settingData.value)
      .eq('enabled', true)
      .single();

    if (keyError || !keyData?.secret) {
      console.warn(
        `[Proenpt] ApiKey "${settingData.value}" not found or disabled in Supabase — ` +
        'falling back to GEMINI_API_KEY env var. ' +
        'To fix: run the UPDATE command in Supabase SQL editor with your new key.'
      );
      return defaultKey;
    }

    // Success — key loaded from Supabase
    return keyData.secret;
  } catch (e) {
    console.error('[Proenpt] Unexpected error fetching dynamic API key from Supabase:', e);
  }

  return defaultKey;
}
