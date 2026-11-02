"use server";

import { createClient } from "@/lib/supabase/server";

export async function getPeople() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("people")
    .select("id, name, person_group_id, is_self")
    .eq("is_guest", false)
    .order("name");
  if (error) throw error;
  return data;
}

export async function getPeopleWithGroups() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("people")
    .select("id, name, person_group_id, is_self, person_groups(name)")
    .eq("is_guest", false)
    .order("name");
  if (error) throw error;
  return data;
}

export async function getPersonGroups() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("person_groups")
    .select("id, name")
    .order("name");
  if (error) throw error;
  return data;
}

export async function createPersonGroup(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  if (!name) return;

  const supabase = await createClient();
  const { error } = await supabase.from("person_groups").insert({ name });
  if (error) throw error;
}

export async function createPerson(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  if (!name) return;
  const personGroupId = (formData.get("personGroupId") as string) || null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("people")
    .insert({ name, person_group_id: personGroupId });
  if (error) throw error;
}

// A one-off person for a single reclaim: kept out of the people lists. A name
// that already exists (guest or not) is reused rather than duplicated.
export async function createGuest(name: string): Promise<{ id: string; name: string } | { error: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Vul een naam in." };
  try {
    const supabase = await createClient();
    const { data: existing } = await supabase.from("people").select("id, name").ilike("name", trimmed).maybeSingle();
    if (existing) return { id: existing.id as string, name: existing.name as string };
    const { data, error } = await supabase
      .from("people")
      .insert({ name: trimmed, is_guest: true })
      .select("id, name")
      .single();
    if (error) return { error: error.message };
    return { id: data.id as string, name: data.name as string };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gast toevoegen mislukt." };
  }
}

export async function updatePersonName(personId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("people")
    .update({ name: trimmed })
    .eq("id", personId);
  if (error) throw error;
}

// Only one person can be "me" at a time — clear any previous one first.
export async function setSelfPerson(personId: string) {
  const supabase = await createClient();
  const { error: clearError } = await supabase
    .from("people")
    .update({ is_self: false })
    .eq("is_self", true);
  if (clearError) throw clearError;

  const { error } = await supabase.from("people").update({ is_self: true }).eq("id", personId);
  if (error) throw error;
}

export async function unsetSelfPerson(personId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("people").update({ is_self: false }).eq("id", personId);
  if (error) throw error;
}

export async function updatePersonGroup(personId: string, personGroupId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("people")
    .update({ person_group_id: personGroupId })
    .eq("id", personId);
  if (error) throw error;
}

export async function deletePerson(personId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("people").delete().eq("id", personId);
  if (error) {
    if (error.code === "23503") {
      throw new Error(
        "Kan niet verwijderen: deze persoon heeft nog terugvorderingen. Verwijder die eerst."
      );
    }
    throw error;
  }
}
