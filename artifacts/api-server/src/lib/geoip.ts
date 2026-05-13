import crypto from "node:crypto";
import geoip from "geoip-lite";

// Maps ISO 3166-1 alpha-2 codes to a friendly Portuguese country name for the
// admin UI. Falls back to the raw code if a translation is missing.
const COUNTRY_NAMES_PT: Record<string, string> = {
  BR: "Brasil",
  US: "Estados Unidos",
  PT: "Portugal",
  AR: "Argentina",
  CL: "Chile",
  CO: "Colômbia",
  MX: "México",
  PE: "Peru",
  UY: "Uruguai",
  PY: "Paraguai",
  BO: "Bolívia",
  VE: "Venezuela",
  EC: "Equador",
  CA: "Canadá",
  GB: "Reino Unido",
  IE: "Irlanda",
  FR: "França",
  DE: "Alemanha",
  IT: "Itália",
  ES: "Espanha",
  NL: "Países Baixos",
  BE: "Bélgica",
  CH: "Suíça",
  AT: "Áustria",
  SE: "Suécia",
  NO: "Noruega",
  DK: "Dinamarca",
  FI: "Finlândia",
  PL: "Polônia",
  RU: "Rússia",
  UA: "Ucrânia",
  TR: "Turquia",
  CN: "China",
  JP: "Japão",
  KR: "Coreia do Sul",
  IN: "Índia",
  ID: "Indonésia",
  VN: "Vietnã",
  TH: "Tailândia",
  PH: "Filipinas",
  AU: "Austrália",
  NZ: "Nova Zelândia",
  ZA: "África do Sul",
  EG: "Egito",
  MA: "Marrocos",
  NG: "Nigéria",
  KE: "Quênia",
  IL: "Israel",
  AE: "Emirados Árabes Unidos",
  SA: "Arábia Saudita",
};

function ipSalt(): string {
  return process.env["IP_HASH_SALT"] ?? process.env["JWT_SECRET"] ?? "pmf-default-salt";
}

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return crypto.createHash("sha256").update(`${ipSalt()}:${ip}`).digest("hex").slice(0, 32);
}

// Pulls the visitor IP. The Express app sets `trust proxy = 1`, so `req.ip`
// already reflects the leftmost trusted X-Forwarded-For entry. Preferring
// `req.ip` over the raw header avoids accepting spoofed values from clients
// that send their own X-Forwarded-For. Socket address is a final fallback for
// requests that bypass the proxy (e.g. direct local hits).
export function extractClientIp(req: {
  headers: Record<string, string | string[] | undefined>;
  ip?: string | undefined;
  socket?: { remoteAddress?: string | undefined };
}): string | null {
  if (req.ip && req.ip.length > 0) return req.ip;
  return req.socket?.remoteAddress ?? null;
}

export type GeoLookup = {
  countryCode: string | null;
  countryName: string | null;
  region: string | null;
  city: string | null;
};

export function lookupGeo(ip: string | null | undefined): GeoLookup {
  const empty: GeoLookup = { countryCode: null, countryName: null, region: null, city: null };
  if (!ip) return empty;
  // Skip local / private / link-local addresses to avoid noisy "ZZ"-style
  // results. Covers RFC 1918 (10/8, 172.16/12, 192.168/16), loopback,
  // link-local 169.254/16, CGNAT 100.64/10, and IPv6 equivalents (incl.
  // IPv4-mapped ::ffff:* forms).
  const cleaned = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (
    cleaned === "::1" ||
    cleaned === "127.0.0.1" ||
    cleaned.startsWith("127.") ||
    cleaned.startsWith("10.") ||
    cleaned.startsWith("192.168.") ||
    cleaned.startsWith("169.254.") ||
    cleaned.toLowerCase().startsWith("fe80:") ||
    cleaned.toLowerCase().startsWith("fc") ||
    cleaned.toLowerCase().startsWith("fd")
  ) {
    return empty;
  }
  // 172.16.0.0/12 → 172.16.x.x through 172.31.x.x
  if (cleaned.startsWith("172.")) {
    const second = Number.parseInt(cleaned.split(".")[1] ?? "", 10);
    if (Number.isFinite(second) && second >= 16 && second <= 31) {
      return empty;
    }
  }
  // 100.64.0.0/10 (CGNAT) → 100.64.x.x through 100.127.x.x
  if (cleaned.startsWith("100.")) {
    const second = Number.parseInt(cleaned.split(".")[1] ?? "", 10);
    if (Number.isFinite(second) && second >= 64 && second <= 127) {
      return empty;
    }
  }
  try {
    const lookup = geoip.lookup(cleaned);
    if (!lookup) return empty;
    const cc = lookup.country ? lookup.country.toUpperCase() : null;
    return {
      countryCode: cc,
      countryName: cc ? COUNTRY_NAMES_PT[cc] ?? cc : null,
      region: lookup.region || null,
      city: lookup.city || null,
    };
  } catch {
    return empty;
  }
}

export function countryNameFor(code: string | null | undefined): string | null {
  if (!code) return null;
  return COUNTRY_NAMES_PT[code.toUpperCase()] ?? code.toUpperCase();
}
