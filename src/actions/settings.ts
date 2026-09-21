"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { clampStartDay } from "@/lib/month";
import { DASHBOARD_MODULES } from "@/lib/dashboard/modules";

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

export async function setDashboardModuleVisible(key: string, visible: boolean) {
  if (!DASHBOARD_MODULES.some((m) => m.key === key)) throw new Error("Onbekend onderdeel.");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd.");

  const { data } = await supabase.from("user_settings").select("dashboard_hidden").maybeSingle();
  const hidden = new Set<string>(data?.dashboard_hidden ?? []);
  if (visible) hidden.delete(key);
  else hidden.add(key);

  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, dashboard_hidden: [...hidden], updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
  revalidatePath("/", "layout");
}
