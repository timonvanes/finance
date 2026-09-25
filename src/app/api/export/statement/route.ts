import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/export/csv";
import { buildStatement, isIsoDate } from "@/lib/statement";

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from") ?? undefined;
  const to = request.nextUrl.searchParams.get("to") ?? undefined;
  if (!isIsoDate(from) || !isIsoDate(to)) {
    return NextResponse.json({ error: "Ongeldige periode" }, { status: 400 });
  }

  const supabase = await createClient();
  const statement = await buildStatement(supabase, from, to);

  const rows: string[][] = [["Datum", "Soort", "Categorie", "Omschrijving", "Bedrag"]];
  for (const [kind, groups] of [
    ["Bate", statement.income],
    ["Last", statement.expense],
  ] as const) {
    for (const group of groups) {
      for (const tx of group.transactions) {
        rows.push([
          new Date(tx.date).toLocaleDateString("nl-NL"),
          kind,
          group.name,
          tx.name,
          (kind === "Bate" ? tx.amount : -tx.amount).toFixed(2),
        ]);
      }
    }
  }
  rows.push([]);
  rows.push(["", "", "", "Totaal baten", statement.totalIncome.toFixed(2)]);
  rows.push(["", "", "", "Totaal lasten", (-statement.totalExpense).toFixed(2)]);
  rows.push(["", "", "", "Gereserveerd in potjes", (-statement.reserved).toFixed(2)]);
  rows.push(["", "", "", "Netto na potjes", statement.net.toFixed(2)]);

  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="baten-en-lasten-${from}-${to}.csv"`,
    },
  });
}
