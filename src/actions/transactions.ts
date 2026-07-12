"use server";

import { createClient } from "@/lib/supabase/server";
import { normalizeCounterparty } from "@/lib/categorization/engine";

const DEFAULT_CATEGORIES = [
  { name: "Boodschappen", kind: "expense" },
  { name: "Restaurant & uit eten", kind: "expense" },
  { name: "Vervoer", kind: "expense" },
  { name: "Wonen", kind: "expense" },
  { name: "Abonnementen", kind: "expense" },
  { name: "Vrije tijd", kind: "expense" },
  { name: "Zorg", kind: "expense" },
  { name: "Overig", kind: "expense" },
  { name: "Salaris", kind: "income" },
  { name: "Overig inkomen", kind: "income" },
] as const;

export async function ensureDefaultCategories() {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("categories").select("id").limit(1);
  if (existing && existing.length > 0) return;

  const { error } = await supabase.from("categories").insert([...DEFAULT_CATEGORIES]);
  if (error) throw error;
}

export async function getCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, kind")
    .order("name");
  if (error) throw error;
  return data;
}

export async function updateTransactionCategory(
  transactionId: string,
  categoryId: string
) {
  const supabase = await createClient();

  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .select("counterparty_name")
    .eq("id", transactionId)
    .single();
  if (txError) throw txError;

  const { error: updateError } = await supabase
    .from("transactions")
    .update({ category_id: categoryId, category_source: "manual" })
    .eq("id", transactionId);
  if (updateError) throw updateError;

  const normalized = normalizeCounterparty(tx.counterparty_name);
  if (normalized) {
    const { error: ruleError } = await supabase.from("category_rules").upsert(
      {
        match_pattern: normalized,
        match_type: "counterparty",
        category_id: categoryId,
        last_applied_at: new Date().toISOString(),
      },
      { onConflict: "user_id,match_pattern,match_type" }
    );
    if (ruleError) throw ruleError;
  }
}
