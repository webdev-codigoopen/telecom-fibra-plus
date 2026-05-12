import { WHATSAPP_NUMBER } from "./seoConfig";

export type CitySEO = {
  title: string;
  description: string;
  intro: string;
  keywords: string[];
  highlights: string[];
};

export type City = {
  slug: string;
  name: string;
  description: string;
  highlight: boolean;
  badge: string | null;
  planos: string;
  whatsapp: string;
  maps: string;
  region: string;
  microregion: string;
  state: string;
  stateCode: string;
  seo: CitySEO;
};

const DEFAULT_WHATSAPP = WHATSAPP_NUMBER;

function maps(name: string): string {
  return `https://maps.google.com/?q=${encodeURIComponent(`${name},BA`)}`;
}

export const cities: City[] = [
  {
    slug: "barreiras",
    name: "Barreiras",
    description:
      "Sede regional e maior cobertura da rede Provider Mais Fibra.",
    highlight: true,
    badge: "Sede Regional",
    planos: "100M • 300M • 600M • 900M",
    whatsapp: DEFAULT_WHATSAPP,
    maps: maps("Barreiras"),
    region: "Oeste da Bahia",
    microregion: "Barreiras",
    state: "Bahia",
    stateCode: "BA",
    seo: {
      title: "Internet Fibra Óptica em Barreiras BA — Planos a partir de 100M",
      description:
        "Internet de fibra óptica em Barreiras BA com planos de 100, 300, 600 e 900 Mega. Instalação grátis, Wi-Fi 6, IPTV inclusos e suporte local. Assine pelo WhatsApp.",
      intro:
        "A Provider Mais Fibra é o provedor de internet 100% em fibra óptica de Barreiras, sede regional do Oeste da Bahia. Atendemos toda a área urbana — do Centro ao Vila Brasil, Rio Grande, Boa Sorte, Antônio Geraldo, Sandra Regina e demais bairros — com planos residenciais e empresariais, instalação rápida e suporte técnico próximo de você.",
      keywords: [
        "internet fibra Barreiras",
        "internet fibra óptica Barreiras BA",
        "provedor de internet Barreiras",
        "plano de internet Barreiras",
        "internet residencial Barreiras",
        "Wi-Fi 6 Barreiras",
        "IPTV Barreiras",
      ],
      highlights: [
        "Sede regional com a maior cobertura de fibra do Oeste",
        "Planos de 100M, 300M, 600M e 900M",
        "Wi-Fi 6 nos planos 600M e 900M",
        "IPTV com mais de 100 canais inclusos",
        "Suporte técnico local em Barreiras",
      ],
    },
  },
  {
    slug: "luis-eduardo-magalhaes",
    name: "Luís Eduardo Magalhães",
    description:
      "Cobertura completa para o maior polo agro do Oeste da Bahia.",
    highlight: false,
    badge: null,
    planos: "100M • 300M • 600M • 900M",
    whatsapp: DEFAULT_WHATSAPP,
    maps: maps("Luis Eduardo Magalhaes"),
    region: "Oeste da Bahia",
    microregion: "Barreiras",
    state: "Bahia",
    stateCode: "BA",
    seo: {
      title:
        "Internet Fibra em Luís Eduardo Magalhães BA — 100M a 900M",
      description:
        "Provedor de internet fibra óptica em Luís Eduardo Magalhães (LEM). Planos de 100M, 300M, 600M e 900M para residências, fazendas e empresas do agro. Assine pelo WhatsApp.",
      intro:
        "Em Luís Eduardo Magalhães, o maior polo do agronegócio do Oeste baiano, a Provider Mais Fibra entrega internet 100% fibra óptica para residências, escritórios, lojas e propriedades rurais próximas da malha urbana. Planos com Wi-Fi 6, IPTV e upload simétrico para quem precisa de estabilidade real para home office, ERP, monitoramento e streaming.",
      keywords: [
        "internet fibra Luís Eduardo Magalhães",
        "internet LEM",
        "provedor de internet LEM",
        "internet fibra LEM Bahia",
        "internet empresarial Luís Eduardo Magalhães",
      ],
      highlights: [
        "Cobertura no maior polo agro do Oeste da Bahia",
        "Planos para residências, escritórios e empresas",
        "Wi-Fi 6 nos planos 600M e 900M",
        "Upload simétrico ideal para home office",
        "Suporte humano via WhatsApp",
      ],
    },
  },
  {
    slug: "angical",
    name: "Angical",
    description:
      "Internet rápida e confiável para residências e empresas locais.",
    highlight: false,
    badge: null,
    planos: "100M • 300M • 600M",
    whatsapp: DEFAULT_WHATSAPP,
    maps: maps("Angical"),
    region: "Oeste da Bahia",
    microregion: "Barreiras",
    state: "Bahia",
    stateCode: "BA",
    seo: {
      title: "Internet Fibra Óptica em Angical BA — Planos 100M, 300M e 600M",
      description:
        "Internet fibra óptica em Angical, Bahia. Planos residenciais a partir de 100 Mega com instalação rápida, IPTV opcional e suporte local pelo WhatsApp. Veja a cobertura.",
      intro:
        "Em Angical, a Provider Mais Fibra leva internet de fibra óptica para residências, comércios e pequenas empresas com a mesma qualidade do nosso backbone regional. Planos de 100M, 300M e 600M, com roteador moderno, atendimento humano e visita técnica rápida quando você precisa.",
      keywords: [
        "internet fibra Angical",
        "internet fibra Angical BA",
        "provedor de internet Angical",
        "plano de internet Angical Bahia",
      ],
      highlights: [
        "Cobertura ativa em Angical",
        "Planos de 100M, 300M e 600M",
        "Roteador moderno incluso",
        "Atendimento local pelo WhatsApp",
      ],
    },
  },
  {
    slug: "baianopolis",
    name: "Baianópolis",
    description:
      "Fibra óptica chegou até você com velocidade e estabilidade.",
    highlight: false,
    badge: null,
    planos: "100M • 300M • 600M",
    whatsapp: DEFAULT_WHATSAPP,
    maps: maps("Baianopolis"),
    region: "Oeste da Bahia",
    microregion: "Barreiras",
    state: "Bahia",
    stateCode: "BA",
    seo: {
      title:
        "Internet Fibra em Baianópolis BA — Planos a partir de 100 Mega",
      description:
        "Internet fibra óptica em Baianópolis, Bahia. Planos residenciais e comerciais de 100M, 300M e 600M com instalação grátis e suporte humano via WhatsApp.",
      intro:
        "A Provider Mais Fibra trouxe a fibra óptica para Baianópolis com planos pensados para o dia a dia da família e do pequeno comércio. Velocidade real, estabilidade no streaming e atendimento próximo, sem call center robotizado.",
      keywords: [
        "internet fibra Baianópolis",
        "internet Baianópolis BA",
        "provedor de internet Baianópolis",
      ],
      highlights: [
        "Fibra óptica disponível em Baianópolis",
        "Planos de 100M, 300M e 600M",
        "Instalação grátis nos planos elegíveis",
        "Atendimento humano via WhatsApp",
      ],
    },
  },
  {
    slug: "cristopolis",
    name: "Cristópolis",
    description:
      "Conectividade de alta qualidade para o interior do Oeste baiano.",
    highlight: false,
    badge: null,
    planos: "100M • 300M",
    whatsapp: DEFAULT_WHATSAPP,
    maps: maps("Cristopolis"),
    region: "Oeste da Bahia",
    microregion: "Barreiras",
    state: "Bahia",
    stateCode: "BA",
    seo: {
      title: "Internet Fibra Óptica em Cristópolis BA — 100M e 300M",
      description:
        "Internet fibra em Cristópolis, Bahia. Planos de 100 e 300 Mega para residências, com Wi-Fi de qualidade e suporte local. Consulte a disponibilidade no WhatsApp.",
      intro:
        "Em Cristópolis, a Provider Mais Fibra oferece planos residenciais de 100M e 300M em fibra óptica, ideais para quem quer estabilidade no streaming, jogos e chamadas de vídeo, sem limite de franquia e com atendimento de quem é da região.",
      keywords: [
        "internet fibra Cristópolis",
        "internet Cristópolis BA",
        "provedor de internet Cristópolis",
      ],
      highlights: [
        "Cobertura ativa em Cristópolis",
        "Planos de 100M e 300M",
        "Sem limite de franquia",
        "Atendimento via WhatsApp",
      ],
    },
  },
  {
    slug: "sao-desiderio",
    name: "São Desidério",
    description:
      "Um dos maiores municípios em área do Brasil, totalmente conectado.",
    highlight: false,
    badge: null,
    planos: "100M • 300M • 600M",
    whatsapp: DEFAULT_WHATSAPP,
    maps: maps("Sao Desiderio"),
    region: "Oeste da Bahia",
    microregion: "Barreiras",
    state: "Bahia",
    stateCode: "BA",
    seo: {
      title:
        "Internet Fibra em São Desidério BA — Planos de 100M, 300M e 600M",
      description:
        "Internet fibra óptica em São Desidério, Bahia. Planos residenciais e empresariais com Wi-Fi moderno, IPTV opcional e suporte local pelo WhatsApp.",
      intro:
        "São Desidério é um dos maiores municípios em área do país, e a Provider Mais Fibra atende sua malha urbana com planos de fibra óptica de 100M a 600M. Oferecemos roteador moderno, instalação rápida e atendimento próximo de quem mora na região.",
      keywords: [
        "internet fibra São Desidério",
        "internet São Desidério BA",
        "provedor de internet São Desidério",
      ],
      highlights: [
        "Cobertura ativa em São Desidério",
        "Planos de 100M, 300M e 600M",
        "IPTV opcional com mais de 100 canais",
        "Suporte humano via WhatsApp",
      ],
    },
  },
  {
    slug: "jaborandi",
    name: "Jaborandi",
    description:
      "Internet fibra para famílias e agronegócio da região.",
    highlight: false,
    badge: null,
    planos: "100M • 300M",
    whatsapp: DEFAULT_WHATSAPP,
    maps: maps("Jaborandi"),
    region: "Oeste da Bahia",
    microregion: "Barreiras",
    state: "Bahia",
    stateCode: "BA",
    seo: {
      title: "Internet Fibra Óptica em Jaborandi BA — Planos 100M e 300M",
      description:
        "Internet fibra em Jaborandi, Bahia. Planos residenciais e para o agronegócio próximo da malha urbana, com Wi-Fi moderno e suporte local pelo WhatsApp.",
      intro:
        "Em Jaborandi, a Provider Mais Fibra entrega internet fibra óptica com estabilidade para famílias e para o agronegócio próximo da área urbana. Planos de 100M e 300M, sem franquia e com atendimento humano.",
      keywords: [
        "internet fibra Jaborandi",
        "internet Jaborandi BA",
        "provedor de internet Jaborandi",
      ],
      highlights: [
        "Cobertura ativa em Jaborandi",
        "Planos de 100M e 300M",
        "Sem limite de franquia",
        "Atendimento via WhatsApp",
      ],
    },
  },
  {
    slug: "cotegipe",
    name: "Cotegipe",
    description:
      "Fibra óptica de qualidade no coração do Oeste baiano.",
    highlight: false,
    badge: null,
    planos: "100M • 300M • 600M",
    whatsapp: DEFAULT_WHATSAPP,
    maps: maps("Cotegipe"),
    region: "Oeste da Bahia",
    microregion: "Barreiras",
    state: "Bahia",
    stateCode: "BA",
    seo: {
      title:
        "Internet Fibra em Cotegipe BA — Planos de 100M, 300M e 600M",
      description:
        "Internet fibra óptica em Cotegipe, Bahia. Planos residenciais e comerciais a partir de 100 Mega, com instalação rápida e suporte humano via WhatsApp.",
      intro:
        "A Provider Mais Fibra atende Cotegipe com planos de fibra óptica de 100M, 300M e 600M para residências e pequenos comércios. Roteador moderno, atendimento próximo e visita técnica quando você precisar.",
      keywords: [
        "internet fibra Cotegipe",
        "internet Cotegipe BA",
        "provedor de internet Cotegipe",
      ],
      highlights: [
        "Cobertura ativa em Cotegipe",
        "Planos de 100M, 300M e 600M",
        "Roteador moderno incluso",
        "Atendimento via WhatsApp",
      ],
    },
  },
  {
    slug: "wanderley",
    name: "Wanderley",
    description:
      "Conexão estável e veloz para residências e comércios locais.",
    highlight: false,
    badge: null,
    planos: "100M • 300M",
    whatsapp: DEFAULT_WHATSAPP,
    maps: maps("Wanderley"),
    region: "Oeste da Bahia",
    microregion: "Barreiras",
    state: "Bahia",
    stateCode: "BA",
    seo: {
      title: "Internet Fibra Óptica em Wanderley BA — Planos 100M e 300M",
      description:
        "Internet fibra em Wanderley, Bahia. Planos residenciais a partir de 100 Mega com Wi-Fi moderno, sem franquia e suporte humano pelo WhatsApp.",
      intro:
        "Em Wanderley, a Provider Mais Fibra leva internet fibra óptica para residências e comércios locais com planos de 100M e 300M, atendimento humano e visita técnica rápida.",
      keywords: [
        "internet fibra Wanderley",
        "internet Wanderley BA",
        "provedor de internet Wanderley",
      ],
      highlights: [
        "Cobertura ativa em Wanderley",
        "Planos de 100M e 300M",
        "Sem limite de franquia",
        "Suporte via WhatsApp",
      ],
    },
  },
  {
    slug: "bom-jesus-da-lapa",
    name: "Bom Jesus da Lapa",
    description:
      "Internet de qualidade para a cidade santuário do Oeste baiano.",
    highlight: false,
    badge: null,
    planos: "100M • 300M • 600M",
    whatsapp: DEFAULT_WHATSAPP,
    maps: maps("Bom Jesus da Lapa"),
    region: "Médio São Francisco",
    microregion: "Bom Jesus da Lapa",
    state: "Bahia",
    stateCode: "BA",
    seo: {
      title:
        "Internet Fibra em Bom Jesus da Lapa BA — Planos 100M a 600M",
      description:
        "Internet fibra óptica em Bom Jesus da Lapa, Bahia. Planos residenciais e comerciais com Wi-Fi moderno, IPTV opcional e suporte local pelo WhatsApp.",
      intro:
        "Bom Jesus da Lapa, conhecida pelo seu santuário às margens do Rio São Francisco, agora conta com internet 100% fibra óptica da Provider Mais Fibra. Planos de 100M, 300M e 600M para residências, comércios, pousadas e pequenos hotéis.",
      keywords: [
        "internet fibra Bom Jesus da Lapa",
        "internet Bom Jesus da Lapa BA",
        "provedor de internet Bom Jesus da Lapa",
      ],
      highlights: [
        "Cobertura ativa em Bom Jesus da Lapa",
        "Planos de 100M, 300M e 600M",
        "Ideal para pousadas e comércios",
        "Atendimento humano via WhatsApp",
      ],
    },
  },
  {
    slug: "santa-maria-da-vitoria",
    name: "Santa Maria da Vitória",
    description:
      "Cobertura em fibra óptica para toda a cidade e região.",
    highlight: false,
    badge: null,
    planos: "100M • 300M • 600M",
    whatsapp: DEFAULT_WHATSAPP,
    maps: maps("Santa Maria da Vitoria"),
    region: "Médio São Francisco",
    microregion: "Santa Maria da Vitória",
    state: "Bahia",
    stateCode: "BA",
    seo: {
      title:
        "Internet Fibra em Santa Maria da Vitória BA — 100M, 300M e 600M",
      description:
        "Internet fibra óptica em Santa Maria da Vitória, Bahia. Planos residenciais e empresariais com Wi-Fi moderno e suporte humano pelo WhatsApp.",
      intro:
        "A Provider Mais Fibra cobre toda a malha urbana de Santa Maria da Vitória, no Vale do Rio Corrente, com planos de fibra óptica de 100M, 300M e 600M para famílias, comércios e pequenas empresas.",
      keywords: [
        "internet fibra Santa Maria da Vitória",
        "internet Santa Maria da Vitória BA",
        "provedor de internet Santa Maria da Vitória",
      ],
      highlights: [
        "Cobertura ativa em Santa Maria da Vitória",
        "Planos de 100M, 300M e 600M",
        "Vale do Rio Corrente",
        "Atendimento via WhatsApp",
      ],
    },
  },
  {
    slug: "correntina",
    name: "Correntina",
    description:
      "Conectando famílias e empresas às margens do Rio Corrente.",
    highlight: false,
    badge: null,
    planos: "100M • 300M • 600M",
    whatsapp: DEFAULT_WHATSAPP,
    maps: maps("Correntina"),
    region: "Médio São Francisco",
    microregion: "Santa Maria da Vitória",
    state: "Bahia",
    stateCode: "BA",
    seo: {
      title:
        "Internet Fibra Óptica em Correntina BA — Planos 100M, 300M e 600M",
      description:
        "Internet fibra em Correntina, Bahia. Planos residenciais e comerciais às margens do Rio Corrente, com Wi-Fi moderno e suporte humano pelo WhatsApp.",
      intro:
        "Em Correntina, às margens do Rio Corrente, a Provider Mais Fibra entrega internet fibra óptica com planos de 100M, 300M e 600M, ideais para residências, comércios e pequenas empresas do agronegócio próximo da cidade.",
      keywords: [
        "internet fibra Correntina",
        "internet Correntina BA",
        "provedor de internet Correntina",
      ],
      highlights: [
        "Cobertura ativa em Correntina",
        "Planos de 100M, 300M e 600M",
        "Atende residências e comércios",
        "Suporte humano via WhatsApp",
      ],
    },
  },
];

export function getCityBySlug(slug: string): City | undefined {
  return cities.find((c) => c.slug === slug);
}
