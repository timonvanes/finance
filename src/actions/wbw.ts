"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { periodRange } from "@/lib/month";
import { getMonthStartDay } from "@/lib/settings";

// What was fronted for others this period: WieBetaaltWat reclaims tied to a
// transaction booked in this period (regardless of paid/open — the fronting
// happened when the transaction happened).
async function frontedInPeriod(supabase: Awaited<ReturnType<typeof createClient>>, start: string, end: string) {
  const { data } = await supabase
    .from("reclaims")
    .select("computed_amount, transactions!reclaims_transaction_id_fkey(booking_date)")
    .eq("settlement_method", "external_app")
    .gte("transactions.booking_date", start)
    .lt("transactions.booking_date", end);
  return (data ?? []).reduce((sum, r) => sum + Number(r.computed_amount), 0);
}

export async function getWbwStatus() {
  const supabase = await createClient();
  const startDay = await getMonthStartDay();
  const period = periodRange(0, startDay);
  const prevPeriod = periodRange(1, startDay);

  const [{ data: entries }, fronted, prevFronted] = await Promise.all([
    supabase.from("wbw_balances").select("period_start, balance").order("period_start", { ascending: false }).limit(2),
    frontedInPeriod(supabase, period.start, period.end),
    frontedInPeriod(supabase, prevPeriod.start, prevPeriod.end),
  ]);

  const current = entries?.find((e) => e.period_start === period.start) ?? null;
  const previous = entries?.find((e) => e.period_start !== period.start) ?? null;

  const expected = previous ? Number(previous.balance) + fronted : null;

  return {
    periodStart: period.start,
    periodLabel: period.labelDate.toLocaleDateString("nl-NL", { month: "long", year: "numeric" }),
    hasCurrent: Boolean(current),
    currentBalance: current ? Number(current.balance) : null,
    previousBalance: previous ? Number(previous.balance) : null,
    frontedThisPeriod: fronted,
    prevFrontedThisPeriod: prevFronted,
    expected,
  };
}

// Saves this period's WBW balance and, if a previous balance is known, books
// the gap (others fronted more than expected) as an expense.
export async function saveWbwBalance(balance: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd.");

  const startDay = await getMonthStartDay();
  const period = periodRange(0, startDay);

  const { data: prevRows } = await supabase
    .from("wbw_balances")
    .select("period_start, balance")
    .lt("period_start", period.start)
    .order("period_start", { ascending: false })
    .limit(1);
  const previous = prevRows?.[0] ?? null;

  const { error } = await supabase
    .from("wbw_balances")
    .upsert({ user_id: user.id, period_start: period.start, balance }, { onConflict: "user_id,period_start" });
  if (error) throw error;

  await supabase.from("wbw_fronted_expenses").delete().eq("period_start", period.start);
  if (previous) {
    const fronted = await frontedInPeriod(supabase, period.start, period.end);
    const expected = Number(previous.balance) + fronted;
    const gap = Math.round((expected - balance) * 100) / 100;
    if (gap > 0.5) {
      const { error: expenseError } = await supabase
        .from("wbw_fronted_expenses")
        .insert({ user_id: user.id, period_start: period.start, amount: gap });
      if (expenseError) throw expenseError;
    }
  }
  revalidatePath("/", "layout");
}
