import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Supabase's free tier pauses a project after ~7 days with no API activity,
// which then needs a manual "restore" click in the dashboard before the app
// works again. This route just needs to touch the database — triggered by
// Vercel Cron well within that window (see vercel.json) — so the project
// never goes quiet long enough to be paused.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("bank_connections").select("id").limit(1);
  if (error) {
    console.error("keep-alive: Supabase ping failed", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pingedAt: new Date().toISOString() });
}
