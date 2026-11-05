"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Kind = "reclaim" | "request";

const tableFor = (kind: Kind) => (kind === "reclaim" ? "reclaims" : "payment_requests");

// The first Tikkie link in a piece of text (a pasted message may hold more than the link).
export async function extractTikkieUrl(text: string): Promise<string | null> {
  for (const m of text.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    try {
      const u = new URL(m[0]);
      if (u.hostname === "tikkie.me" || u.hostname.endsWith(".tikkie.me")) return u.toString();
    } catch {
      // not a URL
    }
  }
  return null;
}

// Keeps the Tikkie link made for a reclaim or combined request ("" removes it).
export async function saveTikkieUrl(kind: Kind, id: string, text: string): Promise<{ error?: string; url?: string | null }> {
  const url = text.trim() ? await extractTikkieUrl(text) : null;
  if (text.trim() && !url) return { error: "Dit lijkt geen Tikkie-link (die begint met https://tikkie.me/…)." };
  const supabase = await createClient();
  const { error } = await supabase
    .from(tableFor(kind))
    .update({ tikkie_url: url, tikkie_reminded_at: null })
    .eq("id", id);
  if (error) return { error: "Opslaan mislukt. Probeer het opnieuw." };
  revalidatePath("/terugvorderen", "layout");
  return { url };
}

// Notes that a reminder was just sent.
export async function markTikkieReminded(kind: Kind, id: string): Promise<{ error?: string; at?: string }> {
  const at = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase.from(tableFor(kind)).update({ tikkie_reminded_at: at }).eq("id", id);
  if (error) return { error: "Opslaan mislukt." };
  revalidatePath("/terugvorderen", "layout");
  return { at };
}
