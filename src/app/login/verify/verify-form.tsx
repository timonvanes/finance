"use client";

import { useActionState } from "react";
import { verifyLoginCode, type MfaResult } from "@/actions/mfa";

export function VerifyForm() {
  const [state, action, pending] = useActionState(verifyLoginCode, {} as MfaResult);
  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p className="rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200 ring-1 ring-red-400/30" role="alert">
          {state.error}
        </p>
      )}
      <input
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]*"
        maxLength={7}
        required
        autoFocus
        placeholder="000000"
        aria-label="Code van zes cijfers"
        className="min-h-[64px] w-full rounded-2xl border border-white/15 bg-white/10 px-4 text-center text-3xl tracking-[0.4em] text-white placeholder:text-white/30 outline-none transition focus:border-teal-400 focus:bg-white/15"
      />
      <button
        type="submit"
        disabled={pending}
        className="min-h-[56px] w-full rounded-2xl bg-teal-600 text-base font-semibold text-white shadow-lg shadow-teal-900/40 transition active:scale-[0.99] active:bg-teal-700 disabled:opacity-50"
      >
        {pending ? "Controleren…" : "Doorgaan"}
      </button>
    </form>
  );
}
