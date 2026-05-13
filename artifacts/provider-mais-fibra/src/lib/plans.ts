export type PlanStreamingBrand = {
  id: number;
  name: string;
  logoUrl: string | null;
  sortOrder: number;
};

export type Plan = {
  id?: number;
  speed: string;
  wifi: string;
  price: string;
  inclusions: string[];
  streamingBrands?: PlanStreamingBrand[];
  featured: boolean;
  badge?: string;
  bonus?: string;
  imageUrl?: string;
};

export const WHATSAPP_NUMBER = "5577998444757";

export const plans: Plan[] = [
  {
    speed: "300",
    wifi: "Wi-Fi incluso",
    price: "69,90",
    inclusions: ["Instalação Grátis", "Roteador Wi-Fi", "100 Canais"],
    featured: false,
  },
  {
    speed: "400",
    wifi: "Wi-Fi incluso",
    price: "79,90",
    inclusions: ["Instalação Grátis", "Roteador Wi-Fi", "100 Canais"],
    featured: false,
  },
  {
    speed: "600",
    wifi: "Wi-Fi 6 incluso",
    price: "99,90",
    inclusions: ["Instalação Grátis", "Roteador Wi-Fi 6", "100 Canais", "Watch"],
    featured: true,
    badge: "Mais Vendido",
    bonus: "Assinatura Inclusa — Watch",
  },
  {
    speed: "900",
    wifi: "Wi-Fi 6 incluso",
    price: "149,90",
    inclusions: ["Instalação Grátis", "Roteador Wi-Fi 6", "100 Canais", "Watch", "Power Top"],
    featured: false,
    bonus: "Assinatura Inclusa — Watch + Power Top",
  },
];

export function buildWhatsAppUrl(plan: Plan, shareUrl?: string): string {
  const base = `Olá! Quero contratar o plano ${plan.speed} MEGA por R$${plan.price}/mês`;
  const message = shareUrl && plan.imageUrl ? `${base}\n${shareUrl}` : base;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

// Normalize a source identifier so the same logical entry point produces the
// same DB key everywhere. Both the in-page click POST (/api/clicks) and the
// link-preview share endpoint (/api/plans/:id/share?source=) must agree on
// the resulting key, otherwise previews and signups end up in separate
// buckets in the admin dashboard. We:
//   - lowercase
//   - strip diacritics (so "Luís" → "luis")
//   - collapse whitespace and unsupported chars into a single dash
//   - keep ":" as a namespace separator (e.g. "city:luis-eduardo-magalhaes")
//   - cap length at 64 (server enforces this too)
export function normalizeSource(source: string | undefined | null): string {
  if (!source) return "";
  const lowered = source.toLowerCase();
  const folded = lowered.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const cleaned = folded
    .replace(/[^a-z0-9:_.\-\s]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");
  return cleaned.slice(0, 64);
}

export function buildPlanShareUrl(
  planId: number,
  cityName?: string,
  source?: string,
): string | undefined {
  if (typeof window === "undefined") return undefined;
  const baseUrl = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  const params = new URLSearchParams();
  if (cityName) params.set("city", cityName);
  const normalized = normalizeSource(source);
  if (normalized) params.set("source", normalized);
  const qs = params.toString();
  return `${window.location.origin}${baseUrl}/api/plans/${planId}/share${qs ? `?${qs}` : ""}`;
}

export const ALL_INCLUSIONS = [
  "Instalação Grátis",
  "Roteador Wi-Fi",
  "Roteador Wi-Fi 6",
  "100 Canais",
  "Watch",
  "Power Top",
];
