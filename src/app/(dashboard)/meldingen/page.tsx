import Link from "next/link";
import { getPushSettings } from "@/actions/push";
import { PushSettings } from "./push-settings";

export default async function MeldingenPage() {
  const settings = await getPushSettings();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link
          href="/meer"
          aria-label="Terug"
          className="flex h-12 w-12 items-center justify-center rounded-full text-2xl text-gray-700 active:bg-gray-100"
        >
          ‹
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Meldingen</h1>
      </div>
      <PushSettings disabled={settings.disabled} deviceCount={settings.deviceCount} />
    </div>
  );
}
