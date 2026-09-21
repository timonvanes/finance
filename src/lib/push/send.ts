import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PushType } from "./types";

let configured = false;
function configure() {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subject) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

// Sends one notification to every device of the user, unless that kind of
// notification is switched off. Never throws: a failed push must not break the
// work that triggered it.
export async function sendPush(
  userId: string,
  type: PushType | "test",
  payload: { title: string; body: string; url?: string }
) {
  try {
    if (!configure()) return;
    const admin = createAdminClient();

    if (type !== "test") {
      const { data: prefs } = await admin
        .from("push_preferences")
        .select("disabled_types")
        .eq("user_id", userId)
        .maybeSingle();
      if ((prefs?.disabled_types ?? []).includes(type)) return;
    }

    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId);

    await Promise.all(
      (subs ?? []).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title: payload.title, body: payload.body, url: payload.url ?? "/" })
          );
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await admin.from("push_subscriptions").delete().eq("id", s.id);
          } else {
            console.error("push failed", status, e);
          }
        }
      })
    );
  } catch (e) {
    console.error("sendPush failed", e);
  }
}
