export type Plan = {
  speed: string;
  wifi: string;
  price: string;
  inclusions: string[];
  featured: boolean;
  badge?: string;
  bonus?: string;
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
    inclusions: ["Instalação Grátis", "Roteador Wi-Fi 6", "100 Canais"],
    featured: true,
    badge: "Mais Vendido",
    bonus: "Assinatura Inclusa — Watch",
  },
  {
    speed: "900",
    wifi: "Wi-Fi 6 incluso",
    price: "149,90",
    inclusions: ["Instalação Grátis", "Roteador Wi-Fi 6", "100 Canais"],
    featured: false,
    bonus: "Assinatura Inclusa — Watch + Power Top",
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
  "100 Canais",
  "Watch",
  "Power Top",
];
