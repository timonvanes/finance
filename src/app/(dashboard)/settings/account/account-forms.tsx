"use client";

import { useActionState } from "react";
import { changeEmail, changePassword, type AccountResult } from "@/actions/account";

const field =
  "box-border min-h-[48px] w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 text-base";
const button =
  "min-h-[52px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50";

function Result({ state }: { state: AccountResult }) {
  if (state.error) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>;
  if (state.ok) return <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">{state.ok}</p>;
  return null;
}

export function AccountForms() {
  const [pw, pwAction, pwPending] = useActionState(changePassword, {} as AccountResult);
  const [mail, mailAction, mailPending] = useActionState(changeEmail, {} as AccountResult);

  return (
    <div className="space-y-5">
      <form action={pwAction} className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-gray-200">
        <h2 className="text-base font-medium text-gray-900">Wachtwoord wijzigen</h2>
        <label className="block">
          <span className="mb-1 block text-sm text-gray-600">Huidig wachtwoord</span>
          <input name="current" type="password" required autoComplete="current-password" className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-gray-600">Nieuw wachtwoord (minstens 10 tekens)</span>
          <input name="next" type="password" required minLength={10} autoComplete="new-password" className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-gray-600">Nieuw wachtwoord nog een keer</span>
          <input name="again" type="password" required minLength={10} autoComplete="new-password" className={field} />
        </label>
        <Result state={pw} />
        <button type="submit" disabled={pwPending} className={button}>
          {pwPending ? "Bezig…" : "Wachtwoord wijzigen"}
        </button>
        <p className="text-xs text-gray-500">Gebruik een wachtwoord dat je nergens anders gebruikt. Een wachtwoordmanager helpt daarbij.</p>
      </form>

      <form action={mailAction} className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-gray-200">
        <h2 className="text-base font-medium text-gray-900">E-mailadres wijzigen</h2>
        <label className="block">
          <span className="mb-1 block text-sm text-gray-600">Nieuw e-mailadres</span>
          <input name="email" type="email" required autoComplete="email" className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-gray-600">Huidig wachtwoord</span>
          <input name="current" type="password" required autoComplete="current-password" className={field} />
        </label>
        <Result state={mail} />
        <button type="submit" disabled={mailPending} className={button}>
          {mailPending ? "Bezig…" : "E-mailadres wijzigen"}
        </button>
        <p className="text-xs text-gray-500">
          Je krijgt een bevestiging in je huidige en je nieuwe mailbox. Tot je beide hebt bevestigd, log je nog in met je oude adres.
        </p>
      </form>
    </div>
  );
}
