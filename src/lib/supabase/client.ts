import { createBrowserClient } from "@supabase/ssr";

// For the few things that must happen in the browser itself, such as asking the
// phone for Face ID. It shares the login cookies with the server.
export function createBrowserSupabase() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
