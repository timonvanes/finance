import Anthropic from "@anthropic-ai/sdk";

export interface ReturnPolicyLookup {
  days: number | null;
  sourceUrl: string | null;
}

// The Dutch return window can differ from other countries' (ASOS gives 28
// days on its US/UK pages, 14 to start a return in NL), so only trust pages
// that are clearly the Dutch site.
function isDutchSource(url: string | null) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.hostname.endsWith(".nl") || /(^|[.-])nl([.-]|$)/i.test(u.hostname) ||/(^|\/)nl(-nl)?(\/|$)/i.test(u.pathname) || /nl[_-]NL/i.test(u.search);
  } catch {
    return false;
  }
}

// One small web search per shop: how many days do customers get to return an
// order? Kept deliberately cheap (Haiku, at most two searches, short answer).
export async function lookupReturnWindow(merchantName: string): Promise<ReturnPolicyLookup> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 600,
    system:
      "Je zoekt de retourtermijn van een Nederlandse webshop voor klanten in Nederland. Zoek specifiek naar de pagina over " +
      "retourneren, klantenservice of algemene voorwaarden van de Nederlandse site van de webshop (.nl of /nl/) — NIET een " +
      "productpagina en NIET de site voor een ander land (zoals /us/, /uk/ of .com zonder /nl/). " +
      "Bestaat de regeling uit twee stappen (eerst een retour aanmelden binnen X dagen, daarna nog Y dagen om te versturen), " +
      "geef dan de EERSTE termijn X: dat is de uiterste dag om te beginnen. " +
      "Antwoord uitsluitend met JSON in dit formaat en verder niets: " +
      '{"days": <aantal dagen als geheel getal of null>, "source": "<url van de Nederlandse retour/voorwaarden-pagina, of null>"}. ' +
      "Geef null voor beide als je de termijn niet zeker op zo'n pagina vindt, of als je alleen een productpagina of een pagina " +
      "voor een ander land vond. Verzin niets.",
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
    const sourceUrl = typeof parsed.source === "string" && /^https?:\/\//.test(parsed.source) ? parsed.source : null;
    // Reject anything that isn't plausibly a returns/terms/FAQ page — a
    // product page happening to mention a number is not a policy source.
    const looksLikePolicyPage = sourceUrl ? /retour|return|voorwaarden|terms|klantenservice|faq|service|help/i.test(sourceUrl) : false;
    const days =
      looksLikePolicyPage &&
      isDutchSource(sourceUrl) && typeof parsed.days === "number" && parsed.days >= 7 && parsed.days <= 120
        ? Math.round(parsed.days)
        : null;
    return { days, sourceUrl: days ? sourceUrl : null };
  } catch {
    return { days: null, sourceUrl: null };
  }
}
