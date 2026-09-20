const LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ"; // no O/I to avoid confusion
const DIGITS = "23456789"; // no 0/1 to avoid confusion
const ALL = LETTERS + DIGITS;

const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];

// 4 characters, always a mix of letters and digits so it can't accidentally
// read as a word inside a payment description (e.g. "BANK").
export function generateReferenceCode() {
  for (;;) {
    let code = "";
    for (let i = 0; i < 4; i++) code += pick(ALL);
    if (/[2-9]/.test(code) && /[A-Z]/.test(code)) return code;
  }
}

// True when the code appears as its own token in a payment description
// ("… TR-AB12 …" or "… K7M3 …"), not as part of a longer word or number.
export function descriptionHasCode(description: string, code: string): boolean {
  if (!code) return false;
  const escaped = code.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Z0-9])${escaped}([^A-Z0-9]|$)`).test(description.toUpperCase());
}
