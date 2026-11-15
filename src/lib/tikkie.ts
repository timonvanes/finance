// Tikkie shows at most 35 characters of the description. A longer text is not taken over,
// so the text is cut to fit, with the reference code (if any) kept at the end.
export const TIKKIE_MAX_DESCRIPTION = 35;

export function tikkieDescription(base: string, referenceCode?: string | null): string {
  const clean = base.replace(/\s+/g, " ").trim();
  const suffix = referenceCode ? ` (${referenceCode})` : "";
  const room = TIKKIE_MAX_DESCRIPTION - suffix.length;
  if (clean.length <= room) return clean + suffix;
  const cut = clean.slice(0, Math.max(room - 1, 0)).trimEnd() + "…";
  return (cut + suffix).slice(0, TIKKIE_MAX_DESCRIPTION);
}
