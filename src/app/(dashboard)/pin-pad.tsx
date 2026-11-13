"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AppLogo } from "../app-logo";

const LENGTH = 6;

// The letters under the digits, like on a phone.
const KEYS: { digit: string; letters: string }[] = [
  { digit: "1", letters: "" },
  { digit: "2", letters: "ABC" },
  { digit: "3", letters: "DEF" },
  { digit: "4", letters: "GHI" },
  { digit: "5", letters: "JKL" },
  { digit: "6", letters: "MNO" },
  { digit: "7", letters: "PQRS" },
  { digit: "8", letters: "TUV" },
  { digit: "9", letters: "WXYZ" },
];

// The full-screen look of everything about the app code: the lock screen, choosing a code
// and changing it. Dark, with the logo, six dots and a big keypad, like a banking app.
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

  // Keys: no circles, big digits; the row height shrinks a little on a short screen.
  const keyBase = "flex h-[min(5.25rem,9.5dvh)] flex-col items-center justify-center rounded-2xl text-white transition active:bg-white/15 disabled:opacity-50";
  const message = error ?? notice ?? null;

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[100] flex h-dvh touch-none select-none flex-col items-center justify-between overflow-hidden overscroll-none bg-[#212121] px-8 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(3.5rem,env(safe-area-inset-top))] text-white"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <AppLogo className="h-[min(5.75rem,11dvh)] w-[min(5.75rem,11dvh)] drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)]" />
        <h1 className="pt-2 text-xl font-semibold tracking-tight">{title}</h1>
        {hint && <p className="max-w-xs text-sm text-white/65">{hint}</p>}
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="flex gap-5" aria-label={`${digits.length} van ${LENGTH} cijfers ingevuld`}>
          {Array.from({ length: LENGTH }, (_, i) => (
            <span key={i} className={`h-[18px] w-[18px] rounded-full border-2 border-white transition ${i < digits.length ? "bg-white" : "bg-transparent"} ${busy ? "animate-pulse" : ""}`} />
          ))}
        </div>
        <p className="min-h-[2.5rem] max-w-xs px-3 pt-2 text-center text-sm text-white/85" role="status">
          {message}
        </p>
      </div>

      <div className="grid w-full max-w-[22rem] grid-cols-3 gap-x-2">
        {KEYS.map(({ digit, letters }) => (
          <button key={digit} type="button" className={keyBase} onClick={() => press(digit)} disabled={busy}>
            <span className="text-[2.6rem] font-light leading-none">{digit}</span>
            <span className="h-4 pt-1 text-[0.7rem] font-medium leading-none tracking-[0.3em]">{letters}</span>
          </button>
        ))}
        {onFaceId ? (
          <button type="button" className={keyBase} onClick={onFaceId} disabled={busy || faceIdBusy} aria-label="Ontgrendelen met Face ID">
            <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2" />
              <path d="M9 10v1.5M15 10v1.5M12 10v3h-.6M9 16c1.5 1.5 4.5 1.5 6 0" />
            </svg>
          </button>
        ) : onCancel ? (
          <button type="button" className={`${keyBase} text-base`} onClick={onCancel}>
            Annuleer
          </button>
        ) : (
          <span />
        )}
        <button type="button" className={keyBase} onClick={() => press("0")} disabled={busy}>
          <span className="text-[2.6rem] font-light leading-none">0</span>
          <span className="h-4" />
        </button>
        <button type="button" className={keyBase} onClick={back} aria-label="Wis laatste cijfer">
          <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 5H9l-6 7 6 7h12a1 1 0 001-1V6a1 1 0 00-1-1zM17 9l-6 6M11 9l6 6" />
          </svg>
        </button>
      </div>

      <div className="flex min-h-[3.5rem] items-center pt-2">{footer}</div>
    </div>
  );
}
