import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/export/csv";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: pr, error } = await supabase
    .from("payment_requests")
    .select(
      `reference_code,
      people(name),
      reclaims(computed_amount, note, transactions!reclaims_transaction_id_fkey(booking_date, counterparty_name, amount))`
    )
    .eq("id", id)
    .single();
  if (error || !pr) {
    return NextResponse.json({ error: "Betaalverzoek niet gevonden" }, { status: 404 });
  }

  const person = Array.isArray(pr.people) ? pr.people[0] : pr.people;
  const personName = person?.name ?? "Onbekend";
  const reclaimRows = Array.isArray(pr.reclaims) ? pr.reclaims : [];

  const rows = reclaimRows.map((r) => {
    const tx = Array.isArray(r.transactions) ? r.transactions[0] : r.transactions;
    return [
      tx?.booking_date ? new Date(tx.booking_date).toLocaleDateString("nl-NL") : "",
      tx?.counterparty_name ?? "",
      tx?.amount != null ? tx.amount.toFixed(2) : "",
      r.computed_amount.toFixed(2),
      r.note ?? "",
    ];
  });

  const total = reclaimRows.reduce((sum, r) => sum + r.computed_amount, 0);

  const csv = toCsv([
    ["Datum", "Omschrijving", "Totaalbedrag transactie", `Aandeel ${personName}`, "Notitie"],
    ...rows,
    ["", "", "Totaal", total.toFixed(2), ""],
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="terugvordering-${personName.replace(/[^a-zA-Z0-9]/g, "_")}-${pr.reference_code}.csv"`,
    },
  });
}
