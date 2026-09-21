import Link from "next/link";
import { getHousePlanData } from "@/actions/house";
import { HousePlanner } from "./house-planner";

export default async function HuisPage() {
  const data = await getHousePlanData();

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
        <h1 className="text-2xl font-semibold text-gray-900">Huisplanner</h1>
      </div>
      <HousePlanner initial={data.inputs} saved={data.saved} repayStart={data.repayStart} />
    </div>
  );
}
