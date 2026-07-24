import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/export/csv";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: r, error } = await supabase
    .from("reclaims")
    .select(
      `computed_amount, note, reference_code,
      people(name),
      transactions!reclaims_transaction_id_fkey(booking_date, counterparty_name, amount)`
    )
    .eq("id", id)
    .single();
  if (error || !r) {
    return NextResponse.json({ error: "Terugvordering niet gevonden" }, { status: 404 });
  }

  const person = Array.isArray(r.people) ? r.people[0] : r.people;
  const personName = person?.name ?? "Onbekend";
  const tx = Array.isArray(r.transactions) ? r.transactions[0] : r.transactions;

  const csv = toCsv([
    ["Datum", "Omschrijving", "Totaalbedrag transactie", `Aandeel ${personName}`, "Notitie"],
    [
      tx?.booking_date ? new Date(tx.booking_date).toLocaleDateString("nl-NL") : "",
      tx?.counterparty_name ?? "",
      tx?.amount != null ? tx.amount.toFixed(2) : "",
      r.computed_amount.toFixed(2),
      r.note ?? "",
    ],
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="terugvordering-${personName.replace(/[^a-zA-Z0-9]/g, "_")}-${r.reference_code ?? id.slice(0, 6)}.csv"`,
    },
  });
}
