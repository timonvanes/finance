import { login } from "@/actions/auth";
import { AuthShell } from "./auth-shell";

const field =
  "min-h-[56px] w-full rounded-2xl border border-white/15 bg-white/10 px-4 text-base text-white placeholder:text-white/40 outline-none transition focus:border-teal-400 focus:bg-white/15";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthShell title="Finance" subtitle="Log in om verder te gaan">
      <form action={login} className="space-y-4">
        {error && (
          <p className="rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200 ring-1 ring-red-400/30" role="alert">
            {error}
          </p>
        )}

        <div className="space-y-1.5">
          <label htmlFor="email" className="px-1 text-sm font-medium text-white/75">
            E-mail
          </label>
          <input id="email" name="email" type="email" autoComplete="username" required placeholder="naam@voorbeeld.nl" className={field} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="px-1 text-sm font-medium text-white/75">
            Wachtwoord
          </label>
          <input id="password" name="password" type="password" autoComplete="current-password" required placeholder="••••••••" className={field} />
        </div>

        <button
          type="submit"
          className="min-h-[56px] w-full rounded-2xl bg-teal-600 text-base font-semibold text-white shadow-lg shadow-teal-900/40 transition active:scale-[0.99] active:bg-teal-700"
        >
          Inloggen
        </button>
      </form>
      <p className="text-center text-xs text-white/40">Daarna vraagt de app om de code van je authenticator.</p>
    </AuthShell>
  );
}
