"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBunqAccount, isBunqConfigured } from "@/lib/bunq/client";
import { createBunqTab, detectBunqPayments } from "@/lib/bunq/links";

async function requireUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd.");
  return { supabase, userId: user.id };
}

export async function testBunqConnection() {
  if (!isBunqConfigured()) return { ok: false as const, message: "BUNQ_API_KEY staat nog niet in Vercel." };
  try {
    const { userId } = await requireUserId();
    const acc = await getBunqAccount(userId);
    return {
      ok: true as const,
      message: `Verbonden met bunq-rekening "${acc.name}"${acc.iban ? ` (${acc.iban})` : ""}.`,
    };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "Verbinding mislukt." };
  }
}

// Creates (or reuses) a bunq.me payment link for one reclaim or one combined request.
export async function createBunqPaymentLink(kind: "reclaim" | "request", id: string, description: string) {
  if (!isBunqConfigured()) throw new Error("bunq is nog niet gekoppeld.");
  const { supabase, userId } = await requireUserId();

  let amount = 0;
  let code: string | null = null;
  let personName: string | null = null;
  if (kind === "reclaim") {
    const { data, error } = await supabase
      .from("reclaims")
      .select("computed_amount, reference_code, status, people(name)")
      .eq("id", id)
      .single();
    if (error) throw error;
    if (data.status !== "requested") throw new Error("Deze terugvordering staat niet meer open.");
    amount = Number(data.computed_amount);
    personName = (Array.isArray(data.people) ? data.people[0] : data.people)?.name ?? null;
    code = data.reference_code;
  } else {
    const { data, error } = await supabase
      .from("payment_requests")
      .select("reference_code, status, people(name), reclaims(computed_amount)")
      .eq("id", id)
      .single();
    if (error) throw error;
    if (data.status !== "requested") throw new Error("Dit verzoek staat niet meer open.");
    amount = (Array.isArray(data.reclaims) ? data.reclaims : []).reduce((s, r) => s + Number(r.computed_amount), 0);
    code = data.reference_code;
    personName = (Array.isArray(data.people) ? data.people[0] : data.people)?.name ?? null;
  }
  amount = Math.round(amount * 100) / 100;
  if (!(amount > 0)) throw new Error("Geen bedrag om terug te vragen.");
  if (!code) throw new Error("Deze terugvordering heeft geen referentiecode.");

  const column = kind === "reclaim" ? "reclaim_id" : "payment_request_id";
  const { data: existing } = await supabase
    .from("bunq_payment_links")
    .select("share_url, amount")
    .eq(column, id)
    .eq("status", "open")
    .order("created_at", { ascending: false });
  const reusable = (existing ?? []).find((l) => Math.abs(Number(l.amount) - amount) < 0.005);
  if (reusable) return { url: reusable.share_url as string };

  const tab = await createBunqTab(userId, amount, `${description} ${code}`.trim());
  const { error: insertError } = await supabase.from("bunq_payment_links").insert({
    user_id: userId,
    [column]: id,
    tab_id: tab.tabId,
    share_url: tab.url,
    amount,
    reference_code: code,
    person_name: personName,
  });
  if (insertError) throw insertError;
  revalidatePath("/", "layout");
  return { url: tab.url };
}

// Checks bunq for received payments and marks the matching reclaims as paid.
export async function checkBunqPayments() {
  const { supabase, userId } = await requireUserId();
  const result = await detectBunqPayments(userId);

  const { data: paid } = await supabase
    .from("bunq_payment_links")
    .select("id, reclaim_id, payment_request_id")
    .eq("status", "paid");
  const now = new Date().toISOString();
  for (const link of paid ?? []) {
    if (link.reclaim_id) {
      await supabase
        .from("reclaims")
        .update({ status: "paid", paid_at: now })
        .eq("id", link.reclaim_id)
        .eq("status", "requested");
    }
    if (link.payment_request_id) {
      await supabase
        .from("payment_requests")
        .update({ status: "paid", paid_at: now })
        .eq("id", link.payment_request_id)
        .eq("status", "requested");
      await supabase
        .from("reclaims")
        .update({ status: "paid", paid_at: now })
        .eq("payment_request_id", link.payment_request_id)
        .eq("status", "requested");
    }
  }
  if ((paid ?? []).length > 0) revalidatePath("/", "layout");
  return result;
}

export async function getBunqLinks() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bunq_payment_links")
    .select("reclaim_id, payment_request_id, share_url, amount, status")
    .in("status", ["open", "paid"]);
  return data ?? [];
}
