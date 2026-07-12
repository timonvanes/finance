import { addManualOwnIban, getManualOwnIbans } from "@/actions/own-ibans";
import { DeleteButton } from "./delete-button";

export default async function OwnIbansPage() {
  const ibans = await getManualOwnIbans();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Eigen IBAN&apos;s</h1>
        <p className="mt-1 text-sm text-gray-500">
          Voor rekeningen die niet als bankkoppeling zijn gekoppeld (zoals Revolut) —
          overschrijvingen naar/van deze IBAN&apos;s worden ook herkend als verschuiving
          tussen je eigen rekeningen, niet als uitgave of inkomen.
        </p>
      </div>

      <form
        action={addManualOwnIban}
        className="flex items-end gap-3 rounded-md border border-gray-200 bg-white p-4"
      >
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-700">IBAN</label>
          <input
            type="text"
            name="iban"
            required
            placeholder="bv. LT12 3456 7890 1234 5678"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Label (optioneel)
          </label>
          <input
            type="text"
            name="label"
            placeholder="bv. Revolut"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Toevoegen
        </button>
      </form>

      {ibans.length > 0 ? (
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
          {ibans.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-gray-900">{i.iban}</p>
                {i.label && <p className="text-gray-500">{i.label}</p>}
              </div>
              <DeleteButton id={i.id} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">Nog geen eigen IBAN&apos;s toegevoegd.</p>
      )}
    </div>
  );
}
