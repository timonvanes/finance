"use server";

import { createClient } from "@/lib/supabase/server";
import { clampStartDay } from "@/lib/month";

export async function setMonthStartDay(day: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd.");

  const { error } = await supabase
    .from("user_settings")
    .upsert(
      { user_id: user.id, month_start_day: clampStartDay(day), updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  if (error) throw error;
}
