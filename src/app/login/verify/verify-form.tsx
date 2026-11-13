"use client";

import { useActionState } from "react";
import { verifyLoginCode, type MfaResult } from "@/actions/mfa";

export function VerifyForm() {
  const [state, action, pending] = useActionState(verifyLoginCode, {} as MfaResult);
  return (
    <form action={action} className="space-y-3">
      {state.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <input
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]*"
        maxLength={7}
        required
        autoFocus
        placeholder="000000"
        className="min-h-[56px] w-full rounded-md border border-gray-300 px-3 text-center text-2xl tracking-[0.4em]"
      />
      <button
        type="submit"
        disabled={pending}
        className="min-h-[48px] w-full rounded-md bg-gray-900 px-3 text-base font-medium text-white disabled:opacity-50"
      >
        {pending ? "Controleren…" : "Doorgaan"}
      </button>
    </form>
  );
}
