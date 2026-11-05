import { redirect } from "next/navigation";

// The house planner grew into the financial plan, with its own menu.
export default function HuisPage() {
  redirect("/plan");
}
