import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const ReceiptSchema = z.object({
  merchant_name: z.string().describe("Naam van de winkel"),
  purchase_date: z.string().nullable().describe("Datum van aankoop als YYYY-MM-DD, of null als niet leesbaar"),
  total_amount: z.number().nullable().describe("Totaalbedrag in euro's, of null"),
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
    .describe("Uiterste retourdatum als die letterlijk op het bonnetje staat, als YYYY-MM-DD, anders null"),
  return_window_days: z
    .number()
    .int()
    .nullable()
    .describe("Retourtermijn in dagen als die op het bonnetje staat (bijv. '14 dagen bedenktijd' of '30 dagen retourrecht'), anders null"),
});

export type ExtractedReceipt = z.infer<typeof ReceiptSchema>;

// A photographed receipt: same idea as mail extraction, but the input is an
// image. Haiku's vision is plenty for a receipt's flat, printed layout.
export async function extractReceipt(imageBase64: string, mediaType: string): Promise<ExtractedReceipt> {
  const client = new Anthropic();
  const today = new Date().toISOString().slice(0, 10);

  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 2000,
    system:
      "Je leest een foto van een kassabon of aankoopbewijs (vaak Nederlandstalig) en haalt er gegevens uit. " +
      `Vandaag is ${today}. Bedragen zijn getallen in euro's zonder €-teken. Datums als YYYY-MM-DD. ` +
      "Geef per artikel de omschrijving, de prijs per stuk en het aantal. Gebruik null als iets niet leesbaar of niet aanwezig is. " +
      "Verzin nooit een retourtermijn, datum of bedrag dat je niet kunt lezen.",
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType as "image/jpeg", data: imageBase64 } },
          { type: "text", text: "Haal de gegevens uit dit bonnetje." },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(ReceiptSchema) },
  });

  if (!response.parsed_output) {
    throw new Error("Kon het bonnetje niet lezen — probeer een duidelijkere foto of vul het handmatig in.");
  }
  return response.parsed_output;
}
