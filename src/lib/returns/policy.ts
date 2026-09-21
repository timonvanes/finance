import type { SupabaseClient } from "@supabase/supabase-js";
import { lookupReturnWindow } from "@/lib/anthropic/lookup-return-policy";

const NEGATIVE_CACHE_DAYS = 30;

const keyOf = (merchant: string) => merchant.toLowerCase().replace(/[^a-z0-9]+/g, "");

// The return window (days) for a shop: cached per shop, otherwise one web
// search. A failed or unreliable search is cached as "unknown" for a while so
// the same shop is not searched again on every mail.
export async function getReturnWindow(
  supabase: SupabaseClient,
  userId: string,
  merchantName: string
): Promise<number | null> {
  const key = keyOf(merchantName);
  if (!key) return null;

  const { data: cached } = await supabase
    .from("merchant_return_policies")
    .select("window_days, looked_up_at")
    .eq("user_id", userId)
    .eq("merchant_key", key)
    .maybeSingle();
  if (cached) {
    if (cached.window_days) return cached.window_days;
    const ageDays = (Date.now() - new Date(cached.looked_up_at).getTime()) / 86_400_000;
    if (ageDays < NEGATIVE_CACHE_DAYS) return null;
  }

  let days: number | null = null;
  let sourceUrl: string | null = null;
  try {
    ({ days, sourceUrl } = await lookupReturnWindow(merchantName));
  } catch (e) {
    // Web search unavailable (not enabled, rate limit, ...): carry on without.
    console.error("return window lookup failed", e);
    return null;
  }

  await supabase.from("merchant_return_policies").upsert(
    {
      user_id: userId,
      merchant_key: key,
      merchant_name: merchantName,
      window_days: days,
      source_url: sourceUrl,
      looked_up_at: new Date().toISOString(),
    },
    { onConflict: "user_id,merchant_key" }
  );
  return days;
}
