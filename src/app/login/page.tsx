import { login } from "@/actions/auth";
import { PasskeyLogin } from "./passkey-login";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <form action={login} className="space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">Inloggen</h1>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium text-gray-700">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            className="min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-base"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="password"
            className="text-sm font-medium text-gray-700"
          >
            Wachtwoord
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-base"
          />
        </div>

        <button
          type="submit"
          className="min-h-[44px] w-full rounded-md bg-gray-900 px-3 py-2 text-base font-medium text-white hover:bg-gray-800"
        >
          Inloggen
        </button>
      </form>

        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="h-px flex-1 bg-gray-200" />
          of
          <span className="h-px flex-1 bg-gray-200" />
        </div>
        <PasskeyLogin />
      </div>
    </div>
  );
}
