"use client";

import { useState } from "react";

// Illustrative compound-growth estimate only — not investment advice, no
// specific products/brokers recommended. Ordinary annuity: contribution at
// the end of each month, monthly compounding at the given annual rate.
export function InvestmentCalculator() {
  const [monthly, setMonthly] = useState("100");
  const [annualReturn, setAnnualReturn] = useState("6");
  const [years, setYears] = useState("10");

  const p = Number(monthly) || 0;
  const r = (Number(annualReturn) || 0) / 100 / 12;
  const n = (Number(years) || 0) * 12;

  const futureValue = r === 0 ? p * n : p * ((Math.pow(1 + r, n) - 1) / r);
  const totalContributed = p * n;
  const growth = futureValue - totalContributed;

  return (
    <div className="space-y-3 rounded-md border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-500">
        Indicatieve berekening op basis van vast maandbedrag en een aangenomen jaarlijks
        rendement — geen beleggingsadvies en geen garantie, echt rendement kan (flink)
        afwijken.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Per maand</label>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400">€</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
              className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Aangenomen rendement/jaar
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.5"
              value={annualReturn}
              onChange={(e) => setAnnualReturn(e.target.value)}
              className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <span className="text-xs text-gray-400">%</span>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Looptijd</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={years}
              onChange={(e) => setYears(e.target.value)}
              className="w-16 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <span className="text-xs text-gray-400">jaar</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 rounded-md bg-gray-50 p-3 text-center">
        <div>
          <p className="text-lg font-semibold text-gray-900">€{totalContributed.toFixed(0)}</p>
          <p className="text-xs text-gray-500">zelf ingelegd</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-green-700">€{growth.toFixed(0)}</p>
          <p className="text-xs text-gray-500">geschat rendement</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-900">€{futureValue.toFixed(0)}</p>
          <p className="text-xs text-gray-500">geschat totaal</p>
        </div>
      </div>
    </div>
  );
}
