import type { SupabaseClient } from "@supabase/supabase-js";

const LEGAL_SUFFIXES = /\b(b\.?v\.?|n\.?v\.?|gmbh|ltd|inc)\b/g;

export function normalizeCounterparty(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(LEGAL_SUFFIXES, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Applies learned category_rules to freshly-synced transactions that don't
// have a category yet. Only touches the given transaction ids so it never
// overrides a category the user (or an earlier rule) already assigned.
export async function applyCategoryRules(
  supabase: SupabaseClient,
  transactionIds: string[]
) {
  if (transactionIds.length === 0) return;

  const { data: rules } = await supabase
    .from("category_rules")
    .select("id, match_pattern, category_id");
  if (!rules || rules.length === 0) return;

  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, counterparty_name")
    .in("id", transactionIds)
    .eq("category_source", "none");
  if (!transactions) return;

  for (const tx of transactions) {
    const normalized = normalizeCounterparty(tx.counterparty_name);
    if (!normalized) continue;

    const match = rules.find((rule) => normalized.includes(rule.match_pattern));
    if (!match) continue;

    await supabase
      .from("transactions")
      .update({ category_id: match.category_id, category_source: "rule" })
      .eq("id", tx.id);

    await supabase
      .from("category_rules")
      .update({ last_applied_at: new Date().toISOString() })
      .eq("id", match.id);
  }
}
