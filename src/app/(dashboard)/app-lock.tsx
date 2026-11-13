"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { forgotPin, verifyPin } from "@/actions/pin";
import { confirmWithFaceId, hasLockCredential, subscribeLock } from "@/lib/app-lock-client";
import { PinPad } from "./pin-pad";
import { PinSetupFlow } from "./pin-flows";

// The app is locked when it is opened. Leaving it for a moment (home screen, another app)
// does not lock it again: only opening it afresh does, when the phone has closed it. It
// opens with the 6-digit code (compulsory, chosen first) or, where switched on as an
// extra, with Face ID. The person stays logged in: the lock is only a check on the phone.
export function AppLock({ hasPin, children }: { hasPin: boolean; children: ReactNode }) {
  const router = useRouter();
  const [locked, setLocked] = useState(hasPin);
  const [faceBusy, setFaceBusy] = useState(false);
  // Face ID is an extra, chosen per device.
  const faceId = useSyncExternalStore(subscribeLock, hasLockCredential, () => false);

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
