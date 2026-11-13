import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isBunqConfigured } from "@/lib/bunq/client";
import { isWbwConfigured } from "@/lib/wbw/client";
import { hasSecret } from "@/lib/credentials";

// Some logins live in the server settings (WieBetaaltWat, bunq) and belong to one
// person. They must never be used for another user of the app: that user would see
// the owner's lists and balances. The owner is pinned with OWNER_USER_ID (or
// INBOUND_MAIL_USER_ID). Without either, the only user counts as the owner, and as
// soon as there are several users nobody does, until one is pinned.
export async function ownerUserId(): Promise<string | null> {
  const pinned = process.env.OWNER_USER_ID || process.env.INBOUND_MAIL_USER_ID;
  if (pinned) return pinned;
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 2 });
  return data.users.length === 1 ? data.users[0].id : null;
}

export const currentUserIsOwner = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  return user.id === (await ownerUserId());
});

export const currentUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
});

// WieBetaaltWat works for this user: they linked their own login, or they are the
// owner and the login in the server settings is set.
export async function wbwAvailable() {
  const id = await currentUserId();
  if (!id) return false;
  if (await hasSecret(id, "wbw")) return true;
  return isWbwConfigured() && (await currentUserIsOwner());
}

export async function bunqAvailable() {
  return isBunqConfigured() && (await currentUserIsOwner());
}
