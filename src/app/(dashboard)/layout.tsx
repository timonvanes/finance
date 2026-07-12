import Link from "next/link";
import { logout } from "@/actions/auth";

const NAV_ITEMS = [
  { href: "/", label: "Overzicht" },
  { href: "/transactions", label: "Transacties" },
  { href: "/reclaims", label: "Terugvorderingen" },
  { href: "/returns", label: "Retouren" },
  { href: "/settings/categories", label: "Categorieën" },
  { href: "/settings/people", label: "Personen" },
  { href: "/settings/bank-connections", label: "Bank" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <nav className="flex gap-4 overflow-x-auto text-sm">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap text-gray-600 hover:text-gray-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <form action={logout}>
            <button
              type="submit"
              className="whitespace-nowrap text-sm text-gray-500 hover:text-gray-900"
            >
              Uitloggen
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
