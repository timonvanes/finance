"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { forgotPin, verifyPin } from "@/actions/pin";
import { confirmWithFaceId, hasLockCredential, subscribeLock } from "@/lib/app-lock-client";
import { PinPad } from "./pin-pad";
import { PinSetupFlow } from "./pin-flows";

// After this long in the background the app locks again, like a banking app.
const LOCK_AFTER_MS = 60_000;

// The app is always locked on opening, and again after a minute in the background. It
// opens with the 6-digit code (compulsory, chosen first) or, where switched on as an
// extra, with Face ID. The person stays logged in: the lock is only a check on the phone.
export function AppLock({ hasPin, children }: { hasPin: boolean; children: ReactNode }) {
  const router = useRouter();
  const [locked, setLocked] = useState(hasPin);
  const [faceBusy, setFaceBusy] = useState(false);
  const hiddenAt = useRef<number | null>(null);
  // Face ID is an extra, chosen per device.
  const faceId = useSyncExternalStore(subscribeLock, hasLockCredential, () => false);

  // Back from the background after a while: lock again.
  useEffect(() => {
    if (!hasPin) return;
    const onChange = () => {
      if (document.visibilityState === "hidden") hiddenAt.current = Date.now();
      else if (hiddenAt.current !== null && Date.now() - hiddenAt.current > LOCK_AFTER_MS) setLocked(true);
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, [hasPin]);

  async function tryFaceId() {
    setFaceBusy(true);
    try {
      if (await confirmWithFaceId()) setLocked(false);
    } catch {
      // cancelled or not available: the code is still there
    }
    setFaceBusy(false);
  }

  // Where Face ID is on, ask for it as soon as the lock screen shows.
  useEffect(() => {
    if (!locked || !faceId) return;
    const t = window.setTimeout(() => void tryFaceId(), 300);
    return () => window.clearTimeout(t);
  }, [locked, faceId]);

  return (
    <>
      <div inert={locked || !hasPin} aria-hidden={locked || !hasPin}>
        {children}
      </div>
      {!hasPin && <PinSetupFlow onDone={() => router.refresh()} />}
      {hasPin && locked && (
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
              <button type="submit" className="min-h-[44px] px-4 text-sm text-teal-100/80 underline decoration-teal-100/40 underline-offset-4">
                Pincode vergeten? Uitloggen en een nieuwe kiezen
              </button>
            </form>
          }
        />
      )}
    </>
  );
}
