import { createBrowserClient } from "@supabase/ssr";

// For the few things that must happen in the browser itself, such as asking the phone
// for Face ID (a passkey). It shares the login cookies with the server. Passkeys are an
// experimental part of the Supabase library, so they are switched on here.
export function createBrowserSupabase() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { experimental: { passkey: true } },
  });
}
