import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { clampStartDay } from "@/lib/month";

// Cached per request: the dashboard asks for it from several places.
export const getMonthStartDay = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const { data } = await supabase.from("user_settings").select("month_start_day").maybeSingle();
  return clampStartDay(data?.month_start_day ?? 1);
});

export const getHiddenDashboardModules = cache(async (): Promise<string[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("user_settings").select("dashboard_hidden").maybeSingle();
  return (data?.dashboard_hidden ?? []) as string[];
});

export const getInvestReminderDay = cache(async (): Promise<number | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("user_settings").select("invest_reminder_day").maybeSingle();
  return data?.invest_reminder_day ?? null;
});

// bunq payment links need a paid bunq plan, so they are off unless switched on.
export const getBunqPaymentLinksEnabled = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { data } = await supabase.from("user_settings").select("use_bunq_payment_links").maybeSingle();
  return data?.use_bunq_payment_links === true;
});

// Days of slack around a pot's deposit day (see computeSchedule).
export const getPotGraceDays = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const { data } = await supabase.from("user_settings").select("pot_grace_days").maybeSingle();
  return data?.pot_grace_days ?? 3;
});

export const getCalendarToken = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("user_settings").select("calendar_token").maybeSingle();
  return data?.calendar_token ?? null;
});
