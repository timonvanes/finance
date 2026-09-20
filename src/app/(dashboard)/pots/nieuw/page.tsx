import Link from "next/link";
import { NewPotForm } from "./new-pot-form";

export default function NewPotPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link
          href="/pots"
          aria-label="Terug"
          className="flex h-12 w-12 items-center justify-center rounded-full text-2xl text-gray-700 active:bg-gray-100"
        >
          ‹
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Nieuw potje</h1>
      </div>
      <NewPotForm />
    </div>
  );
}
