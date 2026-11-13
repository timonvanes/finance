"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  // A second step is set up: it must be passed before anything else opens. The flag the
  // proxy checks is kept in step with that here, in case it was ever missing.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && user.app_metadata?.mfa_required !== true) {
      await createAdminClient().auth.admin.updateUserById(user.id, { app_metadata: { mfa_required: true } });
    }
    redirect("/login/verify");
  }

  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
