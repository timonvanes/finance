import Link from "next/link";
import { logout } from "@/actions/auth";

const SECTIONS: { title: string; items: { href: string; label: string; hint?: string }[] }[] = [
  {
    title: "Overig",
    items: [
      { href: "/pots", label: "Potjes", hint: "Nog in ontwikkeling" },
      { href: "/settings", label: "Instellingen" },
    ],
  },
  {
    title: "Instellingen",
    items: [
      { href: "/settings/bank-connections", label: "Bankkoppelingen" },
      { href: "/settings/budgets", label: "Budgetdoelen" },
      { href: "/settings/categories", label: "Categorieën" },
      { href: "/settings/people", label: "Personen" },
      { href: "/settings/own-ibans", label: "Eigen rekeningnummers" },
    ],
  },
  {
    title: "Oude versies",
    items: [{ href: "/reclaims", label: "Terugvorderingen (oude versie)" }],
  },
];

export default function MeerPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Meer</h1>

      {SECTIONS.map((section) => (
        <section key={section.title} className="space-y-2">
          <h2 className="px-1 text-sm font-medium text-gray-500">{section.title}</h2>
          <ul className="overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
            {section.items.map((item) => (
              <li key={item.href} className="border-b border-gray-100 last:border-b-0">
                <Link
                  href={item.href}
                  className="flex min-h-[60px] items-center gap-3 px-5 py-3 active:bg-gray-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg text-gray-900">{item.label}</span>
                    {item.hint && <span className="block text-sm text-gray-500">{item.hint}</span>}
                  </span>
                  <span className="text-2xl text-gray-300">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <form action={logout}>
        <button
          type="submit"
          className="min-h-[56px] w-full rounded-2xl bg-white text-lg text-red-600 ring-1 ring-gray-200 active:bg-gray-50"
        >
          Uitloggen
        </button>
      </form>
    </div>
  );
}
