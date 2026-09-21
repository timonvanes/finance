"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
  setPushTypeEnabled,
} from "@/actions/push";
import { PUSH_TYPES } from "@/lib/push/types";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function PushSettings({ disabled, deviceCount }: { disabled: string[]; deviceCount: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [off, setOff] = useState<Set<string>>(new Set(disabled));

  useEffect(() => {
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    if (!ok) return;
    setPermission(Notification.permission);
    navigator.serviceWorker
      .getRegistration("/sw.js")
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setSubscribed(Boolean(sub)))
      .catch(() => {});
  }, []);

  async function enable() {
    setMessage(null);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        setMessage("Toestemming geweigerd. Zet meldingen voor deze app aan in de instellingen van je telefoon.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("De sleutel voor meldingen ontbreekt.");
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
      const json = sub.toJSON();
      await savePushSubscription(
        { endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
        navigator.userAgent
      );
      setSubscribed(true);
      setMessage("Meldingen staan aan op dit apparaat.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Aanzetten mislukt.");
    }
  }

  async function disable() {
    setMessage(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Uitzetten mislukt.");
    }
  }

  function toggle(type: string, enabled: boolean) {
    setOff((prev) => {
      const next = new Set(prev);
      if (enabled) next.delete(type);
      else next.add(type);
      return next;
    });
    startTransition(async () => {
      await setPushTypeEnabled(type, enabled);
    });
  }

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-gray-200">
        {supported === false ? (
          <p className="text-base text-gray-700">
            Meldingen werken alleen als de app op je beginscherm staat. Open de app in Safari, tik op het deelmenu en
            kies &quot;Zet op beginscherm&quot;. Open hem daarna vanaf het beginscherm en kom hier terug.
          </p>
        ) : subscribed ? (
          <>
            <p className="text-base text-gray-900">Meldingen staan aan op dit apparaat.</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => startTransition(async () => void (await sendTestPush()))}
                className="min-h-[48px] rounded-xl bg-teal-700 px-4 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50"
              >
                Stuur een testmelding
              </button>
              <button
                type="button"
                onClick={disable}
                className="min-h-[48px] rounded-xl border border-gray-300 px-4 text-base text-gray-800 active:bg-gray-50"
              >
                Uitzetten op dit apparaat
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-base text-gray-700">
              Zet meldingen aan om een bericht te krijgen bij bijvoorbeeld een nieuwe bestelling, een betaald verzoek
              of een retourtermijn die bijna afloopt.
            </p>
            <button
              type="button"
              disabled={permission === "denied"}
              onClick={enable}
              className="min-h-[52px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50"
            >
              Meldingen aanzetten
            </button>
            {permission === "denied" && (
              <p className="text-sm text-amber-700">
                Meldingen zijn voor deze app geblokkeerd. Zet ze aan bij Instellingen, Meldingen, Finance op je telefoon.
              </p>
            )}
          </>
        )}
        {message && <p className="text-sm text-teal-700">{message}</p>}
        {deviceCount > 0 && <p className="text-sm text-gray-500">{deviceCount} apparaat/apparaten ontvangen meldingen.</p>}
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-lg font-semibold text-gray-900">Welke meldingen</h2>
        <ul className="overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
          {PUSH_TYPES.map((t) => {
            const on = !off.has(t.key);
            return (
              <li key={t.key} className="border-b border-gray-100 last:border-b-0">
                <label className="flex min-h-[64px] items-center justify-between gap-4 px-5 py-3">
                  <span className="text-base text-gray-900">{t.label}</span>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => toggle(t.key, e.target.checked)}
                    className="h-6 w-6 shrink-0 accent-teal-700"
                  />
                </label>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
