import type { HouseInputs } from "@/lib/house/calc";
import { FIELD_BY_ID } from "./fields";
import type { Extra } from "./types";

// What the plan needs from the person before its answer means something. Values it
// can only guess (growth, rates, costs) are not listed: those start with a sensible
// assumption.
export interface Missing {
  id: string;
  label: string;
  group: string;
}

export function missingInputs(b: HouseInputs, x: Extra): Missing[] {
  const need: [string, boolean][] = [
    ["targetPrice", b.targetPrice > 0],
    ["incomeGrossYear", b.incomeGrossYear > 0 || Object.keys(x.salaryYou).length > 0],
    ["birthYear", x.birthYear > 1900 && x.birthYear < 2015],
    ["rentNow", x.rentNow > 0],
    ["otherSpendingMonth", x.otherSpendingMonth > 0],
    ["monthlySave", b.monthlySave + b.monthlyInvest + x.monthlyBonds > 0],
  ];
  if (x.buyingTogether) {
    need.push(["partnerIncomeGrossYear", b.partnerIncomeGrossYear > 0 || Object.keys(x.salaryPartner).length > 0]);
    need.push(["partnerBirthYear", x.partnerBirthYear > 1900 && x.partnerBirthYear < 2015]);
  }
  return need
    .filter(([, ok]) => !ok)
    .map(([id]) => {
      const f = FIELD_BY_ID.get(id);
      return { id, label: f?.label ?? id, group: f?.group ?? "" };
    });
}
