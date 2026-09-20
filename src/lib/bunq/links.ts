import { createAdminClient } from "@/lib/supabase/admin";
import { bunqApi, getBunqAccount } from "./client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

const money = (n: number) => n.toFixed(2);

export async function createBunqTab(
  userId: string,
  amount: number,
  description: string
): Promise<{ tabId: number; url: string }> {
  const acc = await getBunqAccount(userId);
  const base = `/v1/user/${acc.userId}/monetary-account/${acc.accountId}/bunqme-tab`;
  const created = await bunqApi(userId, "POST", base, {
    bunqme_tab_entry: {
      amount_inquired: { value: money(amount), currency: "EUR" },
      description: description.slice(0, 135),
    },
  });
  const tabId = (created?.Response ?? []).find((i: Json) => i?.Id)?.Id?.id;
  if (!tabId) throw new Error("bunq gaf geen betaallink terug.");

  const tab = await bunqApi(userId, "GET", `${base}/${tabId}`);
  const url = (tab?.Response ?? []).find((i: Json) => i?.BunqMeTab)?.BunqMeTab?.bunqme_tab_share_url;
  if (!url) throw new Error("bunq gaf geen betaallink-URL terug.");
  return { tabId, url };
}

interface LinkRow {
  id: string;
  reference_code: string | null;
  amount: number;
  created_at: string;
  person_name: string | null;
}

const PARTICLES = new Set(["van", "de", "der", "den", "het", "te", "ter", "ten", "t"]);

function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

// How well a payer's name fits a person: counts shared name words (surname
// like "Es" counts, single initials and particles like "van" do not).
function nameScore(personName: string | null, payerName: string | null): number {
  if (!personName || !payerName) return 0;
  const payer = new Set(tokens(payerName));
  return tokens(personName).filter((w) => w.length >= 2 && !PARTICLES.has(w) && payer.has(w)).length;
}

// Detects received payments for open links: matched on reference code, exact
// amount and creation time. Each incoming bunq payment is used for one link
// only. When several people share the same code and amount, the payer's name
// decides; if that is not clear-cut the payment is left for a manual check.
export async function detectBunqPayments(userId: string): Promise<{ detected: number; error?: string }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("bunq_payment_links")
    .select("id, reference_code, amount, created_at, person_name")
    .eq("user_id", userId)
    .eq("status", "open");
  const open = ((data ?? []) as LinkRow[]).filter((l) => l.reference_code);
  if (open.length === 0) return { detected: 0 };

  let detected = 0;
  try {
    const acc = await getBunqAccount(userId);
    const res = await bunqApi(
      userId,
      "GET",
      `/v1/user/${acc.userId}/monetary-account/${acc.accountId}/payment?count=100`
    );
    const payments = (res?.Response ?? []).map((i: Json) => i.Payment).filter(Boolean);
    const { data: used } = await admin
      .from("bunq_payment_links")
      .select("incoming_payment_id")
      .not("incoming_payment_id", "is", null);
    const usedIds = new Set((used ?? []).map((u) => Number(u.incoming_payment_id)));
    const claimed = new Set<string>();

    for (const p of payments) {
      if (usedIds.has(p.id) || !(Number(p.amount?.value) > 0) || typeof p.description !== "string") continue;
      const created = new Date(String(p.created).replace(" ", "T") + "Z").getTime();
      const candidates = open.filter(
        (l) =>
          !claimed.has(l.id) &&
          p.description.toLowerCase().includes(l.reference_code!.toLowerCase()) &&
          Math.abs(Number(p.amount.value) - Number(l.amount)) < 0.005 &&
          created >= new Date(l.created_at).getTime() - 60_000
      );
      if (candidates.length === 0) continue;

      let chosen: LinkRow | null = null;
      if (candidates.length === 1) {
        chosen = candidates[0];
      } else {
        const payer = p.counterparty_alias?.display_name ?? p.counterparty_alias?.label_user?.display_name ?? null;
        const scored = candidates
          .map((l) => ({ l, score: nameScore(l.person_name, payer) }))
          .sort((x, y) => y.score - x.score);
        if (scored[0].score > 0 && scored[0].score > (scored[1]?.score ?? 0)) chosen = scored[0].l;
      }
      if (!chosen) continue;

      const { error } = await admin
        .from("bunq_payment_links")
        .update({ status: "paid", incoming_payment_id: p.id })
        .eq("id", chosen.id)
        .eq("status", "open");
      if (!error) {
        claimed.add(chosen.id);
        usedIds.add(p.id);
        detected++;
      }
    }
  } catch (e) {
    return { detected, error: e instanceof Error ? e.message : "bunq-fout" };
  }
  return { detected };
}

// Forwards received payments to the payout IBAN from the environment. Only
// links whose payment was actually seen arriving (status "paid" with an
// incoming payment id) are swept, each for exactly its own amount and at most
// once: the row is claimed ("sweeping") before the payment is made.
export async function sweepBunqPayments(userId: string): Promise<{ swept: number; error?: string }> {
  const payoutIban = process.env.BUNQ_PAYOUT_IBAN?.replace(/\s+/g, "");
  const payoutName = process.env.BUNQ_PAYOUT_NAME || "Rekeninghouder";
  if (!payoutIban) return { swept: 0 };

  const admin = createAdminClient();
  const { data } = await admin
    .from("bunq_payment_links")
    .select("id, amount, reference_code")
    .eq("user_id", userId)
    .eq("status", "paid")
    .not("incoming_payment_id", "is", null);
  const links = data ?? [];
  if (links.length === 0) return { swept: 0 };

  let swept = 0;
  try {
    const acc = await getBunqAccount(userId);
    const path = `/v1/user/${acc.userId}/monetary-account/${acc.accountId}/payment`;
    for (const link of links) {
      const { data: claimed } = await admin
        .from("bunq_payment_links")
        .update({ status: "sweeping", error: null })
        .eq("id", link.id)
        .eq("status", "paid")
        .select("id");
      if (!claimed || claimed.length === 0) continue;

      try {
        await bunqApi(userId, "POST", path, {
          amount: { value: money(Number(link.amount)), currency: "EUR" },
          counterparty_alias: { type: "IBAN", value: payoutIban, name: payoutName },
          description: `${link.reference_code ?? "Terugvordering"} doorgestort`.slice(0, 135),
        });
        await admin
          .from("bunq_payment_links")
          .update({ status: "swept", swept_at: new Date().toISOString() })
          .eq("id", link.id);
        swept++;
      } catch (e) {
        // The money is still in bunq; put it back so a later run retries.
        await admin
          .from("bunq_payment_links")
          .update({ status: "paid", error: e instanceof Error ? e.message : "Overmaken mislukt" })
          .eq("id", link.id);
        throw e;
      }
    }
  } catch (e) {
    return { swept, error: e instanceof Error ? e.message : "bunq-fout" };
  }
  return { swept };
}
