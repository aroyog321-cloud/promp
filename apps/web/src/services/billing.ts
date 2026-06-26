import { SupabaseClient } from '@supabase/supabase-js';

export async function checkQuotaAndTier(
  supabaseUserClient: SupabaseClient,
  userId: string,
  isRegeneration: boolean,
  hasContextMemory: boolean
) {
  // FIX #17: Gate context-memory BEFORE incrementing quota.
  // Previously, `increment_usage` consumed the user's daily credit and then
  // returned 403. Now we do a cheap pre-flight read so the quota is not charged.
  if (hasContextMemory) {
    const { data: tierCheck } = await supabaseUserClient
      .from('usage_stats')
      .select('tier')
      .eq('id', userId)
      .single();
    const currentTier = tierCheck?.tier || 'free';
    if (currentTier === 'free' || currentTier === 'pro') {
      return { error: "Context Memory is locked. Upgrade to Expert.", status: 403 };
    }
  }

  const { data: usageData, error: usageError } = await supabaseUserClient.rpc('increment_usage', {
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
    const { data: settingData } = await supabaseAdmin
      .from('SystemSetting')
      .select('value')
      .eq('key', 'optimize_key')
      .single();
    
    if (settingData && settingData.value) {
      const { data: keyData } = await supabaseAdmin
        .from('ApiKey')
        .select('secret')
        .eq('name', settingData.value)
        .eq('enabled', true)
        .single();
        
      if (keyData && keyData.secret) {
        return keyData.secret;
      }
    }
  } catch (e) {
    console.error("Failed to fetch dynamic API key:", e);
  }

  return defaultKey;
}
