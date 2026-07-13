"use server";

import { createClient } from "@/lib/supabase/server";

export async function getPots() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pots")
    .select("id, name, kind, target_amount, pot_entries(id, amount, note, entry_date)")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createPot(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  if (!name) return;
  const kind = (formData.get("kind") as string) || "savings";
  const targetRaw = formData.get("targetAmount") as string;
  const targetAmount = targetRaw ? Number(targetRaw) : null;

  const supabase = await createClient();
  const { error } = await supabase.from("pots").insert({
    name,
    kind,
    target_amount: targetAmount && targetAmount > 0 ? targetAmount : null,
  });
  if (error) throw error;
}

export async function deletePot(potId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("pots").delete().eq("id", potId);
  if (error) throw error;
}

// direction "withdraw" stores the amount negative.
export async function addPotEntry(
  potId: string,
  amount: number,
  direction: "deposit" | "withdraw",
  note: string | null
) {
  if (!amount || amount <= 0) return;
  const supabase = await createClient();
  const { error } = await supabase.from("pot_entries").insert({
    pot_id: potId,
    amount: direction === "withdraw" ? -amount : amount,
    note,
  });
  if (error) throw error;
}

export async function deletePotEntry(entryId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("pot_entries").delete().eq("id", entryId);
  if (error) throw error;
}
