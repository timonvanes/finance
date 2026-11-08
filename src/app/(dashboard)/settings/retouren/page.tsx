import Link from "next/link";
import { getReturnsEnabled } from "@/lib/settings";
import { ReturnsToggle } from "./returns-toggle";

export default async function ReturnsSettingsPage() {
  const enabled = await getReturnsEnabled();

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
        <h1 className="text-2xl font-semibold text-gray-900">Retouren</h1>
      </div>

      <p className="px-1 text-base text-gray-600">
        Met retouren bedoelen we bestellingen, retourtermijnen, doorgestuurde bestelmails en het scannen van bonnen. Gebruik je dat niet, zet het dan uit. De tab Retouren verdwijnt, de pagina is niet meer bereikbaar en je krijgt geen herinneringen meer over retourtermijnen.
      </p>

      <ReturnsToggle initial={enabled} />

      <p className="px-1 text-sm text-gray-500">Je bestaande gegevens blijven bewaard. Zet je het weer aan, dan staat alles er weer.</p>
    </div>
  );
}
