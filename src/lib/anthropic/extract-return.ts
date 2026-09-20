import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const ReturnExtractionSchema = z.object({
  merchant_name: z.string().describe("Naam van de webshop/verkoper"),
  order_reference: z.string().nullable().describe("Ordernummer of referentie als die genoemd wordt, anders null"),
  returned_items: z.array(
    z.object({
      description: z.string().describe("Omschrijving van het geretourneerde artikel"),
      quantity: z.number().int().min(1).describe("Aantal geretourneerd"),
      amount: z.number().nullable().describe("Bedrag voor dit artikel in euro's, of null"),
    })
  ),
  shipping_refunded: z
    .number()
    .nullable()
    .describe("Verzendkosten die worden terugbetaald, in euro's als positief getal, of null als niet genoemd"),
  return_fee: z
    .number()
    .nullable()
    .describe("Retourkosten die worden ingehouden op het terug te betalen bedrag, positief getal, of null"),
  refund_total: z.number().nullable().describe("Totaal terug te betalen bedrag in euro's, of null"),
});

export type ExtractedReturn = z.infer<typeof ReturnExtractionSchema>;

// Return confirmations / credit notes from webshops (often Dutch): which
// items come back, whether shipping is refunded, any fee held back, and the
// total refund. Small structured task — Haiku is plenty.
export async function extractReturnFromEmailText(emailText: string): Promise<ExtractedReturn> {
  const client = new Anthropic();

  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 2000,
    system:
      "Je extraheert gegevens uit retourbevestigingen en creditnota's van webshops (vaak Nederlandstalig). " +
      "Geef de geretourneerde artikelen, de terugbetaalde verzendkosten, eventuele ingehouden retourkosten en het totaal terug te betalen bedrag. " +
      "Alle bedragen als positieve getallen in euro's zonder €-teken. Als iets niet in de tekst staat, gebruik null.",
    messages: [{ role: "user", content: emailText }],
    output_config: { format: zodOutputFormat(ReturnExtractionSchema) },
  });

  if (!response.parsed_output) {
    throw new Error("Kon de retour niet uit de tekst halen.");
  }
  return response.parsed_output;
}
