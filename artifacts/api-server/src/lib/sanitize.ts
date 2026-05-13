// ---------------------------------------------------------------------------
// stripHtml — defense-in-depth sanitizer for free-text admin fields that end
// up rendered into HTML (share pages, og:description, badges, etc).
//
// Strategy: aggressively strip every HTML/SVG/script construct we can think
// of, then decode the most common HTML entities back to plain characters.
// We do NOT try to support any safe-tag allow-list — these fields are short
// admin strings that should be plain text. The site already escapes on
// output; this is the second line of defense.
//
// We avoid DOMPurify here because it pulls in jsdom (and a bundled CSS
// file) that does not survive the esbuild server build.
// ---------------------------------------------------------------------------

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#x27;": "'",
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#x27|#39);/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const code = parseInt(h, 16);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : "";
    });
}

export function stripHtml(input: string | null | undefined): string {
  if (input == null) return "";
  let s = String(input);
  // Drop entire <script>...</script>, <style>...</style>, comments, CDATA.
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "");
  s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "");
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
  // Strip any remaining tags (including malformed / unclosed ones).
  s = s.replace(/<\/?[a-zA-Z][^>]*>?/g, "");
  // Strip stray angle brackets that did not match a tag.
  s = s.replace(/[<>]/g, "");
  // Decode common HTML entities so the stored text is plain UTF-8.
  s = decodeEntities(s);
  return s.trim();
}

// Sanitize a record of free-text fields in place. Returns a new object with
// the same keys; `null`/`undefined` values pass through untouched so partial
// updates keep working.
export function stripHtmlFields<T extends Record<string, unknown>>(
  obj: T,
  keys: ReadonlyArray<keyof T>,
): T {
  const out: Record<string, unknown> = { ...obj };
  for (const k of keys) {
    const v = out[k as string];
    if (typeof v === "string") out[k as string] = stripHtml(v);
  }
  return out as T;
}
