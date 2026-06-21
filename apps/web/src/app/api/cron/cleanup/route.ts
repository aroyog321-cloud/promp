import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_key';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    
    // Validate Vercel Cron Secret if deployed
    if (process.env.VERCEL === '1') {
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const oneDayAgoISO = oneDayAgo.toISOString();

    const { data, error } = await supabase
      .from('PromptHistory')
      .delete()
      .eq('isStarred', false)
      .lt('createdAt', oneDayAgoISO);

    if (error) {
      console.error("Cleanup cron error:", error);
      return NextResponse.json({ error: "Failed to delete old prompts", details: error }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Cleanup completed successfully" });
  } catch (error) {
    console.error("Cleanup cron exception:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
