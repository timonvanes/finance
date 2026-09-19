import type { SupabaseClient } from "@supabase/supabase-js";
import { BUILTIN_RULES } from "./builtin-rules";

const LEGAL_SUFFIXES = /\b(b\.?v\.?|n\.?v\.?|gmbh|ltd|inc)\b/g;

export function normalizeCounterparty(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(LEGAL_SUFFIXES, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Store numbers, terminal ids and the like ("ALBERT HEIJN 1234 UTRECHT" vs
// "ALBERT HEIJN 5678 ZEIST") shouldn't make the same shop look different.
export function counterpartyKey(name: string | null | undefined): string {
  return normalizeCounterparty(name)
    .replace(/\b\d{2,}\b/g, " ")
    .replace(/[*#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Whole-word containment, so "plus" doesn't match "surplus" and "ns" doesn't
// match "transavia".
function containsWord(haystack: string, needle: string): boolean {
  if (!needle) return false;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    const before = i === 0 ? "" : haystack[i - 1];
    const after = haystack[i + needle.length] ?? "";
    if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) return true;
    i = haystack.indexOf(needle, i + 1);
  }
  return false;
}

const simplify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export interface CategorizableTransaction {
  counterparty_name: string | null;
  raw_description: string | null;
  amount: number;
}

interface CategoryRow {
  id: string;
  name: string;
  kind: string;
}

// Builds a categorizer once (one query for categories, one for the user's
// learned rules) so a big batch doesn't repeat that work per transaction.
//
// Priority: (1) the user's own learned rules — longest, most specific match
// wins — then (2) built-in knowledge of common Dutch merchants, matched on
// the counterparty and (for brand names) the description. Income categories
// only ever apply to incoming money and expense categories to outgoing.
//
// userId is required with the admin client (background sync), which bypasses
// RLS — without it categories and rules of every user would be mixed up.
export async function buildCategorizer(supabase: SupabaseClient, userId?: string) {
  let categoriesQuery = supabase.from("categories").select("id, name, kind");
  let rulesQuery = supabase.from("category_rules").select("match_pattern, category_id");
  if (userId) {
    categoriesQuery = categoriesQuery.eq("user_id", userId);
    rulesQuery = rulesQuery.eq("user_id", userId);
  }
  const [{ data: categoriesData }, { data: rulesData }] = await Promise.all([
    categoriesQuery,
    rulesQuery,
  ]);
  const categories = (categoriesData ?? []) as CategoryRow[];
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const learned = (rulesData ?? [])
    .map((r) => ({ pattern: counterpartyKey(r.match_pattern), categoryId: r.category_id as string }))
    .filter((r) => r.pattern && categoryById.has(r.categoryId))
    .sort((a, b) => b.pattern.length - a.pattern.length);

  const resolveCategory = (name: string): CategoryRow | undefined => {
    const wanted = simplify(name);
    const exact = categories.find((c) => simplify(c.name) === wanted);
    if (exact) return exact;
    // A renamed default ("Restaurants" for "Restaurant & uit eten") still
    // counts if it starts with the same first word.
    const firstWord = simplify(name.split(/[\s&]+/)[0]);
    return firstWord.length >= 5
      ? categories.find((c) => simplify(c.name).startsWith(firstWord))
      : undefined;
  };

  const builtin: { keyword: string; strong: boolean; category: CategoryRow }[] = [];
  for (const rule of BUILTIN_RULES) {
    const category = resolveCategory(rule.category);
    if (!category) continue;
    for (const b of rule.brands) {
      const keyword = b.toLowerCase().trim();
      if (keyword) builtin.push({ keyword, strong: true, category });
    }
    for (const g of rule.generic ?? []) {
      const keyword = g.toLowerCase().trim();
      if (keyword) builtin.push({ keyword, strong: false, category });
    }
  }
  builtin.sort((a, b) => b.keyword.length - a.keyword.length);

  return function categorize(tx: CategorizableTransaction): string | null {
    const kind = tx.amount < 0 ? "expense" : "income";
    const name = counterpartyKey(tx.counterparty_name);
    const description = normalizeCounterparty(tx.raw_description);

    for (const rule of learned) {
      if (categoryById.get(rule.categoryId)!.kind !== kind) continue;
      if (containsWord(name, rule.pattern)) return rule.categoryId;
    }

    for (const b of builtin) {
      if (b.category.kind !== kind) continue;
      if (containsWord(name, b.keyword)) return b.category.id;
      if (b.strong && containsWord(description, b.keyword)) return b.category.id;
    }

    return null;
  };
}

// Applies rules to freshly-synced transactions that don't have a category
// yet. Only touches the given transaction ids so it never overrides a
// category the user (or an earlier rule) already assigned.
export async function applyCategoryRules(
  supabase: SupabaseClient,
  transactionIds: string[],
  userId?: string
) {
  if (transactionIds.length === 0) return;

  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, amount, counterparty_name, raw_description")
    .in("id", transactionIds)
    .eq("category_source", "none")
    .eq("is_transfer", false);
  if (!transactions || transactions.length === 0) return;

  const categorize = await buildCategorizer(supabase, userId);

  // Group by category so a first-time sync (hundreds of rows) does a couple
  // of batched updates instead of a round trip per transaction.
  const idsByCategory = new Map<string, string[]>();
  for (const tx of transactions) {
    const categoryId = categorize(tx);
    if (!categoryId) continue;
    if (!idsByCategory.has(categoryId)) idsByCategory.set(categoryId, []);
    idsByCategory.get(categoryId)!.push(tx.id);
  }

  await Promise.all(
    [...idsByCategory].map(([categoryId, ids]) =>
      supabase
        .from("transactions")
        .update({ category_id: categoryId, category_source: "rule" })
        .in("id", ids)
    )
  );
}
