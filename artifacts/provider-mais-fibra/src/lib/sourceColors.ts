export const SOURCE_COLORS = [
  "#0040FF",
  "#00C040",
  "#FF8A00",
  "#9333EA",
  "#E11D48",
  "#0EA5E9",
  "#F59E0B",
  "#14B8A6",
  "#7C3AED",
  "#DB2777",
];

export const KNOWN_SOURCE_COLORS: Record<string, string> = {
  hero: "#0040FF",
  sticky: "#00C040",
  whatsapp: "#25D366",
  share: "#9333EA",
  "whatsapp-share": "#9333EA",
  "whatsapp-share-bot": "#A1A6B0",
  city: "#FF8A00",
  cta: "#E11D48",
  footer: "#0EA5E9",
  unknown: "#7A7F8C",
};

export function colorForSource(source: string): string {
  const known = KNOWN_SOURCE_COLORS[source];
  if (known) return known;
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    hash = (hash * 31 + source.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % SOURCE_COLORS.length;
  return SOURCE_COLORS[idx] ?? "#7A7F8C";
}
