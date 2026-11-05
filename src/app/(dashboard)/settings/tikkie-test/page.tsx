import Link from "next/link";
import { TikkieLinks } from "./links";

// Temporary test page. The Tikkie app (found in its manifest) answers to
// tikkie://overview, open, overview_account, ... besides payment_request. This
// checks which of them the iPhone app opens, and whether a name can be passed on.
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
      <TikkieLinks />
    </div>
  );
}
