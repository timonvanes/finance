import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/actions/auth";
import { VerifyForm } from "./verify-form";

// The second step of logging in: the code from the authenticator app.
export default async function VerifyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  // Already through, or nothing set up: no second step needed.
  if (aal?.currentLevel === "aal2" || aal?.nextLevel !== "aal2") redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Tweede stap</h1>
          <p className="mt-1 text-sm text-gray-600">Open je authenticator-app en vul de code van zes cijfers in voor deze app.</p>
        </div>
        <VerifyForm />
        <form action={logout}>
          <button type="submit" className="min-h-[44px] w-full text-sm text-gray-500 underline">
            Annuleren en uitloggen
          </button>
        </form>
      </div>
    </div>
  );
}
