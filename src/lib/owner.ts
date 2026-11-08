import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isBunqConfigured } from "@/lib/bunq/client";
import { isWbwConfigured } from "@/lib/wbw/client";

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

// The shared logins are set up AND this user is the one they belong to.
export async function wbwAvailable() {
  return isWbwConfigured() && (await currentUserIsOwner());
}

export async function bunqAvailable() {
  return isBunqConfigured() && (await currentUserIsOwner());
}
