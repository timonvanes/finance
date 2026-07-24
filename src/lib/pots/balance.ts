// Entries dated before the opening balance date are excluded from the
// total — they're presumed already reflected in that starting amount (this
// also protects against a herkenningstekst rematch pulling in old
// transactions that predate when the opening balance was set).
export function computePotBalance(pot: {
  opening_balance: number;
  opening_balance_date: string;
  pot_entries: { amount: number; entry_date: string }[];
}): number {
  const counted = pot.pot_entries.filter((e) => e.entry_date >= pot.opening_balance_date);
  return pot.opening_balance + counted.reduce((sum, e) => sum + e.amount, 0);
}

// How much to deposit per month, from now, to hit target_amount by
// target_date — null if there's no target/date set, 0 if already there.
export function computeRequiredMonthlyDeposit(
  balance: number,
  targetAmount: number | null,
  targetDate: string | null
): number | null {
  if (!targetAmount || !targetDate) return null;
  const remaining = targetAmount - balance;
  if (remaining <= 0) return 0;

  const now = new Date();
  const target = new Date(targetDate);
  const monthsRemaining = Math.max(
    1,
    (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth())
  );
  return remaining / monthsRemaining;
}
