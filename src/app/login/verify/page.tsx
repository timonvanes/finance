import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/actions/auth";
import { AuthShell } from "../auth-shell";
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
    <AuthShell title="Tweede stap" subtitle="Open je authenticator-app en vul de code van zes cijfers in.">
      <VerifyForm />
      <form action={logout}>
        <button type="submit" className="min-h-[44px] w-full text-sm text-white/60 underline decoration-white/30 underline-offset-4">
          Annuleren en uitloggen
        </button>
      </form>
    </AuthShell>
  );
}
