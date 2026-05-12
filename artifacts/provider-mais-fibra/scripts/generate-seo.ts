import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cities } from "../src/lib/cities";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, "..", "dist", "public");
const SITE_URL = (process.env.VITE_SITE_URL || "https://www.providermaisfibra.com.br").replace(
  /\/$/,
  "",
);

type RouteSpec = {
  path: string; // URL path with leading slash, no trailing slash for non-root
  title: string;
  description: string;
  keywords: string[];
  bodyHtml: string;
  jsonLd: object[];
  changefreq: "daily" | "weekly" | "monthly";
  priority: number;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

const ORG_LD = {
  "@context": "https://schema.org",
  "@type": "TelecommunicationsProvider",
  name: "Provider Mais Fibra",
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/favicon.svg`,
  image: `${SITE_URL}/opengraph.jpg`,
  telephone: "+5577998444757",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Edifício São Matheus, térreo nº 49 — Rua José Rocha, Centro",
    addressLocality: "Barreiras",
    addressRegion: "BA",
    postalCode: "47800-184",
    addressCountry: "BR",
  },
  areaServed: { "@type": "AdministrativeArea", name: "Oeste da Bahia" },
  sameAs: ["https://instagram.com/provider.fibra"],
};

const WEBSITE_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Provider Mais Fibra",
  url: `${SITE_URL}/`,
  inLanguage: "pt-BR",
};

function homeRoute(): RouteSpec {
  const citiesListHtml = cities
    .map((c) => `<li>Internet fibra em ${escapeHtml(c.name)} - BA</li>`)
    .join("");
  return {
    path: "/",
    title: "Internet Fibra Óptica no Oeste da Bahia — Provider Mais Fibra",
    description:
      "Provedor de internet 100% fibra óptica para o Oeste da Bahia. Planos residenciais e empresariais de 100M a 900M, Wi-Fi 6, IPTV inclusos e suporte humano. Assine pelo WhatsApp.",
    keywords: [
      "internet fibra óptica Oeste da Bahia",
      "provedor de internet Barreiras",
      "internet fibra Luís Eduardo Magalhães",
      "IPTV Bahia",
      "Wi-Fi 6",
    ],
    jsonLd: [ORG_LD, WEBSITE_LD],
    changefreq: "weekly",
    priority: 1.0,
    bodyHtml: `
      <header><h1>Internet Fibra Óptica no Oeste da Bahia</h1></header>
      <p>A <strong>Provider Mais Fibra</strong> é o provedor de internet 100% fibra óptica do Oeste da Bahia. Atendemos residências e empresas em <strong>${cities.length} cidades</strong>, com planos de 100 a 900 Mega, Wi-Fi 6, IPTV opcional e suporte humano via WhatsApp.</p>
      <h2>Planos disponíveis</h2>
      <ul>
        <li>100 Mega — para uso residencial leve</li>
        <li>300 Mega — ideal para famílias e streaming</li>
        <li>600 Mega — Wi-Fi 6 e múltiplos dispositivos</li>
        <li>900 Mega — alta performance para home office e empresas</li>
      </ul>
      <h2>Cidades atendidas</h2>
      <ul>${citiesListHtml}</ul>
      <p><a href="https://wa.me/5577998444757">Falar no WhatsApp</a></p>
    `,
  };
}

function ondeEstamosRoute(): RouteSpec {
  const cardsHtml = cities
    .map(
      (c) =>
        `<li><h3>${escapeHtml(c.name)} - BA</h3><p>${escapeHtml(c.description)}</p></li>`,
    )
    .join("");
  return {
    path: "/onde-estamos",
    title: "Onde Estamos — Cidades atendidas pela Provider Mais Fibra",
    description: `Veja as ${cities.length} cidades do Oeste da Bahia com cobertura de internet fibra óptica da Provider Mais Fibra: Barreiras, Luís Eduardo Magalhães, Bom Jesus da Lapa e mais.`,
    keywords: [
      "cidades atendidas Provider Mais Fibra",
      "cobertura internet fibra Oeste da Bahia",
    ],
    changefreq: "weekly",
    priority: 0.9,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Cidades atendidas pela Provider Mais Fibra",
        url: `${SITE_URL}/onde-estamos`,
        inLanguage: "pt-BR",
        hasPart: cities.map((c) => ({
          "@type": "Place",
          name: c.name,
          address: {
            "@type": "PostalAddress",
            addressLocality: c.name,
            addressRegion: c.stateCode,
            addressCountry: "BR",
          },
        })),
      },
    ],
    bodyHtml: `
      <header><h1>Onde a Provider Mais Fibra está</h1></header>
      <p>Estamos presentes em <strong>${cities.length} cidades</strong> do Oeste da Bahia com internet 100% fibra óptica para residências, comércios e empresas.</p>
      <ul>${cardsHtml}</ul>
    `,
  };
}

function quemSomosRoute(): RouteSpec {
  return {
    path: "/quem-somos",
    title: "Quem Somos — Provider Mais Fibra",
    description:
      "Conheça a Provider Mais Fibra: provedor de internet 100% fibra óptica do Oeste da Bahia desde 2016, presente em 12 cidades com infraestrutura própria e atendimento humano.",
    keywords: [
      "Provider Mais Fibra história",
      "provedor de internet Oeste da Bahia",
      "empresa de internet Barreiras",
    ],
    changefreq: "monthly",
    priority: 0.7,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "AboutPage",
        name: "Quem Somos — Provider Mais Fibra",
        url: `${SITE_URL}/quem-somos`,
        inLanguage: "pt-BR",
        about: ORG_LD,
      },
    ],
    bodyHtml: `
      <header><h1>Conectando o Oeste da Bahia há mais de 8 anos</h1></header>
      <p>A Provider Mais Fibra nasceu em 2016 com a missão de levar internet de alta velocidade para o interior da Bahia, democratizando o acesso à conectividade para famílias e empresas da região.</p>
      <p>Crescemos de uma para 12 cidades, com infraestrutura 100% em fibra óptica, planos de 100M a 900M, IPTV opcional e atendimento humano via WhatsApp.</p>
    `,
  };
}

function contatoRoute(): RouteSpec {
  return {
    path: "/contato",
    title: "Contato — Provider Mais Fibra",
    description:
      "Fale com a Provider Mais Fibra: WhatsApp (77) 99844-4757, Instagram @provider.fibra e atendimento de seg a sex 8h–18h. Tire dúvidas, contrate planos e peça suporte.",
    keywords: [
      "contato Provider Mais Fibra",
      "telefone Provider Mais Fibra",
      "WhatsApp Provider Mais Fibra",
    ],
    changefreq: "monthly",
    priority: 0.7,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "ContactPage",
        name: "Contato — Provider Mais Fibra",
        url: `${SITE_URL}/contato`,
        inLanguage: "pt-BR",
      },
    ],
    bodyHtml: `
      <header><h1>Fale com a Provider Mais Fibra</h1></header>
      <p>WhatsApp: <a href="https://wa.me/5577998444757">(77) 99844-4757</a></p>
      <p>Instagram: <a href="https://instagram.com/provider.fibra">@provider.fibra</a></p>
      <p>Atendimento: segunda a sexta, 8h às 18h. Sábado, 8h às 12h.</p>
      <p>Endereço da sede: Edifício São Matheus, térreo nº 49 — Rua José Rocha, Centro, Barreiras - BA, 47800-184.</p>
    `,
  };
}

function demandaRoute(): RouteSpec {
  return {
    path: "/demanda",
    title: "Mapa de Demanda — Provider Mais Fibra",
    description:
      "Veja o mapa de demanda da Provider Mais Fibra e cadastre sua cidade ou bairro para ajudar a definir as próximas regiões com cobertura de internet fibra óptica no Oeste da Bahia.",
    keywords: [
      "mapa de demanda Provider Mais Fibra",
      "solicitar internet fibra Bahia",
      "cidades em expansão Provider",
    ],
    changefreq: "weekly",
    priority: 0.6,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "Mapa de Demanda — Provider Mais Fibra",
        url: `${SITE_URL}/demanda`,
        inLanguage: "pt-BR",
      },
    ],
    bodyHtml: `
      <header><h1>Mapa público de demanda</h1></header>
      <p>Cadastre sua cidade ou bairro e ajude a definir as próximas regiões do Oeste da Bahia com cobertura de internet fibra óptica da Provider Mais Fibra. Quanto mais pedidos, mais rápida a chegada.</p>
      <p><a href="/onde-estamos">Ver as cidades já atendidas</a></p>
    `,
  };
}

function buildHead(route: RouteSpec): string {
  const url = `${SITE_URL}${route.path === "/" ? "/" : route.path}`;
  const image = `${SITE_URL}/opengraph.jpg`;
  const fullTitle = route.title;
  const desc = route.description;
  const ld = route.jsonLd
    .map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`)
    .join("\n    ");
  return `
    <title>${escapeHtml(fullTitle)}</title>
    <meta name="description" content="${escapeAttr(desc)}" />
    <meta name="keywords" content="${escapeAttr(route.keywords.join(", "))}" />
    <link rel="canonical" href="${escapeAttr(url)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Provider Mais Fibra" />
    <meta property="og:locale" content="pt_BR" />
    <meta property="og:title" content="${escapeAttr(fullTitle)}" />
    <meta property="og:description" content="${escapeAttr(desc)}" />
    <meta property="og:url" content="${escapeAttr(url)}" />
    <meta property="og:image" content="${escapeAttr(image)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttr(fullTitle)}" />
    <meta name="twitter:description" content="${escapeAttr(desc)}" />
    <meta name="twitter:image" content="${escapeAttr(image)}" />
    ${ld}
  `.trim();
}

