import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { listMfaFactors } from "@/actions/mfa";
import { AccountForms } from "./account-forms";
import { MfaSection } from "./mfa-section";
import { PasskeySection } from "./passkey-section";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const factors = await listMfaFactors();
  const lockOn = (await cookies()).get("applock")?.value === "1";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link
          href="/settings"
          aria-label="Terug"
          className="flex h-12 w-12 items-center justify-center rounded-full text-2xl text-gray-700 active:bg-gray-100"
        >
          ‹
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Account</h1>
      </div>

      <div className="rounded-2xl bg-white px-5 py-4 ring-1 ring-gray-200">
        <p className="text-sm text-gray-500">Je logt in met</p>
        <p className="break-all text-lg font-medium text-gray-900">{user?.email ?? "onbekend"}</p>
      </div>

      <PasskeySection lockOn={lockOn} />

      <MfaSection initial={factors} />

      <AccountForms />
    </div>
  );
}
