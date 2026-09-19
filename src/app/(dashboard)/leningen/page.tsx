import Link from "next/link";
import { getLoans } from "@/actions/loans";
import { LoanCard } from "./loan-card";

const euro = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

export default async function LeningenPage() {
  const loans = await getLoans();
  const open = loans.filter((l) => l.status === "open");
  const closed = loans.filter((l) => l.status === "closed");
  const total = open.reduce((s, l) => s + Math.max(l.balance, 0), 0);

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
        <h1 className="text-2xl font-semibold text-gray-900">Leningen</h1>
      </div>

      <div className="rounded-2xl bg-white p-5 ring-1 ring-gray-200">
        <p className="text-sm text-gray-500">Nog af te lossen</p>
        <p className="mt-1 text-4xl font-semibold text-gray-900">{euro(total)}</p>
      </div>

      <p className="px-1 text-sm text-gray-500">
        Een lening maak je aan bij een bijschrijving op de Transacties-pagina (knop{" "}
        <span className="font-medium">Lening</span>). Aflossingen koppel je bij een afschrijving met{" "}
        <span className="font-medium">Aflossing lening</span>.
      </p>

      {open.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-base text-gray-500 ring-1 ring-gray-200">
          Geen openstaande leningen.
        </p>
      ) : (
        <ul className="space-y-3">
          {open.map((loan) => (
            <LoanCard key={loan.id} loan={loan} />
          ))}
        </ul>
      )}

      {closed.length > 0 && (
        <details className="rounded-2xl bg-white ring-1 ring-gray-200">
          <summary className="flex min-h-[56px] cursor-pointer items-center px-5 text-base font-medium text-gray-700">
            Afgesloten ({closed.length})
          </summary>
          <ul className="space-y-3 p-3">
            {closed.map((loan) => (
              <LoanCard key={loan.id} loan={loan} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
