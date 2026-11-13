"use client";

import Link from "next/link";
import { usePlan } from "../plan-provider";
import { euro } from "../ui";

// The details behind the overview, one place each.
export default function AnalysisHub() {
  const { result: r, b, x, app } = usePlan();
  const pu = r.purchase;
  const rate = r.pay.find((p) => p.year === pu.year)?.avgRate ?? 0;
  const taxRate = rate > 0 ? `${(rate * 100).toFixed(1).replace(".", ",")}%` : "–";

  const items: { href: string; title: string; text: string; value: string }[] = [
    { href: "/plan/scenarios", title: "Scenario's en rekenhulp", text: "Hoeveel moet ik sparen, wat kan ik in jaar X kopen, A tegenover B", value: `${Math.round(r.probEnough * 100)}% kans` },
    { href: "/plan/hypotheek", title: "Hypotheek", text: "Hoe de bank rekent, bank tegenover comfortabel, rentetest", value: euro(pu.cap.loan) },
    { href: "/plan/huis", title: "Huis en kosten", text: "Wat de aankoop en het wonen kosten", value: euro(pu.needTotal) },
    { href: "/plan/inkomen", title: "Inkomen", text: "Salaris per jaar, netto en wat banken meetellen", value: euro(pu.netIncomeMonthly) + " p/m" },
    { href: "/plan/belasting", title: "Belasting", text: "Inkomstenbelasting, hypotheekrenteaftrek, box 3 en overdrachtsbelasting", value: taxRate },
    { href: "/plan/studielening", title: "Studielening", text: "Wat de schuld je aan hypotheek kost, aflossen of laten lopen", value: app.study.hasLoan ? euro(app.study.balanceNow) : "geen" },
    { href: "/plan/beleggen", title: "Sparen en beleggen", text: "Sparen, obligaties en aandelen naast elkaar, afbouwen", value: euro(b.startSavings + x.startBonds + b.startInvest) + " nu" },
  ];

  return (
    <ul className="overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
      {items.map((i) => (
        <li key={i.href} className="border-b border-gray-100 last:border-b-0">
          <Link href={i.href} prefetch className="flex min-h-[68px] items-center gap-3 px-5 py-3 active:bg-gray-50">
            <span className="min-w-0 flex-1">
              <span className="block text-base font-medium text-gray-900">{i.title}</span>
              <span className="block text-xs text-gray-500">{i.text}</span>
            </span>
            <span className="shrink-0 text-sm font-semibold text-gray-700">{i.value}</span>
            <span className="text-2xl text-gray-300">›</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
