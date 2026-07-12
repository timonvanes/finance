import { login } from "@/actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <form
        action={login}
        className="w-full max-w-sm space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
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
    </div>
  );
}
