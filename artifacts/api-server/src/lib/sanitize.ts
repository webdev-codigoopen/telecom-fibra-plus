// ---------------------------------------------------------------------------
// stripHtml — defense-in-depth sanitizer for free-text admin fields that end
// up rendered into HTML (share pages, og:description, badges, etc).
//
// We use isomorphic-dompurify (DOMPurify + jsdom) configured with no allowed
// tags or attributes — i.e. it strips ALL HTML/SVG/script and returns plain
// text. The frontend already escapes on output; this is the second line of
// defense (and protects server-side rendered pages, og:tags, emails, etc).
//
// jsdom is marked external in build.mjs so its bundled CSS file resolves at
// runtime.
// ---------------------------------------------------------------------------

import DOMPurify from "isomorphic-dompurify";

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [] as string[],
  ALLOWED_ATTR: [] as string[],
  KEEP_CONTENT: true,
} as const;

export function stripHtml(input: string | null | undefined): string {
  if (input == null) return "";
  const cleaned = DOMPurify.sanitize(String(input), PURIFY_CONFIG);
  // DOMPurify returns the text content with HTML stripped; trim whitespace.
  return String(cleaned).trim();
}

// Sanitize a record of free-text fields in place. Returns a new object with
// the same keys; non-string values pass through untouched so partial updates
// keep working.
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
