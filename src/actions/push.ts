"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendPush } from "@/lib/push/send";
import { PUSH_TYPES } from "@/lib/push/types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd.");
  return { supabase, userId: user.id };
}

export async function savePushSubscription(sub: { endpoint: string; p256dh: string; auth: string }, userAgent: string) {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: userId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, user_agent: userAgent.slice(0, 200) },
    { onConflict: "endpoint" }
  );
  if (error) throw error;
  revalidatePath("/meldingen");
}

export async function removePushSubscription(endpoint: string) {
  const { supabase } = await requireUser();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  revalidatePath("/meldingen");
}

export async function getPushSettings() {
  const { supabase, userId } = await requireUser();
  const [{ data: prefs }, { count }] = await Promise.all([
    supabase.from("push_preferences").select("disabled_types").eq("user_id", userId).maybeSingle(),
    supabase.from("push_subscriptions").select("id", { count: "exact", head: true }),
  ]);
  return { disabled: (prefs?.disabled_types ?? []) as string[], deviceCount: count ?? 0 };
}

export async function setPushTypeEnabled(type: string, enabled: boolean) {
  if (!PUSH_TYPES.some((t) => t.key === type)) throw new Error("Onbekend type melding.");
  const { supabase, userId } = await requireUser();
  const { data: prefs } = await supabase.from("push_preferences").select("disabled_types").eq("user_id", userId).maybeSingle();
  const set = new Set<string>(prefs?.disabled_types ?? []);
  if (enabled) set.delete(type);
  else set.add(type);
  const { error } = await supabase
    .from("push_preferences")
    .upsert({ user_id: userId, disabled_types: [...set] }, { onConflict: "user_id" });
  if (error) throw error;
  revalidatePath("/meldingen");
}

export async function sendTestPush() {
  const { userId } = await requireUser();
  await sendPush(userId, "test", { title: "Testmelding", body: "Meldingen werken op dit apparaat.", url: "/" });
}