const SEO_START = "<!--SEO_START-->";
const SEO_END = "<!--SEO_END-->";

function injectIntoHtml(shell: string, route: RouteSpec): string {
  let out = shell;

  // 1) Strip the ENTIRE existing head SEO block on first run, replace title.
  out = out.replace(/<title>[\s\S]*?<\/title>/i, ""); // remove default title
  // remove default meta description, canonical, keywords, og:*, twitter:*, robots, JSON-LD blocks
  out = out.replace(/<meta\s+name="description"[^>]*>/gi, "");
  out = out.replace(/<meta\s+name="keywords"[^>]*>/gi, "");
  out = out.replace(/<link\s+rel="canonical"[^>]*>/gi, "");
  out = out.replace(/<meta\s+property="og:[^"]+"[^>]*>/gi, "");
  out = out.replace(/<meta\s+name="twitter:[^"]+"[^>]*>/gi, "");
  out = out.replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/gi, "");
  // also strip any previous SEO_START/END block from this script
  out = out.replace(new RegExp(`${SEO_START}[\\s\\S]*?${SEO_END}`, "g"), "");

  // 2) Inject our SEO block right before </head>
  const seoBlock = `${SEO_START}\n    ${buildHead(route)}\n    ${SEO_END}`;
  out = out.replace(/<\/head>/i, `${seoBlock}\n  </head>`);

  // 3) Inject prerendered body content as a <noscript> fallback (non-cloaking).
  //    Keep #root empty so React's createRoot mounts cleanly without warnings.
  //    <noscript> is shown only to non-JS clients (Bing, social scrapers, etc.).
  //    Googlebot executes JS and sees the real React app — its SEO comes from
  //    the head meta + JSON-LD above.
  out = out.replace(
    /<div id="root">\s*<\/div>/i,
    `<div id="root"></div>\n    <noscript data-prerender="seo">${route.bodyHtml}</noscript>`,
  );

  return out;
}

function buildSitemap(routes: RouteSpec[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const urls = routes
    .map((r) => {
      const loc = `${SITE_URL}${r.path === "/" ? "/" : r.path}`;
      return `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority.toFixed(1)}</priority>
  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

async function main() {
  const indexPath = join(distDir, "index.html");
  const shell = await readFile(indexPath, "utf8");

  const routes: RouteSpec[] = [
    homeRoute(),
    ondeEstamosRoute(),
    quemSomosRoute(),
    contatoRoute(),
    demandaRoute(),
  ];

  for (const route of routes) {
    const html = injectIntoHtml(shell, route);
    const outPath =
      route.path === "/"
        ? indexPath
        : join(distDir, route.path.replace(/^\//, ""), "index.html");
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, html, "utf8");
    console.log(`[seo] wrote ${outPath}`);
  }

  const sitemap = buildSitemap(routes);
  await writeFile(join(distDir, "sitemap.xml"), sitemap, "utf8");
  console.log(`[seo] wrote sitemap.xml with ${routes.length} URLs`);
}

main().catch((err) => {
  console.error("[seo] failed:", err);
  process.exit(1);
});
