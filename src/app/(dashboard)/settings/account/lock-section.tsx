"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { disableLock, enableLock } from "@/actions/pin";
import {
  confirmWithFaceId,
  createLockCredential,
  forgetLockCredential,
  hasLockCredential,
  lockSupported,
  subscribeLock,
} from "@/lib/app-lock-client";
import { PinChangeFlow, PinConfirmFlow } from "../../pin-flows";

// How the app is locked: the 6-digit code and, on top, Face ID on this device. The whole lock
// can be switched off on this device; switching it off asks for the code first.
export function LockSection({ lockOff }: { lockOff: boolean }) {
  const router = useRouter();
  const [off, setOff] = useState(lockOff);
  const [confirmingOff, setConfirmingOff] = useState(false);
  const faceOn = useSyncExternalStore(subscribeLock, hasLockCredential, () => false);
  const supported = useSyncExternalStore(
    () => () => {},
    lockSupported,
    () => true
  );
  const [busy, setBusy] = useState(false);
  const [changing, setChanging] = useState(false);
  const [changed, setChanged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function turnOnFaceId() {
    setBusy(true);
    setError(null);
    try {
      await createLockCredential();
      // Try it once, so a lock that cannot be opened is never switched on.
      const ok = await confirmWithFaceId();
      if (!ok) throw new Error("niet bevestigd");
    } catch (e) {
      forgetLockCredential();
      const m = (e instanceof Error ? e.message : "").toLowerCase();
      setError(
        /cancel|abort|not allowed|timed out/.test(m)
          ? "Face ID is geannuleerd. Tik nog een keer en bevestig met Face ID."
          : "Aanzetten lukte niet op dit apparaat. Face ID moet op de telefoon aan staan voor Safari of de app."
      );
    }
    setBusy(false);
  }

  return (
    <section className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-gray-200">
      <div>
        <h2 className="text-base font-medium text-gray-900">App vergrendelen</h2>
        <p className="text-sm text-gray-500">
          {off
            ? "Het slot staat uit op dit apparaat: de app opent meteen, zonder pincode."
            : "De app is dicht elke keer dat je hem opent, ook als je hem alleen even verlaten hebt. Je ontgrendelt met je pincode en blijft ingelogd."}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-900">Slot op dit apparaat</p>
          <p className="text-xs text-gray-500">{off ? "Uit" : "Aan. Uitzetten vraagt je pincode."}</p>
        </div>
        {off ? (
          <button
            type="button"
            onClick={async () => {
              await enableLock();
              setOff(false);
              router.refresh();
            }}
            className="min-h-[44px] rounded-xl bg-teal-700 px-4 text-sm font-medium text-white active:bg-teal-800"
          >
            Aanzetten
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingOff(true)}
            className="min-h-[44px] rounded-xl border border-gray-300 bg-white px-4 text-sm font-medium text-gray-900 active:bg-gray-50"
          >
            Uitzetten
          </button>
        )}
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {changed && <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">Je pincode is gewijzigd.</p>}

      {!off && (
        <>
      <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-900">Pincode (6 cijfers)</p>
          <p className="text-xs text-gray-500">Hiermee ontgrendel je de app</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setChanged(false);
            setChanging(true);
          }}
          className="min-h-[44px] rounded-xl border border-gray-300 bg-white px-4 text-sm font-medium text-gray-900 active:bg-gray-50"
        >
          Wijzigen
        </button>
      </div>

      <div className="space-y-2 rounded-xl bg-gray-50 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-900">Face ID als extra</p>
            <p className="text-xs text-gray-500">Ontgrendelen met je gezicht in plaats van de cijfers. De pincode blijft altijd werken.</p>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${faceOn ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>{faceOn ? "Aan" : "Uit"}</span>
        </div>
        {faceOn ? (
          <button
            type="button"
            onClick={forgetLockCredential}
            className="min-h-[44px] w-full rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-900 active:bg-gray-50"
          >
            Face ID uitzetten op dit apparaat
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || !supported}
            onClick={() => void turnOnFaceId()}
            className="min-h-[48px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50"
          >
            {busy ? "Wachten op Face ID…" : "Face ID aanzetten"}
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500">
        Dit beschermt tegen iemand die je ontgrendelde telefoon vasthoudt. Je inlog en je code van de authenticator blijven zoals ze zijn. Face ID geldt alleen voor dit apparaat.
      </p>

        </>
      )}

      {confirmingOff && (
        <PinConfirmFlow
          title="Slot uitzetten"
          hint="Voer je pincode in om het slot uit te zetten op dit apparaat."
          confirm={disableLock}
          onCancel={() => setConfirmingOff(false)}
          onDone={() => {
            setConfirmingOff(false);
            setOff(true);
            router.refresh();
          }}
        />
      )}

      {changing && (
        <PinChangeFlow
          onCancel={() => setChanging(false)}
          onDone={() => {
            setChanging(false);
            setChanged(true);
          }}
        />
      )}
    </section>
  );
}
