import Link from "next/link";

export default function SchuldenPage() {
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
        <h1 className="text-2xl font-semibold text-gray-900">Schulden en hypotheek</h1>
      </div>

      <div className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-gray-200">
        <p className="text-base font-medium text-gray-900">We werken dit nog uit.</p>
        <p className="text-base text-gray-600">Hier komen straks je studielening (DUO) en later je hypotheek.</p>
        <ul className="list-disc space-y-1 pl-5 text-base text-gray-600">
          <li>Openstaande schuld, rente en het einde van de rentevaste periode</li>
          <li>Je maandlast bij de vaste lasten en in je vrije ruimte</li>
          <li>Een melding als de rente opnieuw wordt vastgezet</li>
        </ul>
      </div>
    </div>
  );
}
