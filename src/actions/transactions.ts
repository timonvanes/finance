"use server";

import { createClient } from "@/lib/supabase/server";
import { normalizeCounterparty } from "@/lib/categorization/engine";

const DEFAULT_CATEGORIES = [
  { name: "Boodschappen", kind: "expense" },
  { name: "Restaurant & uit eten", kind: "expense" },
  { name: "Vervoer", kind: "expense" },
  { name: "Wonen", kind: "expense" },
  { name: "Verzekeringen", kind: "expense" },
  { name: "Abonnementen", kind: "expense" },
  { name: "Vrije tijd & uitjes", kind: "expense" },
  { name: "Kleding", kind: "expense" },
  { name: "Zorg & persoonlijke verzorging", kind: "expense" },
  { name: "Cadeaus & giften", kind: "expense" },
  { name: "Sparen & beleggen", kind: "expense" },
  { name: "Overig", kind: "expense" },
  { name: "Salaris", kind: "income" },
  { name: "Terugbetalingen", kind: "income" },
  { name: "Overig inkomen", kind: "income" },
] as const;

// Bootstrap rules for common NL merchants so new transactions already get a
// sensible suggested category from day one, not only after manual training.
const DEFAULT_RULES: { pattern: string; category: string }[] = [
  { pattern: "albert heijn", category: "Boodschappen" },
  { pattern: "ah to go", category: "Boodschappen" },
  { pattern: "jumbo", category: "Boodschappen" },
  { pattern: "lidl", category: "Boodschappen" },
  { pattern: "aldi", category: "Boodschappen" },
  { pattern: "plus", category: "Boodschappen" },
  { pattern: "dirk", category: "Boodschappen" },
  { pattern: "thuisbezorgd", category: "Restaurant & uit eten" },
  { pattern: "uber eats", category: "Restaurant & uit eten" },
  { pattern: "deliveroo", category: "Restaurant & uit eten" },
  { pattern: "ns groep", category: "Vervoer" },
  { pattern: "ns-", category: "Vervoer" },
  { pattern: "shell", category: "Vervoer" },
  { pattern: "esso", category: "Vervoer" },
  { pattern: "bp ", category: "Vervoer" },
  { pattern: "uber", category: "Vervoer" },
  { pattern: "netflix", category: "Abonnementen" },
  { pattern: "spotify", category: "Abonnementen" },
  { pattern: "videoland", category: "Abonnementen" },
  { pattern: "ziggo", category: "Abonnementen" },
  { pattern: "kpn", category: "Abonnementen" },
  { pattern: "vodafone", category: "Abonnementen" },
  { pattern: "t-mobile", category: "Abonnementen" },
];

export async function ensureDefaultCategories() {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("categories").select("id").limit(1);
  if (existing && existing.length > 0) return;

  const { data: created, error } = await supabase
    .from("categories")
    .insert([...DEFAULT_CATEGORIES])
    .select("id, name");
  if (error) throw error;

  const categoryIdByName = new Map((created ?? []).map((c) => [c.name, c.id]));
  const rules = DEFAULT_RULES.map((rule) => ({
    match_pattern: rule.pattern,
    match_type: "counterparty" as const,
    category_id: categoryIdByName.get(rule.category),
  })).filter((rule) => rule.category_id);

  if (rules.length > 0) {
    const { error: rulesError } = await supabase.from("category_rules").insert(rules);
    if (rulesError) throw rulesError;
  }
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

export async function createCategory(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const kind = formData.get("kind") as "expense" | "income";
  if (!name) return;

  const supabase = await createClient();
  const { error } = await supabase.from("categories").insert({ name, kind });
  if (error) throw error;
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
