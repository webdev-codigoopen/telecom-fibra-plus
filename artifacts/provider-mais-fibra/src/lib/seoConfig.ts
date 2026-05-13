export const SITE_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as { env?: Record<string, string | undefined> }).env
      ?.VITE_SITE_URL) ||
  "https://www.providermaisfibra.com.br";

export const SITE_NAME = "Provider Mais Fibra";
export const BRAND = "Provider Mais Fibra";
export const REGION = "Oeste da Bahia";
export const STATE_NAME = "Bahia";
export const STATE_CODE = "BA";
export const COUNTRY = "BR";
export const LOCALE = "pt_BR";
export const PHONE_E164 = "+5577998444757";
export const PHONE_DISPLAY = "(77) 99844-4757";
export const WHATSAPP_NUMBER = "5577998444757";

export const DEFAULT_OG_IMAGE = "/opengraph.jpg";

export const ORGANIZATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "TelecommunicationsProvider",
  name: SITE_NAME,
  alternateName: "Provider Fibra",
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.svg`,
  image: `${SITE_URL}${DEFAULT_OG_IMAGE}`,
  description:
    "Provedor de internet 100% fibra óptica para o Oeste da Bahia, com planos residenciais e empresariais de alta velocidade, IPTV e suporte humano.",
  areaServed: {
    "@type": "AdministrativeArea",
    name: "Oeste da Bahia",
  },
  address: {
    "@type": "PostalAddress",
    streetAddress: "Edifício São Matheus, térreo nº 49 — Rua José Rocha, Centro",
    addressLocality: "Barreiras",
    addressRegion: STATE_CODE,
    postalCode: "47800-184",
    addressCountry: COUNTRY,
  },
  telephone: PHONE_E164,
  contactPoint: [
    {
      "@type": "ContactPoint",
      telephone: PHONE_E164,
      contactType: "customer service",
      areaServed: COUNTRY,
      availableLanguage: ["Portuguese"],
    },
  ],
  sameAs: ["https://instagram.com/provider.fibra"],
};

export const WEBSITE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  inLanguage: "pt-BR",
  publisher: { "@type": "Organization", name: SITE_NAME },
};

// ---------------------------------------------------------------------------
// FAQ schema (rendered on Home — espelha o conteúdo da seção "Tire suas Dúvidas")
// ---------------------------------------------------------------------------

const FAQ_QA: { q: string; a: string }[] = [
  {
    q: "Quais cidades a Provider Mais Fibra atende?",
    a: "Atendemos 12 cidades do Oeste da Bahia: Barreiras, Luís Eduardo Magalhães, Correntina, Wanderley, Santa Rita de Cássia, Barra, Buritirama, Mansidão, Múquem de São Francisco, Posto Rosário, Roda Velha e Javi.",
  },
  {
    q: "Qual o plano de internet mais barato da Provider Mais Fibra?",
    a: "O plano mais acessível é o de 300 Mega por R$ 69,90/mês, com instalação grátis, roteador Wi-Fi e IPTV inclusos.",
  },
  {
    q: "A instalação é gratuita?",
    a: "Sim. A instalação e o roteador Wi-Fi já estão inclusos em todos os planos de internet fibra óptica da Provider Mais Fibra, sem custo adicional.",
  },
  {
    q: "A Provider Mais Fibra oferece IPTV?",
    a: "Sim. O IPTV está incluso em todos os planos. Os planos 600M e 900M ainda recebem benefícios extras como Watch e o combo Power Top.",
  },
  {
    q: "A Provider Mais Fibra é homologada pela Anatel?",
    a: "Sim. A Provider Mais Fibra é um provedor 100% nacional, devidamente homologado pela Anatel (CNPJ 28.632.900/0001-70).",
  },
  {
    q: "Como entrar em contato com a Provider Mais Fibra?",
    a: "Pelo WhatsApp (77) 99844-4757, pelo Instagram @provider.fibra ou indo até a unidade mais próxima da sua cidade. O suporte técnico é 24h via WhatsApp.",
  },
  {
    q: "Quanto tempo leva para instalar a internet?",
    a: "Após a confirmação do plano, a instalação é realizada em até 48 horas úteis na maioria das cidades atendidas no Oeste da Bahia.",
  },
];

export const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_QA.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

// ---------------------------------------------------------------------------
// Catálogo de planos (Offer/Service) — reforça intenção comercial na Home
// ---------------------------------------------------------------------------

const PLANOS = [
  { speed: "300 Mega", price: 69.9, desc: "Internet fibra óptica 300 Mega com instalação grátis, roteador Wi-Fi e IPTV inclusos." },
  { speed: "400 Mega", price: 79.9, desc: "Internet fibra óptica 400 Mega com instalação grátis, roteador Wi-Fi e IPTV inclusos." },
  { speed: "600 Mega", price: 99.9, desc: "Internet fibra óptica 600 Mega com Wi-Fi 6, IPTV e Watch inclusos." },
  { speed: "900 Mega", price: 149.9, desc: "Internet fibra óptica 900 Mega com Wi-Fi 6, IPTV, Watch e combo Power Top." },
];

export const OFFER_CATALOG_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "OfferCatalog",
  name: "Planos de Internet Fibra Óptica — Provider Mais Fibra",
  url: `${SITE_URL}/#planos`,
  itemListElement: PLANOS.map((p, i) => ({
    "@type": "Offer",
    position: i + 1,
    name: `Plano ${p.speed} — Provider Mais Fibra`,
    description: p.desc,
    price: p.price.toFixed(2),
    priceCurrency: "BRL",
    availability: "https://schema.org/InStock",
    areaServed: { "@type": "AdministrativeArea", name: "Oeste da Bahia" },
    seller: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  })),
};

// ---------------------------------------------------------------------------
// LocalBusiness por unidade (gerado a partir de src/lib/cities.ts)
// ---------------------------------------------------------------------------

type UnidadeInput = {
  slug: string;
  name: string;
  address: string;
  stateCode: string;
  phones: string[];
};

export function buildLocalBusinessSchemas(unidades: UnidadeInput[]) {
  return unidades.map((u) => {
    const tel = u.phones[0]?.replace(/\D/g, "") ?? "";
    const telE164 = tel ? `+55${tel}` : PHONE_E164;
    return {
      "@context": "https://schema.org",
      "@type": "TelecommunicationsProvider",
      "@id": `${SITE_URL}/onde-estamos#${u.slug}`,
      name: `Provider Mais Fibra — ${u.name}`,
      url: `${SITE_URL}/onde-estamos`,
      image: `${SITE_URL}${DEFAULT_OG_IMAGE}`,
      telephone: telE164,
      priceRange: "R$ 69,90 – R$ 149,90",
      description: `Provedor de internet fibra óptica em ${u.name}, BA. Planos a partir de R$ 69,90 com instalação grátis, roteador Wi-Fi e IPTV inclusos.`,
      address: {
        "@type": "PostalAddress",
        streetAddress: u.address,
        addressLocality: u.name,
        addressRegion: u.stateCode,
        addressCountry: COUNTRY,
      },
      areaServed: { "@type": "City", name: u.name },
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          opens: "08:00",
          closes: "18:00",
        },
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Saturday"],
          opens: "08:00",
          closes: "12:00",
        },
      ],
      contactPoint: {
        "@type": "ContactPoint",
        telephone: telE164,
        contactType: "customer support",
        areaServed: "BR",
        availableLanguage: ["Portuguese"],
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Breadcrumb helper
// ---------------------------------------------------------------------------

export function buildBreadcrumbSchema(
  items: { name: string; path: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.path === "/" ? "/" : it.path}`,
    })),
  };
}
