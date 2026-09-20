import Link from "next/link";
import { addManualOwnIban, getManualOwnIbans } from "@/actions/own-ibans";
import { DeleteButton } from "./delete-button";

export default async function OwnIbansPage() {
  const ibans = await getManualOwnIbans();

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
        <Link
          href="/settings"
          aria-label="Terug"
          className="flex h-12 w-12 items-center justify-center rounded-full text-2xl text-gray-700 active:bg-gray-100"
        >
          ‹
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Eigen IBAN&apos;s</h1>
      </div>
        <p className="mt-1 text-sm text-gray-500">
          Voor rekeningen die niet als bankkoppeling zijn gekoppeld (zoals Revolut) —
          overschrijvingen naar/van deze IBAN&apos;s worden ook herkend als verschuiving
          tussen je eigen rekeningen, niet als uitgave of inkomen.
        </p>
      </div>

      <form
        action={addManualOwnIban}
        className="flex flex-col gap-4 rounded-2xl bg-white p-5 ring-1 ring-gray-200"
      >
        <div className="flex-1">
          <label className="mb-1 block text-sm text-gray-500">IBAN</label>
          <input
            type="text"
            name="iban"
            required
            placeholder="bv. LT12 3456 7890 1234 5678"
            className="min-h-[52px] w-full rounded-xl border border-gray-300 px-4 text-base"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-sm text-gray-500">
            Label (optioneel)
          </label>
          <input
            type="text"
            name="label"
            placeholder="bv. Revolut"
            className="min-h-[52px] w-full rounded-xl border border-gray-300 px-4 text-base"
          />
        </div>
        <button
          type="submit"
          className="min-h-[52px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800"
        >
          Toevoegen
        </button>
      </form>

      {ibans.length > 0 ? (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
          {ibans.map((i) => (
            <li key={i.id} className="flex min-h-[60px] items-center justify-between gap-3 px-5 py-3 text-base">
              <div>
                <p className="font-medium text-gray-900">{i.iban}</p>
                {i.label && <p className="text-gray-500">{i.label}</p>}
              </div>
              <DeleteButton id={i.id} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-white p-5 text-base text-gray-500 ring-1 ring-gray-200">Nog geen eigen IBAN&apos;s toegevoegd.</p>
      )}
    </div>
  );
}
