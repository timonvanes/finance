"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createWbwExpense,
  fetchWbwBalancesTimed,
  fetchWbwListMembers,
  isWbwConfigured,
  wbwLogin,
  type WbwListBalance,
} from "@/lib/wbw/client";
import { buildShares, matchMember } from "@/lib/wbw/match";

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
const toCents = (euro: number) => Math.round(Number(euro) * 100);

// The WieBetaaltWat lists last read (euro lists only), to choose where an expense goes.
export async function getWbwListChoices(): Promise<{ configured: boolean; lists: { id: string; name: string }[] }> {
  const supabase = await createClient();
  const { data } = await supabase.from("user_settings").select("wbw_lists").maybeSingle();
  const lists = ((data?.wbw_lists ?? []) as WbwListBalance[])
    .filter((l) => l.currency === "EUR")
    .map((l) => ({ id: l.id, name: l.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "nl"));
  return { configured: isWbwConfigured(), lists };
}

export interface WbwMemberChoice {
  id: string;
  name: string;
}

export interface WbwAssignment {
  reclaimId: string;
  personName: string;
  cents: number;
  suggestedMemberId: string | null;
}

// Reads who is in a WieBetaaltWat list and links your people to them on their
// full name (then nickname). Read-only.
export async function loadWbwListMembers(
  listId: string,
  reclaimIds: string[]
): Promise<{ error: string } | { members: WbwMemberChoice[]; assignments: WbwAssignment[] }> {
  try {
    if (!isWbwConfigured()) return { error: "WBW_EMAIL en WBW_PASSWORD staan nog niet in Vercel." };
    const supabase = await createClient();
    const { data: reclaims, error } = await supabase
      .from("reclaims")
      .select("id, computed_amount, people(name)")
      .in("id", reclaimIds);
    if (error || !reclaims || reclaims.length === 0) return { error: "Terugvorderingen niet gevonden." };

    const session = await wbwLogin();
    const [members, balances] = await Promise.all([
      fetchWbwListMembers(session, listId),
      fetchWbwBalancesTimed(session),
    ]);
    const myMemberId = balances.lists.find((l) => l.id === listId)?.memberId;
    if (!myMemberId) return { error: "Je zit niet in deze lijst." };

    const others = members.filter((m) => !m.archived && m.id !== myMemberId);
    return {
      members: others.map((m) => ({ id: m.id, name: m.fullName || m.nickname })),
      assignments: reclaims.map((r) => {
        const personName = one(r.people)?.name ?? "Onbekend";
        return {
          reclaimId: r.id,
          personName,
          cents: toCents(r.computed_amount),
          suggestedMemberId: matchMember(personName, others)?.id ?? null,
        };
      }),
    };
  } catch (e) {
    console.error("loadWbwListMembers failed", e);
    return { error: e instanceof Error ? e.message : "Deelnemers ophalen mislukt." };
  }
}

// Adds ONE expense to a WieBetaaltWat list for the chosen reclaims of one
// payment: you paid the whole bill, each chosen person gets their share, the
// rest is yours. The reclaims are then marked as entered. This is the only
// action that writes to WieBetaaltWat.
export async function pushWbwExpense(
  listId: string,
  assignments: { reclaimId: string; memberId: string }[]
): Promise<{ error: string } | { ok: true; listName: string }> {
  try {
    if (!isWbwConfigured()) return { error: "WBW_EMAIL en WBW_PASSWORD staan nog niet in Vercel." };
    if (assignments.length === 0) return { error: "Kies minstens één persoon om aan te slaan." };

    const supabase = await createClient();
    const ids = assignments.map((a) => a.reclaimId);
    const { data: reclaims, error } = await supabase
      .from("reclaims")
      .select(
        "id, transaction_id, status, settlement_method, payment_request_id, computed_amount, source_total_amount, transactions!reclaims_transaction_id_fkey(counterparty_name, booking_date, amount)"
      )
      .in("id", ids);
    if (error || !reclaims || reclaims.length !== ids.length) return { error: "Terugvorderingen niet gevonden." };

    if (reclaims.some((r) => r.status !== "requested" || r.settlement_method !== "external_app" || r.payment_request_id)) {
      return { error: "Een van deze terugvorderingen is al afgerond of loopt niet via WieBetaaltWat." };
    }
    if (new Set(reclaims.map((r) => r.transaction_id)).size !== 1) {
      return { error: "Dit moeten terugvorderingen van dezelfde uitgave zijn." };
    }

    const tx = one(reclaims[0].transactions);
    const total = reclaims[0].source_total_amount ?? Math.abs(Number(tx?.amount ?? 0));
    const memberOf = new Map(assignments.map((a) => [a.reclaimId, a.memberId]));

    const session = await wbwLogin();
    const [members, balances] = await Promise.all([
      fetchWbwListMembers(session, listId),
      fetchWbwBalancesTimed(session),
    ]);
    const list = balances.lists.find((l) => l.id === listId);
    if (!list?.memberId) return { error: "Je zit niet in deze lijst." };
    const valid = new Set(members.filter((m) => !m.archived).map((m) => m.id));
    if (assignments.some((a) => !valid.has(a.memberId))) return { error: "Een gekozen deelnemer zit niet (meer) in deze lijst." };

    const built = buildShares({
      totalCents: toCents(total),
      others: reclaims.map((r) => ({ memberId: memberOf.get(r.id)!, cents: toCents(r.computed_amount) })),
      myMemberId: list.memberId,
    });
    if ("error" in built) return { error: built.error };

    await createWbwExpense(session, {
      listId,
      name: tx?.counterparty_name?.trim() || "Uitgave",
      payedById: list.memberId,
      date: String(tx?.booking_date ?? new Date().toISOString()).slice(0, 10),
      shares: built.shares,
    });

    // From here the expense exists in WieBetaaltWat: never create it a second time.
    const { error: markError } = await supabase
      .from("reclaims")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .in("id", ids)
      .eq("status", "requested");
    revalidatePath("/", "layout");
    if (markError) {
      return {
        error: `De uitgave staat wel in WieBetaaltWat (lijst ${list.name}), maar het afvinken hier mislukte. Zet de terugvorderingen zelf op ontvangen en maak de uitgave niet nog eens aan.`,
      };
    }
    return { ok: true, listName: list.name };
  } catch (e) {
    console.error("pushWbwExpense failed", e);
    return { error: e instanceof Error ? e.message : "Aanmaken in WieBetaaltWat mislukt." };
  }
}
