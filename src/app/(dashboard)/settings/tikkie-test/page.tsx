import Link from "next/link";

// Temporary test page: which Tikkie addresses open the app with the amount and
// description already filled in? Tap each link on the phone and look.
const CANDIDATES = [
  "tikkie://",
  "tikkie://request?amount=12.50&description=Testcode%20ABCD",
  "tikkie://request?amount=1250&description=Testcode%20ABCD",
  "tikkie://create?amount=12.50&description=Testcode%20ABCD",
  "tikkie://new?amount=12.50&description=Testcode%20ABCD",
  "tikkie://paymentrequest?amount=12.50&description=Testcode%20ABCD",
  "tikkie://payment-request?amount=12.50&description=Testcode%20ABCD",
  "tikkie://tikkie?amount=12.50&description=Testcode%20ABCD",
  "tikkie://?amount=12.50&description=Testcode%20ABCD",
  "tikkie://?amount=12.50&note=Testcode%20ABCD",
  "tikkie://new-tikkie?amount=12.50&description=Testcode%20ABCD",
  "https://tikkie.me/?amount=12.50&description=Testcode%20ABCD",
];

export default function TikkieTestPage() {
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
        <h1 className="text-2xl font-semibold text-gray-900">Tikkie-test</h1>
      </div>
      <p className="px-1 text-base text-gray-600">
        Tik op een link en kijk of Tikkie opent met bedrag €12,50 en omschrijving &quot;Testcode ABCD&quot; al ingevuld.
        Noteer het nummer van de link waarbij dat gebeurt.
      </p>
      <ol className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
        {CANDIDATES.map((url, i) => (
          <li key={url}>
            <a href={url} className="flex min-h-[56px] items-center gap-3 px-5 py-3 text-sm text-gray-900 active:bg-gray-50">
              <span className="w-6 shrink-0 text-base font-semibold text-gray-500">{i + 1}</span>
              <span className="min-w-0 break-all">{url}</span>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
