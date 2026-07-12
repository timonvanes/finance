import Link from "next/link";

const SETTINGS_LINKS = [
  { href: "/settings/categories", label: "Categorieën", description: "Beheer je uitgaven- en inkomencategorieën" },
  { href: "/settings/people", label: "Personen", description: "Personen en groepen voor terugvorderingen" },
  { href: "/settings/bank-connections", label: "Bank", description: "Bankkoppelingen en synchronisatie" },
  { href: "/settings/own-ibans", label: "Eigen IBAN's", description: "Extra eigen rekeningen (bv. Revolut) voor herkenning van verschuivingen" },
];

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">Instellingen</h1>
      <ul className="space-y-3">
        {SETTINGS_LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="flex min-h-[64px] flex-col justify-center rounded-md border border-gray-200 bg-white px-4 py-3 hover:bg-gray-50"
            >
              <span className="text-base font-medium text-gray-900">{link.label}</span>
              <span className="text-sm text-gray-500">{link.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
