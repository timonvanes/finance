import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const MailSchema = z.object({
  kind: z
    .enum(["order_confirmation", "delivered", "return_confirmation", "other"])
    .describe(
      "order_confirmation = bevestiging van een nieuwe bestelling; delivered = pakket is bezorgd of ligt klaar; " +
        "return_confirmation = bevestiging van een retour, creditnota of terugbetaling; other = al het andere (reclame, verzendupdate onderweg, etc.)"
    ),
  merchant_name: z
    .string()
    .describe("Naam van de webshop waar de bestelling is geplaatst (bij een Klarna-mail dus de winkel, niet Klarna zelf)"),
  order_date: z.string().nullable().describe("Besteldatum als YYYY-MM-DD, of null"),
  delivered_date: z.string().nullable().describe("Bezorgdatum als YYYY-MM-DD als die genoemd wordt, of null"),
  total_amount: z.number().nullable().describe("Totaalbedrag van de bestelling in euro's, of null"),
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
    .describe("Aantal dagen retourtermijn (bijv. 14 of 30) als genoemd, anders null"),
  shipping_refunded: z.number().nullable().describe("Terugbetaalde verzendkosten in euro's, of null"),
  return_fee: z.number().nullable().describe("Ingehouden retourkosten in euro's, of null"),
  refund_total: z.number().nullable().describe("Totaal terug te betalen bedrag bij een retour, of null"),
  via_klarna: z.boolean().describe("true als de bestelling via Klarna is betaald of de mail van/over Klarna gaat"),
  klarna_credit_confirmed: z
    .boolean()
    .describe("true als de mail bevestigt dat Klarna het bedrag heeft verrekend, gecrediteerd of terugbetaald"),
});

export type ExtractedMail = z.infer<typeof MailSchema>;

export async function extractMail(input: { subject: string; from: string; text: string }): Promise<ExtractedMail> {
  const client = new Anthropic();
  const today = new Date().toISOString().slice(0, 10);

  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 2500,
    system:
      "Je leest doorgestuurde mails van webshops (vaak Nederlandstalig, vaak kleding) en haalt er gegevens uit. " +
      `Vandaag is ${today}. Bedragen zijn getallen in euro's zonder €-teken. Datums als YYYY-MM-DD. ` +
      "Bij een retour: geef in items de geretourneerde artikelen. Gebruik null als iets er niet in staat. " +
      "Een verzendupdate zoals 'onderweg' of 'verzonden' is 'other', tenzij er ook een bezorgdatum of retourtermijn in staat. " +
      "Verzin nooit een retourtermijn of datum.",
    messages: [
      {
        role: "user",
        content: `Van: ${input.from}\nOnderwerp: ${input.subject}\n\n${input.text.slice(0, 12000)}`,
      },
    ],
    output_config: { format: zodOutputFormat(MailSchema) },
  });

  if (!response.parsed_output) throw new Error("Kon de mail niet lezen.");
  return response.parsed_output;
}
