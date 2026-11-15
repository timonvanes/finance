"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { forgotPin, verifyPin } from "@/actions/pin";
import { confirmWithFaceId, hasLockCredential, subscribeLock } from "@/lib/app-lock-client";
import { PinPad } from "./pin-pad";
import { PinSetupFlow } from "./pin-flows";

// The app is locked every time it is opened: afresh, and also when the person only left it
// for a moment (home screen, another app) without closing it. It locks at the moment of
// leaving, so the picture in the app switcher shows the lock screen and not the money.
// It opens with the 6-digit code (compulsory, chosen first) or, where switched on as an
// extra, with Face ID. The person stays logged in: the lock is only a check on the phone.
export function AppLock({ hasPin, lockOff, children }: { hasPin: boolean; lockOff: boolean; children: ReactNode }) {
  // Switched off on this device: the app opens straight away and asks for no code.
  const active = !lockOff;
  const router = useRouter();
  const [locked, setLocked] = useState(active && hasPin);
  const [faceBusy, setFaceBusy] = useState(false);
  // Face ID is an extra, chosen per device.
  const faceId = useSyncExternalStore(subscribeLock, hasLockCredential, () => false);

  // Out of sight means locked, whatever the time away.
  useEffect(() => {
    if (!hasPin || !active) return;
    const onHide = () => {
      if (document.visibilityState === "hidden") setLocked(true);
    };
    // A page the phone kept in memory and shows again.
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setLocked(true);
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pageshow", onShow);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pageshow", onShow);
    };
  }, [hasPin, active]);

  async function tryFaceId() {
    setFaceBusy(true);
    try {
      if (await confirmWithFaceId()) setLocked(false);
    } catch {
      // cancelled or not available: the code is still there
    }
    setFaceBusy(false);
  }

  return (
    <>
      <div inert={active && (locked || !hasPin)} aria-hidden={active && (locked || !hasPin)}>
        {children}
      </div>
      {active && !hasPin && <PinSetupFlow onDone={() => router.refresh()} />}
      {active && hasPin && locked && (
        <PinPad
          title="Finance"
          hint="Voer je pincode in"
          onComplete={async (pin) => {
            const result = await verifyPin(pin);
            if (result.signedOut) {
              window.location.assign("/login");
              return null;
            }
            if (!result.ok) return result.error ?? "Onjuiste pincode.";
            setLocked(false);
            return null;
          }}
          onFaceId={faceId ? () => void tryFaceId() : undefined}
          faceIdBusy={faceBusy}
          footer={
            <form action={forgotPin}>
              <button type="submit" className="min-h-[52px] rounded-xl border-2 border-white px-6 text-base font-medium text-white active:bg-white/15">
                Pincode vergeten? Uitloggen
              </button>
            </form>
          }
        />
      )}
    </>
  );
}
