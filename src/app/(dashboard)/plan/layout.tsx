import Link from "next/link";
import type { ReactNode } from "react";
import { getPlanData } from "@/actions/plan";
import { PlanProvider } from "./plan-provider";
import { SubNav } from "./sub-nav";

export default async function PlanLayout({ children }: { children: ReactNode }) {
  const data = await getPlanData();
  return (
    <PlanProvider initialB={data.b} initialX={data.x} app={data.app} hasExtra={data.hasExtra}>
      <div className="space-y-4 pb-16">
        <div className="flex items-center gap-2">
          <Link
            href="/meer"
            aria-label="Terug"
            className="flex h-12 w-12 items-center justify-center rounded-full text-2xl text-gray-700 active:bg-gray-100"
          >
            ‹
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Financieel plan</h1>
            <p className="text-xs text-gray-500">Huis, inkomen, belasting, studielening, sparen en beleggen</p>
          </div>
        </div>
        <SubNav />
        {children}
      </div>
    </PlanProvider>
  );
}
