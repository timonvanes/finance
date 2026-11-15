import Link from "next/link";
import { TikkieTest } from "./tikkie-test";

// A temporary page to try Tikkie links on a phone: which extra field (if any) makes Tikkie
// choose the account the Tikkie pays out to. Not linked from the menu.
export default function TikkieTestPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/pots" aria-label="Terug" className="flex h-12 w-12 items-center justify-center rounded-full text-2xl text-gray-700 active:bg-gray-100">
          ‹
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Tikkie testen</h1>
      </div>
      <TikkieTest />
    </div>
  );
}
