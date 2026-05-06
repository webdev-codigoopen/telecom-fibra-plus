export type Plan = {
  speed: string;
  wifi: string;
  price: string;
  inclusions: string[];
  featured: boolean;
  badge?: string;
};

export const WHATSAPP_NUMBER = "5577998444757";

export const plans: Plan[] = [
  {
    speed: "300",
    wifi: "Wi-Fi",
    price: "69,90",
    inclusions: ["Instalação Grátis", "Roteador Wi-Fi", "IPTV"],
    featured: false,
  },
  {
    speed: "400",
    wifi: "Wi-Fi",
    price: "79,90",
    inclusions: ["Instalação Grátis", "Roteador Wi-Fi", "IPTV"],
    featured: false,
  },
  {
    speed: "600",
    wifi: "Wi-Fi 6",
    price: "99,90",
    inclusions: ["Instalação Grátis", "Roteador Wi-Fi 6", "IPTV", "WATCH"],
    featured: true,
    badge: "MAIS VENDIDO",
  },
  {
    speed: "900",
    wifi: "Wi-Fi 6",
    price: "149,90",
    inclusions: ["Instalação Grátis", "Roteador Wi-Fi 6", "IPTV", "WATCH", "Power Top"],
    featured: false,
  },
];

export function buildWhatsAppUrl(plan: Plan): string {
  const message = `Olá! Quero contratar o plano ${plan.speed} MEGA por R$${plan.price}/mês`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export const ALL_INCLUSIONS = [
  "Instalação Grátis",
  "Roteador Wi-Fi",
  "Roteador Wi-Fi 6",
  "IPTV",
  "WATCH",
  "Power Top",
];
