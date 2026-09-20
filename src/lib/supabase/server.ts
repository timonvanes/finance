import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Supabase Auth occasionally hands out a token whose "issued at" is a moment
// ahead of the clock of the API node that then validates it, which PostgREST
// rejects (PGRST303 "JWT issued at future") — and used to show up as a
// "This page couldn't load" error. It resolves itself within a second, so
// retry once.
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithClockSkewRetry(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  if (response.status !== 401) return response;
  const body = await response.clone().text().catch(() => "");
  if (!body.includes("PGRST303")) return response;
  await sleep(1500);
  return fetch(input, init);
}

// User-scoped client for Server Components/Actions — respects RLS as the logged-in user.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: fetchWithClockSkewRetry },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component — safe to ignore because
            // middleware.ts refreshes the session on every request.
          }
        },
      },
    }
  );
}
