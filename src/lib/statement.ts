import type { SupabaseClient } from "@supabase/supabase-js";
import { getContributionAdjustments, netExpenseAmount, netIncomeAmount } from "@/lib/contributions/net-amount";

export interface StatementTx {
  id: string;
  date: string;
  name: string;
  description: string | null;
  category: string;
  amount: number;
}

export interface CategoryGroup {
  name: string;
  total: number;
  transactions: StatementTx[];
}

export interface Statement {
  from: string;
  to: string;
  income: CategoryGroup[];
  expense: CategoryGroup[];
  totalIncome: number;
  totalExpense: number;
  reserved: number;
  net: number;
  monthly: { key: string; income: number; expense: number }[];
}

const PAGE = 1000;
const CHUNK = 100;

// Baten en lasten for a period, using the same counted amounts as the overview
// (passed-on, netted and paid-back parts are already taken out).
export async function buildStatement(supabase: SupabaseClient, from: string, to: string): Promise<Statement> {
  type Row = {
    id: string;
    booking_date: string;
    amount: number;
    counterparty_name: string | null;
    raw_description: string | null;
    categories: { name: string } | { name: string }[] | null;
  };
  const rows: Row[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("visible_transactions")
      .select("id, booking_date, amount, counterparty_name, raw_description, categories(name)")
      .eq("is_transfer", false)
      .gte("booking_date", from)
      .lte("booking_date", to)
      .order("booking_date", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) break;
  }

  // Adjustments are looked up in chunks (long id lists overflow the URL); a
  // contribution row comes back for both of its ids, so only keep the entries
  // that belong to the ids of that chunk.
  const expenseReduction = new Map<string, number>();
  const sourceReduction = new Map<string, number>();
  for (let i = 0; i < rows.length; i += CHUNK) {
    const ids = rows.slice(i, i + CHUNK).map((r) => r.id);
    const set = new Set(ids);
    const adj = await getContributionAdjustments(supabase, ids);
    adj.expenseReduction.forEach((v, k) => set.has(k) && expenseReduction.set(k, v));
    adj.sourceReduction.forEach((v, k) => set.has(k) && sourceReduction.set(k, v));
  }
  const adjustments = { expenseReduction, sourceReduction };

  const income = new Map<string, CategoryGroup>();
  const expense = new Map<string, CategoryGroup>();
  const monthly = new Map<string, { income: number; expense: number }>();

  for (const r of rows) {
    const cat = Array.isArray(r.categories) ? r.categories[0] : r.categories;
    const category = cat?.name ?? "Ongecategoriseerd";
    const isIncome = r.amount > 0;
    const counted = isIncome
      ? netIncomeAmount(r.id, r.amount, adjustments)
      : netExpenseAmount(r.id, r.amount, adjustments);
    if (counted <= 0) continue;

    const target = isIncome ? income : expense;
    if (!target.has(category)) target.set(category, { name: category, total: 0, transactions: [] });
    const group = target.get(category)!;
    group.total += counted;
    group.transactions.push({
      id: r.id,
      date: r.booking_date,
      name: r.counterparty_name ?? "Onbekend",
      description: r.raw_description,
      category,
      amount: counted,
    });

    const key = r.booking_date.slice(0, 7);
    const m = monthly.get(key) ?? { income: 0, expense: 0 };
    if (isIncome) m.income += counted;
    else m.expense += counted;
    monthly.set(key, m);
  }

  const { data: frontedRows } = await supabase
    .from("wbw_fronted_expenses")
    .select("period_start, amount")
    .gte("period_start", from)
    .lte("period_start", to);
  const fronted = (frontedRows ?? []).reduce((s, r) => s + Number(r.amount), 0);
  if (fronted > 0.5) {
    const group: CategoryGroup = { name: "Via WieBetaaltWat", total: 0, transactions: [] };
    for (const r of frontedRows ?? []) {
      group.total += Number(r.amount);
      group.transactions.push({
        id: `wbw-${r.period_start}`,
        date: r.period_start,
        name: "Door huisgenoten voorgeschoten",
        description: null,
        category: group.name,
        amount: Number(r.amount),
      });
      const key = r.period_start.slice(0, 7);
      const m = monthly.get(key) ?? { income: 0, expense: 0 };
      m.expense += Number(r.amount);
      monthly.set(key, m);
    }
    expense.set(group.name, group);
  }

  // Money moved into pots in the period: set aside, so it is taken off the result.
  const { data: potRows } = await supabase
    .from("pot_entries")
    .select("amount")
    .gte("entry_date", from)
    .lte("entry_date", to);
  const reserved = (potRows ?? []).reduce((s, r) => s + Number(r.amount), 0);

  const sorted = (m: Map<string, CategoryGroup>) => [...m.values()].sort((a, b) => b.total - a.total);
  const incomeGroups = sorted(income);
  const expenseGroups = sorted(expense);
  const totalIncome = incomeGroups.reduce((s, g) => s + g.total, 0);
  const totalExpense = expenseGroups.reduce((s, g) => s + g.total, 0);

  return {
    from,
    to,
    income: incomeGroups,
    expense: expenseGroups,
    totalIncome,
    totalExpense,
    reserved,
    net: totalIncome - totalExpense - reserved,
    monthly: [...monthly.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, v]) => ({ key, ...v })),
  };
}

export const isIsoDate = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
