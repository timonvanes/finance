"use client";

import { useState, useTransition } from "react";
import { updateTransactionCategory } from "@/actions/transactions";

interface Category {
  id: string;
  name: string;
}

// Rood = geen categorie, geel = automatisch toegekend (rule), groen = zelf
// gecontroleerd/toegekend (manual) — zo zie je in één oogopslag wat nog
// aandacht nodig heeft en wat al vertrouwd is.
const SOURCE_STYLE: Record<string, string> = {
  none: "border-red-300 bg-red-50",
  rule: "border-amber-300 bg-amber-50",
  manual: "border-green-300 bg-green-50",
};

export function CategorySelect({
  transactionId,
  categoryId,
  categorySource,
  categories,
  hideWhenCategorized = false,
}: {
  transactionId: string;
  categoryId: string | null;
  categorySource: string;
  categories: Category[];
  hideWhenCategorized?: boolean;
}) {
  const [, startTransition] = useTransition();
  const [source, setSource] = useState(categorySource);

  return (
    <select
      defaultValue={categoryId ?? ""}
      onChange={(e) => {
        const newCategoryId = e.target.value;
        if (!newCategoryId) return;
        const previous = source;
        setSource("manual");
        const li = hideWhenCategorized ? e.currentTarget.closest("li") : null;
        li?.classList.add("hidden");
        startTransition(async () => {
          try {
            await updateTransactionCategory(transactionId, newCategoryId);
          } catch {
            setSource(previous);
            li?.classList.remove("hidden");
          }
        });
      }}
      className={`rounded-md border px-2 py-1 text-xs text-gray-700 ${SOURCE_STYLE[source] ?? SOURCE_STYLE.none}`}
    >
      <option value="" disabled>
        Categorie…
      </option>
      {categories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
    </select>
  );
}
