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
