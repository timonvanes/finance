"use server";

import { createClient } from "@/lib/supabase/server";

export async function getPeople() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("people")
    .select("id, name")
    .order("name");
  if (error) throw error;
  return data;
}

export async function createPerson(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  if (!name) return;

  const supabase = await createClient();
  const { error } = await supabase.from("people").insert({ name });
  if (error) throw error;
}
