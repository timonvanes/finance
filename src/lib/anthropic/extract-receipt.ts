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
    max_tokens: 2500,
    system:
      "Je leest een foto van een kassabon of aankoopbewijs (vaak Nederlandstalig) en haalt er gegevens uit. " +
      `Vandaag is ${today}. Bedragen zijn getallen in euro's zonder €-teken. Datums als YYYY-MM-DD. ` +
      "Ga regel voor regel door de bon, van boven naar beneden. Op een kassabon staat per artikel meestal de " +
      "omschrijving op één regel, met de prijs erachter of eronder; soms staan aantal en prijs-per-stuk op een " +
      "aparte regel als 'AANTAL x PRIJS'. Neem elk artikel apart op, ook als de naam een afkorting of kassacode is " +
      "— schrijf die dan zoals hij op de bon staat, verzin geen productnaam die er niet echt staat. " +
      "Regels als SUBTOTAAL, BTW, KORTING, STATIEGELD, TOTAAL, PIN, CONTANT, RETOUR of kaartnummers zijn GEEN " +
      "artikelen — sla die over (korting mag wel apart genoteerd worden als er een discount-veld is, artikelprijzen " +
      "blijven dan zoals afgedrukt). Als tekst onscherp, afgesneden of onleesbaar is: laat dat artikel liever weg of " +
      "zet een zo letterlijk mogelijke lezing neer, verzin nooit prijzen of artikelen die je niet kunt lezen. " +
      "Het totaalbedrag moet, als het leesbaar is, overeenkomen met de som van de artikelen — controleer dat voor je antwoordt.",
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType as "image/jpeg", data: imageBase64 } },
          { type: "text", text: "Haal de gegevens uit dit bonnetje. Lees elke regel zorgvuldig, ook kleine tekst." },
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
