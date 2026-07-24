import type { SupabaseClient } from "@supabase/supabase-js";

export interface ContributionAdjustments {
  // expense_transaction_id -> total contributed towards it (subtract from spend)
  expenseReduction: Map<string, number>;
  // source_transaction_id -> total allocated away (subtract from income)
  sourceReduction: Map<string, number>;
}

export async function getContributionAdjustments(
  supabase: SupabaseClient,
  transactionIds: string[]
): Promise<ContributionAdjustments> {
  const empty = { expenseReduction: new Map<string, number>(), sourceReduction: new Map<string, number>() };
  if (transactionIds.length === 0) return empty;

  const { data } = await supabase
    .from("expense_contributions")
    .select("expense_transaction_id, source_transaction_id, amount")
    .or(
      `expense_transaction_id.in.(${transactionIds.join(",")}),source_transaction_id.in.(${transactionIds.join(",")})`
    );

  const expenseReduction = new Map<string, number>();
  const sourceReduction = new Map<string, number>();
  for (const c of data ?? []) {
    expenseReduction.set(
      c.expense_transaction_id,
      (expenseReduction.get(c.expense_transaction_id) ?? 0) + c.amount
    );
    if (c.source_transaction_id) {
      sourceReduction.set(c.source_transaction_id, (sourceReduction.get(c.source_transaction_id) ?? 0) + c.amount);
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
