"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function getManualOwnIbans() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("manual_own_ibans")
    .select("id, iban, label")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function addManualOwnIban(formData: FormData) {
  const iban = (formData.get("iban") as string).trim().toUpperCase().replace(/\s+/g, "");
  const label = (formData.get("label") as string) || null;
  if (!iban) return;

  const supabase = await createClient();
  const { error } = await supabase.from("manual_own_ibans").insert({ iban, label });
  if (error) throw error;
  revalidatePath("/settings/own-ibans");
}

export async function deleteManualOwnIban(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("manual_own_ibans").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/settings/own-ibans");
}
