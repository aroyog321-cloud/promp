export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized. Missing token.' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    const admin = getSupabaseAdmin();

    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let tier = 'free';
    let total_requests_today = 0;

    const { data: statsData } = await admin
      .from('usage_stats')
      .select('tier, total_requests_today')
      .eq('id', user.id)
      .single();

    if (statsData) {
      tier = statsData.tier ?? 'free';
      total_requests_today = statsData.total_requests_today ?? 0;
    }

    let contextProfile = null;
    const { data: profileData } = await admin
      .from('ContextProfile')
      .select('companyName, websiteURL, industry, audience, writingStyle, brandTone')
      .eq('userId', user.id)
      .eq('name', 'Extension Profile')
      .single();

    if (profileData) {
      contextProfile = {
        companyName: profileData.companyName,
        websiteUrl: profileData.websiteURL,
        industry: profileData.industry,
        audience: profileData.audience,
        writingStyle: profileData.writingStyle,
        brandTone: profileData.brandTone,
      };
    }

    const res = NextResponse.json({ tier, total_requests_today, contextProfile });
    res.headers.set('Cache-Control', 'no-store, max-age=0');
    return res;
  } catch (error) {
    console.error('GET /api/me error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
