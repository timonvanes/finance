import { TabBar } from "./tab-bar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col pt-[env(safe-area-inset-top)]">
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-32 pt-5">{children}</main>
      <TabBar />
    </div>
  );
}
