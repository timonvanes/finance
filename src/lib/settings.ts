import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { clampStartDay } from "@/lib/month";

// Cached per request: the dashboard asks for it from several places.
export const getMonthStartDay = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const { data } = await supabase.from("user_settings").select("month_start_day").maybeSingle();
  return clampStartDay(data?.month_start_day ?? 1);
});
