import { createClient } from "@/lib/supabase/server";
import { readSecret } from "@/lib/credentials";
import { ownerUserId } from "@/lib/owner";
import { wbwLogin, type WbwCredentials, type WbwSession } from "./client";

// Whose WieBetaaltWat login to use: the one this user linked for themselves, or the
// one in the server settings when the user is the owner. Never someone else's.
export async function wbwCredentialsFor(userId: string): Promise<WbwCredentials | null> {
  const own = await readSecret<WbwCredentials>(userId, "wbw");
  if (own?.email && own.password) return own;
  const email = process.env.WBW_EMAIL;
  const password = process.env.WBW_PASSWORD;
  if (email && password && userId === (await ownerUserId())) return { email, password };
  return null;
}

export async function wbwLoginFor(userId: string): Promise<WbwSession> {
  const creds = await wbwCredentialsFor(userId);
  if (!creds) throw new Error("WieBetaaltWat is niet gekoppeld. Koppel het onder Instellingen, Bankkoppelingen.");
  return wbwLogin(creds);
}

export async function wbwSessionForCurrentUser(): Promise<WbwSession> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd.");
  return wbwLoginFor(user.id);
}
