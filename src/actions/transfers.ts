"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPsuContext } from "@/actions/bank-connections";
import { signPaymentState, startTransfer, type TransferMode } from "@/lib/enablebanking/payments";

export interface TransferResult {
  error?: string;
}

const cleanIban = (raw: string) => raw.replace(/\s+/g, "").toUpperCase();
const MAX_AMOUNT = 10_000;

async function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

// Starts a transfer between two of the person's OWN accounts (once, or every month as a
// standing order). Nothing is sent from here: the person is sent to their bank to approve it.
export async function startOwnTransfer(_prev: TransferResult, formData: FormData): Promise<TransferResult> {
  const fromAccountId = String(formData.get("fromAccountId") ?? "");
  const toIban = cleanIban(String(formData.get("toIban") ?? ""));
  const mode: TransferMode = formData.get("mode") === "monthly" ? "monthly" : "once";
  const firstDate = String(formData.get("firstDate") ?? "");
  const amountNumber = Number(String(formData.get("amount") ?? "").replace(",", "."));

  if (!Number.isFinite(amountNumber) || amountNumber < 0.01 || amountNumber > MAX_AMOUNT) {
    return { error: `Vul een bedrag in tussen € 0,01 en € ${MAX_AMOUNT.toLocaleString("nl-NL")}.` };
  }
  const amount = (Math.round(amountNumber * 100) / 100).toFixed(2);
  if (mode === "monthly" && !/^\d{4}-\d{2}-\d{2}$/.test(firstDate)) return { error: "Kies de datum van de eerste overschrijving." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Niet ingelogd." };

  // The account it leaves from: one of this person's, on a bank that is linked.
  const { data: from } = await supabase
    .from("bank_accounts")
    .select("iban, bank_connections!inner(institution_name, institution_country, consent_status)")
    .eq("id", fromAccountId)
    .maybeSingle();
  const connection = Array.isArray(from?.bank_connections) ? from?.bank_connections[0] : from?.bank_connections;
  if (!from?.iban || !connection || connection.consent_status !== "linked") return { error: "Kies een rekening van een gekoppelde bank." };
  const fromIban = cleanIban(from.iban as string);

  // Where it goes: only an account that is the person's own (linked, or entered as own account).
  const [{ data: linked }, { data: manual }] = await Promise.all([
    supabase.from("bank_accounts").select("iban, display_name"),
    supabase.from("manual_own_ibans").select("iban, label"),
  ]);
  const own = new Map<string, string>();
  for (const a of linked ?? []) if (a.iban) own.set(cleanIban(a.iban as string), (a.display_name as string | null) ?? "Eigen rekening");
  for (const a of manual ?? []) own.set(cleanIban(a.iban as string), (a.label as string | null) ?? "Eigen rekening");
  if (!own.has(toIban)) return { error: "Je kunt alleen overmaken naar je eigen rekeningen." };
  if (toIban === fromIban) return { error: "Van en naar mag niet dezelfde rekening zijn." };

  let url: string;
  try {
    const base = await siteUrl();
    const result = await startTransfer({
      aspspName: connection.institution_name as string,
      aspspCountry: connection.institution_country as string,
      debtorIban: fromIban,
      creditorIban: toIban,
      creditorName: own.get(toIban) ?? "Eigen rekening",
      amount,
      description: "Sparen potjes",
      mode,
      firstDate: mode === "monthly" ? firstDate : null,
      // The same address the bank link already uses: the one registered with Enable Banking.
      redirectUrl: `${base}/api/enablebanking/callback`,
      state: signPaymentState({ amount, mode }),
      psu: await getPsuContext(),
    });
    url = result.url;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("startOwnTransfer failed", message);
    // The bank or Enable Banking may refuse: say so in plain words, with the reason kept short.
    return { error: `De bank of Enable Banking weigerde dit. ${message.replace(/^Enable Banking request failed: /, "").slice(0, 240)}` };
  }
  redirect(url);
}
