import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// The Enable Banking callback is a top-level redirect back from the bank's
// own site, not a normal in-app navigation — gating it behind session
// middleware meant any hiccup refreshing the Supabase session cookie at
// that exact moment (expired access token + a stale/raced refresh token)
// bounced the request to /login before the callback ever ran, silently
// dropping the linking result. The route authenticates the request itself
// via the unguessable auth_ref, so it doesn't need the browser session.
// The keep-alive cron is triggered by Vercel, not a logged-in browser — it
// has no session cookie either, and authenticates itself via CRON_SECRET.
const PUBLIC_PATHS = [
  "/login",
  "/privacy",
  "/terms",
  "/api/enablebanking/callback",
  "/api/cron/keep-alive",
];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Required: refreshes the session token when needed. getClaims() checks
  // the JWT locally where it can instead of calling Supabase Auth over the
  // network on every single navigation (that round trip was a big part of
  // the lag when switching tabs).
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims ?? null;

  const isPublicPath = PUBLIC_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (!user && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (user && request.nextUrl.pathname === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    return NextResponse.redirect(homeUrl);
  }

  return response;
}
