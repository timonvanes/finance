import { createClient } from "@/lib/supabase/server";
import { pinIsSet } from "@/lib/app-pin";
import { getNavTabs } from "@/lib/settings";
import { AppLock } from "./app-lock";
import { TabBar } from "./tab-bar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const [tabs, claims] = await Promise.all([getNavTabs(), supabase.auth.getClaims()]);
  // The app code is compulsory: without one, the person chooses it first. (Without a login
  // the proxy has already sent the person away; the lock then simply shows.)
  const userId = claims.data?.claims?.sub;
  const hasPin = userId ? await pinIsSet(userId) : true;
  return (
    <AppLock hasPin={hasPin}>
      <div className="flex min-h-screen flex-col pt-[env(safe-area-inset-top)]">
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-32 pt-5">{children}</main>
        <TabBar tabs={tabs} />
      </div>
    </AppLock>
  );
}
