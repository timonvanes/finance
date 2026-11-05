"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  createWbwExpense,
  fetchWbwBalancesTimed,
  fetchWbwListMembers,
  isWbwConfigured,
  wbwLogin,
  type WbwListBalance,
  type WbwSession,
} from "@/lib/wbw/client";
import { buildShares, matchMember } from "@/lib/wbw/match";
import { todayAmsterdam } from "@/lib/wbw/record";

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
  nickname: string;
}

export interface WbwAssignment {
  reclaimId: string;
  personName: string;
  cents: number;
  suggestedMemberId: string | null;
}

// Who is in a WieBetaaltWat list, apart from you (read-only). Used while making a
// reclaim: you split the bill over these people right away.
export async function getWbwMembersForList(
  listId: string
): Promise<{ error: string } | { members: WbwMemberChoice[] }> {
  try {
    if (!isWbwConfigured()) return { error: "WBW_EMAIL en WBW_PASSWORD staan nog niet in Vercel." };
    const session = await wbwLogin();
    const [members, balances] = await Promise.all([
      fetchWbwListMembers(session, listId),
      fetchWbwBalancesTimed(session),
    ]);
    const myMemberId = balances.lists.find((l) => l.id === listId)?.memberId;
    if (!myMemberId) return { error: "Je zit niet in deze lijst." };
    return {
      members: members
        .filter((m) => !m.archived && m.id !== myMemberId)
        .map((m) => ({ id: m.id, name: m.fullName || m.nickname, nickname: m.nickname })),
    };
  } catch (e) {
    console.error("getWbwMembersForList failed", e);
    return { error: e instanceof Error ? e.message : "Deelnemers ophalen mislukt." };
  }
}

// For reclaims made before the list and member were chosen up front: reads the
// members of a list and links your people to them on their full name (then
// nickname). Read-only.
export async function loadWbwListMembers(
  listId: string,
  reclaimIds: string[]
): Promise<{ error: string } | { members: WbwMemberChoice[]; assignments: WbwAssignment[] }> {
  try {
    const supabase = await createClient();
    const { data: reclaims, error } = await supabase
      .from("reclaims")
      .select("id, computed_amount, people(name)")
      .in("id", reclaimIds);
    if (error || !reclaims || reclaims.length === 0) return { error: "Terugvorderingen niet gevonden." };

    const r = await getWbwMembersForList(listId);
    if ("error" in r) return r;
    return {
      members: r.members,
      assignments: reclaims.map((rc) => {
        const personName = one(rc.people)?.name ?? "Onbekend";
        const match = matchMember(
          personName,
          r.members.map((m) => ({ id: m.id, nickname: m.nickname, fullName: m.name, archived: false }))
        );
        return {
          reclaimId: rc.id,
          personName,
          cents: toCents(rc.computed_amount),
          suggestedMemberId: match?.id ?? null,
        };
      }),
    };
  } catch (e) {
    console.error("loadWbwListMembers failed", e);
    return { error: e instanceof Error ? e.message : "Deelnemers ophalen mislukt." };
  }
}

interface ReclaimRow {
  id: string;
  transaction_id: string;
  status: string;
  settlement_method: string;
  payment_request_id: string | null;
  computed_amount: number;
  source_total_amount: number | null;
  note: string | null;
  wbw_list_id: string | null;
  wbw_member_id: string | null;
  wbw_group_id: string | null;
  transactions:
    | { counterparty_name: string | null; booking_date: string; amount: number }
    | { counterparty_name: string | null; booking_date: string; amount: number }[]
    | null;
}

const RECLAIM_COLUMNS =
  "id, transaction_id, status, settlement_method, payment_request_id, computed_amount, source_total_amount, note, wbw_list_id, wbw_member_id, wbw_group_id, transactions!reclaims_transaction_id_fkey(counterparty_name, booking_date, amount)";

