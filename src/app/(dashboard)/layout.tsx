import { getNavTabs } from "@/lib/settings";
import { TabBar } from "./tab-bar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tabs = await getNavTabs();
  return (
    <div className="flex min-h-screen flex-col pt-[env(safe-area-inset-top)]">
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-32 pt-5">{children}</main>
      <TabBar tabs={tabs} />
    </div>
  );
}
