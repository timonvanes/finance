import Anthropic from "@anthropic-ai/sdk";

export interface ReturnPolicyLookup {
  days: number | null;
  sourceUrl: string | null;
}

// One small web search per shop: how many days do customers get to return an
// order? Kept deliberately cheap (Haiku, at most two searches, short answer).
export async function lookupReturnWindow(merchantName: string): Promise<ReturnPolicyLookup> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 600,
    system:
      "Je zoekt de retourtermijn van een Nederlandse webshop. Zoek op de officiële retourpagina van de webshop " +
      "(Nederlandse site). Antwoord uitsluitend met JSON in dit formaat en verder niets: " +
      '{"days": <aantal dagen als geheel getal of null>, "source": "<url van de pagina of null>"}. ' +
      "Geef null als je de termijn niet zeker op de officiële pagina van deze webshop vindt. Verzin niets.",
    messages: [{ role: "user", content: `Wat is de retourtermijn in dagen van de webshop "${merchantName}"?` }],
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 2 }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const match = text.match(/\{[\s\S]*?\}/);
  if (!match) return { days: null, sourceUrl: null };

  try {
    const parsed = JSON.parse(match[0]) as { days?: unknown; source?: unknown };
    const days = typeof parsed.days === "number" && parsed.days >= 7 && parsed.days <= 120 ? Math.round(parsed.days) : null;
    const sourceUrl = typeof parsed.source === "string" && /^https?:\/\//.test(parsed.source) ? parsed.source : null;
    return { days, sourceUrl };
  } catch {
    return { days: null, sourceUrl: null };
  }
}