// Puts ONE group of reclaims into WieBetaaltWat as ONE expense: you paid the
// bills, each person gets the sum of their parts, the rest is yours. Several
// payments in a group are added up. Afterwards the reclaims are marked as
// entered and remember which expense they became.
async function pushGroup(
  supabase: SupabaseClient,
  session: WbwSession,
  list: { id: string; name: string; memberId: string },
  validMembers: Set<string>,
  group: ReclaimRow[],
  memberOf: Map<string, string>,
  name?: string
): Promise<{ error: string } | { ok: true }> {
  if (group.some((r) => r.status !== "requested" || r.settlement_method !== "external_app" || r.payment_request_id)) {
    return { error: "Een van deze terugvorderingen is al afgerond of loopt niet via WieBetaaltWat." };
  }
  if (group.some((r) => !memberOf.get(r.id) || !validMembers.has(memberOf.get(r.id)!))) {
    return { error: "Een gekozen deelnemer zit niet (meer) in deze lijst." };
  }

  // Every payment counts once, however many people share it.
  const txs = new Map<string, { name: string | null; date: string; amount: number }>();
  for (const r of group) {
    const tx = one(r.transactions);
    if (tx && !txs.has(r.transaction_id)) {
      txs.set(r.transaction_id, { name: tx.counterparty_name, date: String(tx.booking_date), amount: Math.abs(Number(tx.amount)) });
    }
  }
  const totalCents = txs.size > 0 ? [...txs.values()].reduce((s, t) => s + toCents(t.amount), 0) : toCents(group[0].source_total_amount ?? 0);

  const built = buildShares({
    totalCents,
    others: group.map((r) => ({ memberId: memberOf.get(r.id)!, cents: toCents(r.computed_amount) })),
    myMemberId: list.memberId,
  });
  if ("error" in built) return { error: built.error };

  const merchants = [...new Set([...txs.values()].map((t) => t.name?.trim()).filter(Boolean) as string[])];
  const description =
    name?.trim() ||
    group.map((r) => r.note?.trim()).find(Boolean) ||
    (merchants.length > 0 ? merchants.slice(0, 3).join(" + ") : "Uitgave");
  // Dated the day it is entered, not the day of the payment: no backdating, so the
  // WieBetaaltWat saldo moves on the day you put it in.
  const date = todayAmsterdam();

  const created = await createWbwExpense(session, {
    listId: list.id,
    name: description.slice(0, 255),
    payedById: list.memberId,
    date: date.slice(0, 10),
    shares: built.shares,
  });

  // From here the expense exists in WieBetaaltWat: never create it a second time.
  const ids = group.map((r) => r.id);
  const { error: markError } = await supabase
    .from("reclaims")
    .update({ status: "paid", paid_at: new Date().toISOString(), wbw_expense_id: created.id || null })
    .in("id", ids)
    .eq("status", "requested");
  if (markError) {
    return {
      error: `De uitgave staat wel in WieBetaaltWat (lijst ${list.name}), maar het afvinken hier mislukte. Zet de terugvorderingen zelf op ontvangen en maak de uitgave niet nog eens aan.`,
    };
  }
  return { ok: true };
}

async function openList(session: WbwSession, listId: string) {
  const [members, balances] = await Promise.all([
    fetchWbwListMembers(session, listId),
    fetchWbwBalancesTimed(session),
  ]);
  const entry = balances.lists.find((l) => l.id === listId);
  if (!entry?.memberId) return null;
  return {
    list: { id: listId, name: entry.name, memberId: entry.memberId },
    valid: new Set(members.filter((m) => !m.archived).map((m) => m.id)),
  };
}

// Interactive: the person for each reclaim is chosen here (reclaims made before
// the list and member were stored). All chosen reclaims become ONE expense.
export async function pushWbwExpense(
  listId: string,
  assignments: { reclaimId: string; memberId: string }[],
  name?: string
): Promise<{ error: string } | { ok: true; listName: string }> {
  try {
    if (!isWbwConfigured()) return { error: "WBW_EMAIL en WBW_PASSWORD staan nog niet in Vercel." };
    if (assignments.length === 0) return { error: "Kies minstens één persoon om aan te slaan." };

    const supabase = await createClient();
    const ids = assignments.map((a) => a.reclaimId);
    const { data, error } = await supabase.from("reclaims").select(RECLAIM_COLUMNS).in("id", ids);
    const reclaims = (data ?? []) as unknown as ReclaimRow[];
    if (error || reclaims.length !== ids.length) return { error: "Terugvorderingen niet gevonden." };

    const session = await wbwLogin();
    const opened = await openList(session, listId);
    if (!opened) return { error: "Je zit niet in deze lijst." };

    const result = await pushGroup(
      supabase,
      session,
      opened.list,
      opened.valid,
      reclaims,
      new Map(assignments.map((a) => [a.reclaimId, a.memberId])),
      name
    );
    revalidatePath("/", "layout");
    if ("error" in result) return result;
    return { ok: true, listName: opened.list.name };
  } catch (e) {
    console.error("pushWbwExpense failed", e);
    return { error: e instanceof Error ? e.message : "Aanmaken in WieBetaaltWat mislukt." };
  }
}

