"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const LENGTH = 6;

// The full-screen look of everything about the app code: the lock screen, choosing a code
// and changing it. Teal, with a keypad, like a banking app.
export function PinPad({
  title,
  hint,
  notice,
  onComplete,
  onFaceId,
  faceIdBusy,
  onCancel,
  footer,
}: {
  title: string;
  hint?: string;
  // A message that stays until the next digit (for example "the codes did not match").
  notice?: string;
  // Gets the six digits; answers with an error message, or null when it worked.
  onComplete: (pin: string) => Promise<string | null>;
  // When given, the key bottom left asks for Face ID.
  onFaceId?: () => void;
  faceIdBusy?: boolean;
  onCancel?: () => void;
  footer?: ReactNode;
}) {
  const [digits, setDigits] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const digitsRef = useRef("");
  const busyRef = useRef(false);

  const press = useCallback(
    (d: string) => {
      if (busyRef.current || digitsRef.current.length >= LENGTH) return;
      setError(null);
      const next = digitsRef.current + d;
      digitsRef.current = next;
      setDigits(next);
      if (next.length === LENGTH) {
        busyRef.current = true;
        setBusy(true);
        void onComplete(next).then((message) => {
          busyRef.current = false;
          setBusy(false);
          // Wrong or refused: start over. (On success the screen goes away.)
          digitsRef.current = "";
          setDigits("");
          if (message) setError(message);
        });
      }
    },
    [onComplete]
  );

  const back = useCallback(() => {
    if (busyRef.current) return;
    digitsRef.current = digitsRef.current.slice(0, -1);
    setDigits(digitsRef.current);
  }, []);

  // The lock screen does not scroll, bounce or zoom: the page behind it stays put too.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    const stop = (e: Event) => e.preventDefault();
    const stopMulti = (e: TouchEvent) => e.preventDefault();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Safari's pinch gesture, and any drag on the screen itself.
    document.addEventListener("gesturestart", stop);
    root?.addEventListener("touchmove", stopMulti, { passive: false });
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("gesturestart", stop);
      root?.removeEventListener("touchmove", stopMulti);
    };
  }, []);

  // A keyboard works too (on a computer).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, back]);

  const keyClass =
    "flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white/10 text-3xl font-light text-white ring-1 ring-white/15 backdrop-blur transition active:scale-95 active:bg-white/25 disabled:opacity-50";
  const message = error ?? notice ?? null;

  return (
    <div ref={rootRef} className="fixed inset-0 z-[100] flex h-dvh touch-none select-none flex-col items-center justify-between overflow-hidden overscroll-none bg-gradient-to-b from-teal-700 via-teal-800 to-teal-950 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(3rem,env(safe-area-inset-top))] text-white">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-teal-400/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-emerald-300/15 blur-3xl" />

      <div className="relative z-10 flex flex-col items-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {hint && <p className="max-w-xs text-sm text-teal-100/80">{hint}</p>}
      </div>

      <div className="relative z-10 flex flex-col items-center gap-3 py-4">
        <div className="flex gap-4" aria-label={`${digits.length} van ${LENGTH} cijfers ingevuld`}>
          {Array.from({ length: LENGTH }, (_, i) => (
            <span key={i} className={`h-4 w-4 rounded-full ring-2 ring-white/70 transition ${i < digits.length ? "bg-white" : "bg-transparent"} ${busy ? "animate-pulse" : ""}`} />
          ))}
        </div>
        <p className="min-h-[2.5rem] max-w-xs rounded-xl px-3 py-1 text-center text-sm text-teal-50" role="status">
          {message}
        </p>
      </div>

      <div className="relative z-10 grid grid-cols-3 gap-x-6 gap-y-4">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" className={keyClass} onClick={() => press(d)} disabled={busy}>
            {d}
          </button>
        ))}
        {onFaceId ? (
          <button type="button" className={`${keyClass} text-base`} onClick={onFaceId} disabled={busy || faceIdBusy} aria-label="Ontgrendelen met Face ID">
            <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2" />
              <path d="M9 10v1.5M15 10v1.5M12 10v3h-.6M9 16c1.5 1.5 4.5 1.5 6 0" />
            </svg>
          </button>
        ) : onCancel ? (
          <button type="button" className="h-[72px] w-[72px] text-sm text-teal-100/90" onClick={onCancel}>
            Annuleer
          </button>
        ) : (
          <span />
        )}
        <button type="button" className={keyClass} onClick={() => press("0")} disabled={busy}>
          0
        </button>
        <button type="button" className="flex h-[72px] w-[72px] items-center justify-center text-teal-50 active:opacity-60" onClick={back} aria-label="Wis laatste cijfer">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 5H9l-6 7 6 7h12a1 1 0 001-1V6a1 1 0 00-1-1zM17 9l-6 6M11 9l6 6" />
          </svg>
        </button>
      </div>

      <div className="relative z-10 mt-4 flex min-h-[44px] items-center">{footer}</div>
    </div>
  );
}
