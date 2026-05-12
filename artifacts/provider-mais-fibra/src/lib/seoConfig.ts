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
