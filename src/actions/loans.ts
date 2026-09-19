"use server";

import { createClient } from "@/lib/supabase/server";

type LoanEntryRow = {
  id: string;
  kind: "borrow" | "repay";
  amount: number;
  entry_date: string;
  transaction_id: string | null;
  transactions: { counterparty_name: string | null } | { counterparty_name: string | null }[] | null;
};

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export async function getLoans() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("loans")
    .select(
      `id, person_id, note, status, closed_reason, created_at, people(name),
      loan_entries(id, kind, amount, entry_date, transaction_id, transactions(counterparty_name))`
    )
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((loan) => {
    const entries = ((loan.loan_entries ?? []) as unknown as LoanEntryRow[])
      .map((e) => ({
        id: e.id,
        kind: e.kind,
        amount: Number(e.amount),
        date: e.entry_date,
        fromTransaction: e.transaction_id != null,
        counterparty: one(e.transactions)?.counterparty_name ?? null,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
    const borrowed = entries.filter((e) => e.kind === "borrow").reduce((s, e) => s + e.amount, 0);
    const repaid = entries.filter((e) => e.kind === "repay").reduce((s, e) => s + e.amount, 0);
    return {
      id: loan.id as string,
      personId: loan.person_id as string,
      personName: (one(loan.people as { name: string } | { name: string }[] | null)?.name ?? "Onbekend") as string,
      note: loan.note as string | null,
      status: loan.status as "open" | "closed",
      closedReason: loan.closed_reason as "repaid" | "forgiven" | null,
      borrowed,
      repaid,
      balance: borrowed - repaid,
      entries,
    };
  });
}

// Everything the transaction list needs to offer loan actions: who can lend,
// which loans are open, and which listed transactions already belong to one.
export async function getLoanPickerData(transactionIds: string[]) {
  const supabase = await createClient();
  const [{ data: people }, loans, { data: entries }] = await Promise.all([
    supabase.from("people").select("id, name, is_self").order("name"),
    getLoans(),
    transactionIds.length > 0
      ? supabase
          .from("loan_entries")
          .select("transaction_id, kind, loans(id, people(name))")
          .in("transaction_id", transactionIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const entryByTransaction: Record<string, { loanId: string; personName: string; kind: string }> = {};
  for (const e of (entries ?? []) as unknown as {
    transaction_id: string;
    kind: string;
    loans: { id: string; people: { name: string } | { name: string }[] | null } | { id: string; people: { name: string } | { name: string }[] | null }[] | null;
  }[]) {
    const loan = one(e.loans);
    if (!loan) continue;
    entryByTransaction[e.transaction_id] = {
      loanId: loan.id,
      personName: one(loan.people)?.name ?? "Onbekend",
      kind: e.kind,
    };
  }

  return {
    people: (people ?? []).filter((p) => !p.is_self).map((p) => ({ id: p.id as string, name: p.name as string })),
    openLoans: loans
      .filter((l) => l.status === "open")
      .map((l) => ({ id: l.id, personName: l.personName, balance: l.balance })),
    entryByTransaction,
  };
}

export async function getOpenLoansTotal() {
  const loans = await getLoans();
  const open = loans.filter((l) => l.status === "open");
  return { count: open.length, total: open.reduce((s, l) => s + Math.max(l.balance, 0), 0) };
}

async function markHandled(transactionId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ is_transfer: true, reviewed: true, flagged_for_reclaim: false })
    .eq("id", transactionId);
  if (error) throw error;
}

// An incoming transaction turns out to be a loan: either the start of a new
// loan from a person, or more money added to one that's already open.
export async function markTransactionAsLoan(
  transactionId: string,
  target: { loanId?: string; personId?: string }
) {
  const supabase = await createClient();
  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .select("amount, booking_date")
    .eq("id", transactionId)
    .single();
  if (txError) throw txError;
  if (tx.amount <= 0) throw new Error("Alleen een bijschrijving kan een lening zijn.");

  let loanId = target.loanId;
  if (loanId) {
    // Borrowing more on a loan that was closed reopens it.
    const { error } = await supabase
      .from("loans")
      .update({ status: "open", closed_reason: null })
      .eq("id", loanId);
    if (error) throw error;
  } else if (target.personId) {
    const { data, error } = await supabase
      .from("loans")
      .insert({ person_id: target.personId })
      .select("id")
      .single();
    if (error) throw error;
    loanId = data.id;
  } else {
    throw new Error("Kies van wie de lening is.");
  }

  const { error: entryError } = await supabase.from("loan_entries").insert({
    loan_id: loanId,
    transaction_id: transactionId,
    kind: "borrow",
    amount: tx.amount,
    entry_date: tx.booking_date,
  });
  if (entryError) throw entryError;

  await markHandled(transactionId);
}

async function autoCloseIfRepaid(loanId: string) {
  const supabase = await createClient();
  const { data: entries } = await supabase.from("loan_entries").select("kind, amount").eq("loan_id", loanId);
  const balance = (entries ?? []).reduce(
    (s, e) => s + (e.kind === "borrow" ? Number(e.amount) : -Number(e.amount)),
    0
  );
  if (balance <= 0.005) {
    await supabase.from("loans").update({ status: "closed", closed_reason: "repaid" }).eq("id", loanId);
  }
}

// An outgoing transaction is a (partial) repayment of an open loan.
export async function markTransactionAsRepayment(transactionId: string, loanId: string) {
  const supabase = await createClient();
  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .select("amount, booking_date")
    .eq("id", transactionId)
    .single();
  if (txError) throw txError;
  if (tx.amount >= 0) throw new Error("Alleen een afschrijving kan een aflossing zijn.");

  const { error: entryError } = await supabase.from("loan_entries").insert({
    loan_id: loanId,
    transaction_id: transactionId,
    kind: "repay",
    amount: Math.abs(tx.amount),
    entry_date: tx.booking_date,
  });
  if (entryError) throw entryError;

  await markHandled(transactionId);
  await autoCloseIfRepaid(loanId);
}

// Repaid in cash or some other way that never showed up as a transaction.
export async function addManualRepayment(loanId: string, amount: number) {
  if (!(amount > 0)) throw new Error("Vul een bedrag in.");
  const supabase = await createClient();
  const { error } = await supabase.from("loan_entries").insert({
    loan_id: loanId,
    kind: "repay",
    amount,
    entry_date: new Date().toISOString().slice(0, 10),
  });
  if (error) throw error;
  await autoCloseIfRepaid(loanId);
}

export async function closeLoan(loanId: string, reason: "repaid" | "forgiven") {
  const supabase = await createClient();
  const { error } = await supabase
    .from("loans")
    .update({ status: "closed", closed_reason: reason })
    .eq("id", loanId);
  if (error) throw error;
}

export async function reopenLoan(loanId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("loans")
    .update({ status: "open", closed_reason: null })
    .eq("id", loanId);
  if (error) throw error;
}

// Detaches a transaction from its loan and puts it back on the to-do list.
export async function removeLoanEntryForTransaction(transactionId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("loan_entries").delete().eq("transaction_id", transactionId);
  if (error) throw error;
  const { error: txError } = await supabase
    .from("transactions")
    .update({ is_transfer: false, reviewed: false })
    .eq("id", transactionId);
  if (txError) throw txError;
}

export async function removeLoanEntry(entryId: string) {
  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("loan_entries")
    .select("transaction_id")
    .eq("id", entryId)
    .single();
  if (entry?.transaction_id) {
    await removeLoanEntryForTransaction(entry.transaction_id);
  } else {
    const { error } = await supabase.from("loan_entries").delete().eq("id", entryId);
    if (error) throw error;
  }
}
