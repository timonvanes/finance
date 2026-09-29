import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const OrderExtractionSchema = z.object({
  merchant_name: z.string().describe("Naam van de webshop/verkoper"),
  order_date: z
    .string()
    .nullable()
    .describe("Besteldatum als ISO-datum YYYY-MM-DD, of null als niet gevonden"),
  total_amount: z.number().nullable().describe("Totaalbedrag van de bestelling in euro's"),
  items: z.array(
    z.object({
      description: z.string().describe("Omschrijving van het artikel"),
      price: z.number().describe("Prijs per stuk in euro's"),
      quantity: z.number().int().min(1).describe("Aantal"),
    })
  ),
  return_deadline: z
    .string()
    .nullable()
    .describe("Uiterste retourdatum als YYYY-MM-DD als die letterlijk genoemd wordt, anders null"),
  return_window_days: z
    .number()
    .int()
    .nullable()
    .describe("Retourtermijn in dagen als die genoemd wordt (bijv. 14 of 30), anders null"),
});

export type ExtractedOrder = z.infer<typeof OrderExtractionSchema>;

// A small structured-extraction task (~1-3k input tokens, small JSON output)
// — Haiku is plenty capable here and far cheaper than a bigger model.
export async function extractOrderFromEmailText(emailText: string): Promise<ExtractedOrder> {
  const client = new Anthropic();

  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 2000,
    system:
      "Je extraheert bestelgegevens uit orderbevestigingsmails of digitale bonnetjes van webshops en winkels " +
      "(vaak Nederlandstalig). Geef per artikel de omschrijving, de prijs per stuk in euro's als getal " +
      "(zonder €-teken), en het aantal. Als een bedrag, datum of retourtermijn niet in de tekst voorkomt, " +
      "gebruik dan null. Verzin nooit een retourtermijn of datum die er niet staat.",
    messages: [{ role: "user", content: emailText }],
    output_config: { format: zodOutputFormat(OrderExtractionSchema) },
  });

  if (!response.parsed_output) {
    throw new Error("Kon de bestelling niet uit de tekst halen — probeer het handmatig in te vullen.");
  }
  return response.parsed_output;
}
