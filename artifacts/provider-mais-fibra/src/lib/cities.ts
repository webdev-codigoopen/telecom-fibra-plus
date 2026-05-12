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
  phones: string[];
  address: string;
  seo: CitySEO;
};

const DEFAULT_WHATSAPP = WHATSAPP_NUMBER;

function maps(query: string): string {
  return `https://maps.google.com/?q=${encodeURIComponent(`${query},BA`)}`;
}

export function phoneToTel(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11 ? `+55${digits}` : `+${digits}`;
}

const COMMON_HIGHLIGHTS = [
  "Internet 100% fibra óptica",
  "Roteador Wi-Fi moderno incluso",
  "Sem limite de franquia",
  "Atendimento humano via WhatsApp",
];

export const cities: City[] = [
  {
    slug: "barreiras",
    name: "Barreiras",
    description: "Sede regional e maior cobertura da rede Provider Mais Fibra.",
    highlight: true,
    badge: "Sede Regional",
    planos: "100M • 300M • 600M • 900M",
    whatsapp: DEFAULT_WHATSAPP,
    maps: maps("Barreiras"),
    region: "Oeste da Bahia",
    microregion: "Barreiras",
    state: "Bahia",
    stateCode: "BA",
    phones: [
      "(77) 3614-0950",
      "(77) 99844-4757",
      "(77) 99176-0033",
      "(77) 3612-8647",
    ],
    address:
      "Edifício São Matheus, térreo nº 49 — Rua José Rocha, Centro, Barreiras/BA, 47800-184",
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
    description: "Cobertura completa para o maior polo agro do Oeste da Bahia.",
    highlight: false,
    badge: null,
    planos: "100M • 300M • 600M • 900M",
    whatsapp: DEFAULT_WHATSAPP,
    maps: maps("Luis Eduardo Magalhaes"),
    region: "Oeste da Bahia",
    microregion: "Barreiras",
    state: "Bahia",
    stateCode: "BA",
    phones: ["(77) 99101-0334", "(77) 99851-2002"],
    address: "Rua Pará, 471 — Loja 1, Centro, Luís Eduardo Magalhães/BA",
    seo: {
      title: "Internet Fibra em Luís Eduardo Magalhães BA — 100M a 900M",
      description:
        "Provedor de internet fibra óptica em Luís Eduardo Magalhães (LEM). Planos de 100M, 300M, 600M e 900M para residências, fazendas e empresas do agro. Assine pelo WhatsApp.",
      intro:
        "Em Luís Eduardo Magalhães, o maior polo do agronegócio do Oeste baiano, a Provider Mais Fibra entrega internet 100% fibra óptica para residências, escritórios, lojas e propriedades rurais próximas da malha urbana. Planos com Wi-Fi 6, IPTV e estabilidade real para home office, ERP, monitoramento e streaming.",
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
        "Ideal para home office e gestão agro",
        "Suporte humano via WhatsApp",
      ],
    },
  },
  {
    slug: "barra",
    name: "Barra",
    description: "Internet fibra óptica no encontro do Rio Grande com o São Francisco.",
    highlight: false,
    badge: null,
    planos: "100M • 300M • 600M",
    whatsapp: DEFAULT_WHATSAPP,
    maps: maps("Barra"),
    region: "Médio São Francisco",
    microregion: "Barra",
    state: "Bahia",
    stateCode: "BA",
    phones: ["(77) 99977-9868", "(77) 99128-0488"],
    address:
      "Rua Engenheiro Alfredo Halfeld, 13, Centro, Barra/BA, 47100-000",
    seo: {
      title: "Internet Fibra Óptica em Barra BA — Planos 100M a 600M",
      description:
        "Internet 100% fibra óptica em Barra, Bahia. Planos residenciais e comerciais de 100, 300 e 600 Mega com Wi-Fi moderno e suporte humano pelo WhatsApp.",
      intro:
        "Em Barra, no encontro do Rio Grande com o São Francisco, a Provider Mais Fibra entrega internet 100% fibra óptica para famílias, comércios e pousadas. Planos de 100M, 300M e 600M com instalação rápida e atendimento próximo.",
      keywords: [
        "internet fibra Barra",
        "internet fibra Barra BA",
        "provedor de internet Barra Bahia",
        "plano de internet Barra",
      ],
      highlights: [
        "Cobertura ativa em Barra",
        "Planos de 100M, 300M e 600M",
        ...COMMON_HIGHLIGHTS,
      ],
    },
  },
  {
    slug: "buritirama",
    name: "Buritirama",
    description: "Conexão estável de fibra óptica para residências e comércio local.",
    highlight: false,
    badge: null,
    planos: "100M • 300M",
    whatsapp: DEFAULT_WHATSAPP,
    maps: maps("Buritirama"),
    region: "Norte da Bahia",
    microregion: "Barra",
    state: "Bahia",
    stateCode: "BA",
    phones: ["(77) 99827-0368", "(77) 99163-8631"],
    address: "Avenida Buriti, S/N, Centro, Buritirama/BA, 47120-000",
    seo: {
      title: "Internet Fibra Óptica em Buritirama BA — Planos 100M e 300M",
      description:
        "Internet fibra óptica em Buritirama, Bahia. Planos residenciais e comerciais de 100M e 300M com Wi-Fi moderno, sem franquia e suporte local pelo WhatsApp.",
      intro:
        "Em Buritirama, a Provider Mais Fibra leva internet 100% fibra óptica para residências e pequenos comércios da cidade, com planos de 100M e 300M, instalação rápida e atendimento humano via WhatsApp.",
      keywords: [
        "internet fibra Buritirama",
        "internet Buritirama BA",
        "provedor de internet Buritirama",
      ],
      highlights: [
        "Cobertura ativa em Buritirama",
        "Planos de 100M e 300M",
        ...COMMON_HIGHLIGHTS,
      ],
    },
  },
  {
    slug: "correntina",
    name: "Correntina",
    description: "Conectando famílias e empresas às margens do Rio Corrente.",
    highlight: false,
    badge: null,
    planos: "100M • 300M • 600M",
    whatsapp: DEFAULT_WHATSAPP,
    maps: maps("Correntina"),
    region: "Oeste da Bahia",
    microregion: "Santa Maria da Vitória",
    state: "Bahia",
    stateCode: "BA",
    phones: ["(77) 99844-4462", "(77) 98883-4135"],
    address: "Rua da Chácara, S/N, Centro, Correntina/BA, 47650-000",
    seo: {
      title: "Internet Fibra Óptica em Correntina BA — Planos 100M, 300M e 600M",
      description:
        "Internet fibra em Correntina, Bahia. Planos residenciais e comerciais às margens do Rio Corrente, com Wi-Fi moderno e suporte humano pelo WhatsApp.",
      intro:
        "Em Correntina, às margens do Rio Corrente, a Provider Mais Fibra entrega internet fibra óptica com planos de 100M, 300M e 600M, ideais para residências, comércios e pequenas empresas próximas da cidade.",
      keywords: [
        "internet fibra Correntina",
        "internet Correntina BA",
        "provedor de internet Correntina",
        "plano de internet Correntina",
      ],
      highlights: [
        "Cobertura ativa em Correntina",
        "Planos de 100M, 300M e 600M",
        ...COMMON_HIGHLIGHTS,
      ],
    },
  },
  {
    slug: "javi",
    name: "Javi",
    description: "Fibra óptica para Javi, com atendimento da loja em Múquem de São Francisco.",
    highlight: false,
    badge: null,
    planos: "100M • 300M",
    whatsapp: DEFAULT_WHATSAPP,
    maps: maps("Javi Muquem de Sao Francisco"),
    region: "Oeste da Bahia",
    microregion: "Barreiras",
    state: "Bahia",
    stateCode: "BA",
    phones: ["(77) 99187-0332", "(77) 99976-2398"],
    address:
      "Rua José Pessoa Lima, nº 53, Múquem de São Francisco/BA (atende Javi e Múquem)",
    seo: {
      title: "Internet Fibra Óptica em Javi BA — Planos 100M e 300M",
      description:
        "Internet 100% fibra óptica em Javi, Bahia. Planos residenciais a partir de 100 Mega com Wi-Fi moderno, sem franquia e atendimento humano pelo WhatsApp.",
      intro:
        "Em Javi, a Provider Mais Fibra leva a mesma qualidade da fibra óptica das grandes cidades para a comunidade local. Planos de 100M e 300M, sem limite de franquia e com suporte humano de quem é da região.",
      keywords: [
        "internet fibra Javi",
        "internet Javi BA",
        "provedor de internet Javi",
      ],
      highlights: [
        "Cobertura ativa em Javi",
        "Planos de 100M e 300M",
        ...COMMON_HIGHLIGHTS,
      ],
    },
  },
  {
    slug: "mansidao",
    name: "Mansidão",
    description: "Internet fibra para o dia a dia das famílias e do comércio local.",
    highlight: false,
    badge: null,
    planos: "100M • 300M",
    whatsapp: DEFAULT_WHATSAPP,
    maps: maps("Mansidao"),
    region: "Norte da Bahia",
    microregion: "Barra",
    state: "Bahia",
    stateCode: "BA",
    phones: ["(77) 99811-4991"],
    address:
      "Avenida Lidio Francisco de Souza, S/N, Centro, Mansidão/BA, 47160-000",
    seo: {
      title: "Internet Fibra Óptica em Mansidão BA — Planos 100M e 300M",
      description:
        "Internet fibra em Mansidão, Bahia. Planos residenciais e comerciais a partir de 100 Mega com Wi-Fi moderno e suporte humano pelo WhatsApp.",
      intro:
        "Em Mansidão, a Provider Mais Fibra atende famílias e pequenos comércios com internet 100% fibra óptica. Planos de 100M e 300M, instalação rápida e atendimento próximo de quem mora na região.",
      keywords: [
        "internet fibra Mansidão",
        "internet Mansidão BA",
        "provedor de internet Mansidão",
      ],
      highlights: [
        "Cobertura ativa em Mansidão",
        "Planos de 100M e 300M",
        ...COMMON_HIGHLIGHTS,
      ],
    },
  },
  {
    slug: "muquem",
    name: "Múquem de São Francisco",
    description: "Fibra óptica para Múquem de São Francisco e região.",
    highlight: false,
    badge: null,
    planos: "100M • 300M",
    whatsapp: DEFAULT_WHATSAPP,
    maps: maps("Muquem de Sao Francisco"),
    region: "Médio São Francisco",
    microregion: "Bom Jesus da Lapa",
    state: "Bahia",
    stateCode: "BA",
    phones: ["(77) 99187-0332", "(77) 99976-2398"],
    address: "Rua José Pessoa Lima, nº 53, Múquem de São Francisco/BA",
    seo: {
      title: "Internet Fibra Óptica em Múquem de São Francisco BA — 100M e 300M",
      description:
        "Internet 100% fibra óptica em Múquem de São Francisco, Bahia. Planos residenciais a partir de 100 Mega com Wi-Fi moderno, sem franquia e suporte humano pelo WhatsApp.",
      intro:
        "Em Múquem de São Francisco, a Provider Mais Fibra entrega internet fibra óptica de qualidade urbana para residências e pequenos comércios. Planos de 100M e 300M, com atendimento próximo e visita técnica rápida.",
      keywords: [
        "internet fibra Múquem de São Francisco",
        "internet Múquem BA",
        "provedor de internet Múquem de São Francisco",
      ],
      highlights: [
        "Cobertura ativa em Múquem de São Francisco",
        "Planos de 100M e 300M",
        ...COMMON_HIGHLIGHTS,
      ],
    },
  },
  {
    slug: "posto-rosario",
    name: "Posto Rosário",
    description: "Conexão de fibra óptica no entroncamento de Posto Rosário.",
    highlight: false,
    badge: null,
    planos: "100M • 300M",
    whatsapp: DEFAULT_WHATSAPP,
    maps: maps("Posto Rosario"),
    region: "Oeste da Bahia",
    microregion: "Barreiras",
    state: "Bahia",
    stateCode: "BA",
    phones: ["(77) 99204-0018"],
    address: "Avenida 02, Vila Rosário, Posto Rosário/BA",
    seo: {
      title: "Internet Fibra Óptica em Posto Rosário BA — 100M e 300M",
      description:
        "Internet fibra em Posto Rosário, Bahia. Planos residenciais e comerciais a partir de 100 Mega com Wi-Fi moderno e suporte humano pelo WhatsApp.",
      intro:
        "Em Posto Rosário, ponto de passagem importante do Oeste da Bahia, a Provider Mais Fibra leva internet 100% fibra óptica para residências, comércios e postos de serviço com planos de 100M e 300M.",
      keywords: [
        "internet fibra Posto Rosário",
        "internet Posto Rosário BA",
        "provedor de internet Posto Rosário",
      ],
      highlights: [
        "Cobertura ativa em Posto Rosário",
        "Planos de 100M e 300M",
        ...COMMON_HIGHLIGHTS,
      ],
    },
  },
  {
    slug: "roda-velha",
    name: "Roda Velha",
    description: "Internet fibra óptica para o distrito de Roda Velha, em São Desidério.",
    highlight: false,
    badge: null,
    planos: "100M • 300M • 600M",
    whatsapp: DEFAULT_WHATSAPP,
    maps: maps("Roda Velha Sao Desiderio"),
    region: "Oeste da Bahia",
    microregion: "Barreiras",
    state: "Bahia",
    stateCode: "BA",
    phones: ["(77) 99148-0023"],
    address: "Av. Brasil, S/N, Centro, Roda Velha/BA, 47827-970",
    seo: {
      title: "Internet Fibra Óptica em Roda Velha BA — 100M, 300M e 600M",
      description:
        "Internet 100% fibra óptica em Roda Velha (São Desidério), Bahia. Planos residenciais e do agro de 100, 300 e 600 Mega com Wi-Fi moderno e suporte pelo WhatsApp.",
      intro:
        "Em Roda Velha, distrito de São Desidério no coração agrícola do Oeste baiano, a Provider Mais Fibra entrega internet fibra óptica para residências, comércios e estruturas de apoio do agro. Planos de 100M, 300M e 600M com estabilidade real.",
      keywords: [
        "internet fibra Roda Velha",
        "internet Roda Velha São Desidério",
        "internet fibra agro Oeste da Bahia",
        "provedor de internet Roda Velha",
      ],
      highlights: [
        "Cobertura ativa em Roda Velha",
        "Planos de 100M, 300M e 600M",
        "Estabilidade ideal para apoio do agro",
        ...COMMON_HIGHLIGHTS,
      ],
    },
  },
  {
    slug: "santa-rita",
    name: "Santa Rita de Cássia",
    description: "Fibra óptica para residências e comércios de Santa Rita de Cássia.",
    highlight: false,
    badge: null,
    planos: "100M • 300M • 600M",
    whatsapp: DEFAULT_WHATSAPP,
    maps: maps("Santa Rita de Cassia"),
    region: "Norte da Bahia",
    microregion: "Barra",
    state: "Bahia",
    stateCode: "BA",
    phones: [
      "(77) 99823-6720",
      "(77) 99864-9170",
      "(77) 99870-0787",
    ],
    address:
      "Rua Santos Dumont, 277, Centro, Santa Rita de Cássia/BA, 47150-128",
    seo: {
      title: "Internet Fibra Óptica em Santa Rita de Cássia BA — Planos 100M a 600M",
      description:
        "Internet fibra em Santa Rita de Cássia, Bahia. Planos residenciais e comerciais de 100, 300 e 600 Mega com Wi-Fi moderno e suporte humano pelo WhatsApp.",
      intro:
        "Em Santa Rita de Cássia, a Provider Mais Fibra entrega internet 100% fibra óptica para famílias, comércios e pequenas empresas, com planos de 100M, 300M e 600M, instalação rápida e atendimento próximo.",
      keywords: [
        "internet fibra Santa Rita de Cássia",
        "internet Santa Rita de Cássia BA",
        "provedor de internet Santa Rita de Cássia",
      ],
      highlights: [
        "Cobertura ativa em Santa Rita de Cássia",
        "Planos de 100M, 300M e 600M",
        ...COMMON_HIGHLIGHTS,
      ],
    },
  },
  {
    slug: "wanderley",
    name: "Wanderley",
    description: "Conexão estável e veloz para residências e comércios locais.",
    highlight: false,
    badge: null,
    planos: "100M • 300M",
    whatsapp: DEFAULT_WHATSAPP,
    maps: maps("Wanderley"),
    region: "Oeste da Bahia",
    microregion: "Barreiras",
    state: "Bahia",
    stateCode: "BA",
    phones: ["(77) 99925-3425"],
    address:
      "Avenida Domingos Pereira dos Santos, 2, Centro, Wanderley/BA, 47940-000",
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
        ...COMMON_HIGHLIGHTS,
      ],
    },
  },
];

export function getCityBySlug(slug: string): City | undefined {
  return cities.find((c) => c.slug === slug);
}