// Uses the list and member chosen when the reclaims were made: one tap. Reclaims
// in the same combination (and everything that belongs with them) become one
// expense; the rest becomes one expense per payment.
export async function pushStoredWbw(
  reclaimIds: string[],
  name?: string
): Promise<{ error: string } | { ok: true; listName: string; expenses: number }> {
  try {
    if (!isWbwConfigured()) return { error: "WBW_EMAIL en WBW_PASSWORD staan nog niet in Vercel." };
    if (reclaimIds.length === 0) return { error: "Niets om door te voeren." };

    const supabase = await createClient();
    const { data: first, error } = await supabase.from("reclaims").select(RECLAIM_COLUMNS).in("id", reclaimIds);
    if (error || !first || first.length !== reclaimIds.length) return { error: "Terugvorderingen niet gevonden." };

    // What belongs together goes in together: a combination as a whole, and every
    // open WieBetaaltWat reclaim of the same payment (otherwise the payment would
    // end up in WieBetaaltWat twice, once per person).
    let reclaims = first as unknown as ReclaimRow[];
    for (let pass = 0; pass < 3; pass++) {
      const groupIds = [...new Set(reclaims.map((r) => r.wbw_group_id).filter(Boolean))] as string[];
      const txIds = [...new Set(reclaims.map((r) => r.transaction_id))];
      const filters = [`transaction_id.in.(${txIds.join(",")})`, ...(groupIds.length > 0 ? [`wbw_group_id.in.(${groupIds.join(",")})`] : [])];
      const { data: more } = await supabase
        .from("reclaims")
        .select(RECLAIM_COLUMNS)
        .or(filters.join(","))
        .eq("status", "requested")
        .eq("settlement_method", "external_app");
      const byId = new Map(reclaims.map((r) => [r.id, r]));
      for (const r of (more ?? []) as unknown as ReclaimRow[]) byId.set(r.id, r);
      if (byId.size === reclaims.length) break;
      reclaims = [...byId.values()];
    }

    if (reclaims.some((r) => !r.wbw_list_id || !r.wbw_member_id)) {
      return { error: "Voor deze terugvordering is nog geen lijst en deelnemer gekozen. Kies ze hieronder." };
    }
    if (new Set(reclaims.map((r) => r.wbw_list_id)).size !== 1) {
      return { error: "Deze terugvorderingen horen bij verschillende WieBetaaltWat-lijsten." };
    }
    const listId = reclaims[0].wbw_list_id!;

    // One expense per combination, otherwise one per payment.
    const groups = new Map<string, ReclaimRow[]>();
    for (const r of reclaims) {
      const key = r.wbw_group_id ? `g:${r.wbw_group_id}` : `t:${r.transaction_id}`;
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }

    const session = await wbwLogin();
    const opened = await openList(session, listId);
    if (!opened) return { error: "Je zit niet in deze lijst." };
    const memberOf = new Map(reclaims.map((r) => [r.id, r.wbw_member_id!]));

    let made = 0;
    for (const group of groups.values()) {
      const result = await pushGroup(supabase, session, opened.list, opened.valid, group, memberOf, groups.size === 1 ? name : undefined);
      if ("error" in result) {
        revalidatePath("/", "layout");
        return { error: made > 0 ? `${made} uitgave(n) staan al in WieBetaaltWat. ${result.error}` : result.error };
      }
      made++;
    }
    revalidatePath("/", "layout");
    return { ok: true, listName: opened.list.name, expenses: made };
  } catch (e) {
    console.error("pushStoredWbw failed", e);
    return { error: e instanceof Error ? e.message : "Aanmaken in WieBetaaltWat mislukt." };
  }
}
