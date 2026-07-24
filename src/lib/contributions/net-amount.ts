import type { SupabaseClient } from "@supabase/supabase-js";

export interface ContributionAdjustments {
  // expense_transaction_id -> total contributed towards it (subtract from spend)
  expenseReduction: Map<string, number>;
  // source_transaction_id -> total allocated away (subtract from income)
  sourceReduction: Map<string, number>;
}

// Both manual "Bijdrage" contributions AND reclaims reduce what counts as
// true spend on the underlying transaction — a reclaim is just as much
// "not really your cost" as a huurtoeslag contribution, as long as you're
// still expecting the money back. Only "written_off" reclaims are excluded
// here on purpose: once you give up on collecting, that portion becomes a
// real expense again.
export async function getContributionAdjustments(
  supabase: SupabaseClient,
  transactionIds: string[]
): Promise<ContributionAdjustments> {
  const empty = { expenseReduction: new Map<string, number>(), sourceReduction: new Map<string, number>() };
  if (transactionIds.length === 0) return empty;

  const idList = transactionIds.join(",");
  const [{ data: contributions }, { data: reclaims }] = await Promise.all([
    supabase
      .from("expense_contributions")
      .select("expense_transaction_id, source_transaction_id, amount")
      .or(`expense_transaction_id.in.(${idList}),source_transaction_id.in.(${idList})`),
    supabase
      .from("reclaims")
      .select("transaction_id, settled_transaction_id, computed_amount")
      .in("status", ["requested", "paid"])
      .or(`transaction_id.in.(${idList}),settled_transaction_id.in.(${idList})`),
  ]);

  const expenseReduction = new Map<string, number>();
  const sourceReduction = new Map<string, number>();

  for (const c of contributions ?? []) {
    expenseReduction.set(
      c.expense_transaction_id,
      (expenseReduction.get(c.expense_transaction_id) ?? 0) + c.amount
    );
    if (c.source_transaction_id) {
      sourceReduction.set(c.source_transaction_id, (sourceReduction.get(c.source_transaction_id) ?? 0) + c.amount);
    }
  }

  for (const r of reclaims ?? []) {
    expenseReduction.set(r.transaction_id, (expenseReduction.get(r.transaction_id) ?? 0) + r.computed_amount);
    if (r.settled_transaction_id) {
      sourceReduction.set(
        r.settled_transaction_id,
        (sourceReduction.get(r.settled_transaction_id) ?? 0) + r.computed_amount
      );
    }
  }

  return { expenseReduction, sourceReduction };
}

// abs(amount), minus any contribution towards it, floored at 0.
export function netExpenseAmount(
  txId: string,
  amount: number,
  adjustments: ContributionAdjustments
): number {
  return Math.max(0, Math.abs(amount) - (adjustments.expenseReduction.get(txId) ?? 0));
}

// amount, minus any portion allocated away as a contribution, floored at 0.
export function netIncomeAmount(
  txId: string,
  amount: number,
  adjustments: ContributionAdjustments
): number {
  return Math.max(0, amount - (adjustments.sourceReduction.get(txId) ?? 0));
}
