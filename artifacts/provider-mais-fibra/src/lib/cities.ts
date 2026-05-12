export type City = {
  slug: string;
  name: string;
  description: string;
  highlight: boolean;
  badge: string | null;
  planos: string;
  whatsapp: string;
  maps: string;
};

export const cities: City[] = [
  {
    slug: "barreiras",
    name: "Barreiras",
    description: "Sede regional e maior cobertura da rede Provider Mais Fibra.",
    highlight: true,
    badge: "Sede Regional",
    planos: "100M • 300M • 600M • 900M",
    whatsapp: "5577998444757",
    maps: "https://maps.google.com/?q=Barreiras,BA",
  },
  {
    slug: "luis-eduardo-magalhaes",
    name: "Luís Eduardo Magalhães",
    description: "Cobertura completa para o maior polo agro do Oeste da Bahia.",
    highlight: false,
    badge: null,
    planos: "100M • 300M • 600M • 900M",
    whatsapp: "5577998444757",
    maps: "https://maps.google.com/?q=Luis+Eduardo+Magalhaes,BA",
  },
  {
    slug: "angical",
    name: "Angical",
    description: "Internet rápida e confiável para residências e empresas locais.",
    highlight: false,
    badge: null,
    planos: "100M • 300M • 600M",
    whatsapp: "5577998444757",
    maps: "https://maps.google.com/?q=Angical,BA",
  },
  {
    slug: "baianopolis",
    name: "Baianópolis",
    description: "Fibra óptica chegou até você com velocidade e estabilidade.",
    highlight: false,
    badge: null,
    planos: "100M • 300M • 600M",
    whatsapp: "5577998444757",
    maps: "https://maps.google.com/?q=Baianopolis,BA",
  },
  {
    slug: "cristopolis",
    name: "Cristópolis",
    description: "Conectividade de alta qualidade para o interior do Oeste baiano.",
    highlight: false,
    badge: null,
    planos: "100M • 300M",
    whatsapp: "5577998444757",
    maps: "https://maps.google.com/?q=Cristopolis,BA",
  },
  {
    slug: "sao-desiderio",
    name: "São Desidério",
    description: "Um dos maiores municípios em área do Brasil, totalmente conectado.",
    highlight: false,
    badge: null,
    planos: "100M • 300M • 600M",
    whatsapp: "5577998444757",
    maps: "https://maps.google.com/?q=Sao+Desiderio,BA",
  },
  {
    slug: "jaborandi",
    name: "Jaborandi",
    description: "Internet fibra para famílias e agronegócio da região.",
    highlight: false,
    badge: null,
    planos: "100M • 300M",
    whatsapp: "5577998444757",
    maps: "https://maps.google.com/?q=Jaborandi,BA",
  },
  {
    slug: "cotegipe",
    name: "Cotegipe",
    description: "Fibra óptica de qualidade no coração do Oeste baiano.",
    highlight: false,
    badge: null,
    planos: "100M • 300M • 600M",
    whatsapp: "5577998444757",
    maps: "https://maps.google.com/?q=Cotegipe,BA",
  },
  {
    slug: "wanderley",
    name: "Wanderley",
    description: "Conexão estável e veloz para residências e comércios locais.",
    highlight: false,
    badge: null,
    planos: "100M • 300M",
    whatsapp: "5577998444757",
    maps: "https://maps.google.com/?q=Wanderley,BA",
  },
  {
    slug: "bom-jesus-da-lapa",
    name: "Bom Jesus da Lapa",
    description: "Internet de qualidade para a cidade santuário do Oeste baiano.",
    highlight: false,
    badge: null,
    planos: "100M • 300M • 600M",
    whatsapp: "5577998444757",
    maps: "https://maps.google.com/?q=Bom+Jesus+da+Lapa,BA",
  },
  {
    slug: "santa-maria-da-vitoria",
    name: "Santa Maria da Vitória",
    description: "Cobertura em fibra óptica para toda a cidade e região.",
    highlight: false,
    badge: null,
    planos: "100M • 300M • 600M",
    whatsapp: "5577998444757",
    maps: "https://maps.google.com/?q=Santa+Maria+da+Vitoria,BA",
  },
  {
    slug: "correntina",
    name: "Correntina",
    description: "Conectando famílias e empresas às margens do Rio Corrente.",
    highlight: false,
    badge: null,
    planos: "100M • 300M • 600M",
    whatsapp: "5577998444757",
    maps: "https://maps.google.com/?q=Correntina,BA",
  },
];

export function getCityBySlug(slug: string): City | undefined {
  return cities.find((c) => c.slug === slug);
}
