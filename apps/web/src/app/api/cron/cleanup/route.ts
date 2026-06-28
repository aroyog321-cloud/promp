import { NextResponse } from 'next/server';


import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: Request) {
  try {
    // FIX 2.1: Always require CRON_SECRET — not just on Vercel.
    // Previously the check was gated on VERCEL==='1', allowing anyone to hit
    // this endpoint unauthenticated in local / Docker / non-Vercel deployments.
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

    // FIX 3.26: Batch DELETEs in chunks of 1000 to avoid long table locks.
    let totalDeleted = 0;
    let keepGoing = true;
    while (keepGoing) {
      // Supabase doesn't support LIMIT on DELETE directly; select IDs first.
      const { data: ids, error: selectError } = await getSupabaseAdmin()
        .from('PromptHistory')
        .select('id')
        .eq('isStarred', false)
        .lt('createdAt', thirtyDaysAgoISO)
        .limit(1000);

      if (selectError) {
        console.error("Cleanup cron select error:", selectError);
        return NextResponse.json({ error: "Failed to query old prompts", details: selectError }, { status: 500 });
      }

      if (!ids || ids.length === 0) { keepGoing = false; break; }

      const { error: deleteError } = await getSupabaseAdmin()
        .from('PromptHistory')
        .delete()
        .in('id', ids.map((r: { id: string }) => r.id));

      if (deleteError) {
        console.error("Cleanup cron delete error:", deleteError);
        return NextResponse.json({ error: "Failed to delete old prompts", details: deleteError }, { status: 500 });
      }

      totalDeleted += ids.length;
      if (ids.length < 1000) keepGoing = false;
    }

    return NextResponse.json({ success: true, message: `Cleanup completed. Deleted ${totalDeleted} entries.` });
  } catch (error) {
    console.error("Cleanup cron exception:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
