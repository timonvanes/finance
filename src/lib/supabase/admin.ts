import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS. Server-only: used by the Enable
// Banking callback route, the background auto-sync job, and other backend
// code that must act outside the logged-in user's session (or where the
// session cookie can't be relied on, e.g. a redirect back from a bank's own
// site). Never import this from client code.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
