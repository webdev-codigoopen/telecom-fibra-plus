# `public/images/` — Imagens estáticas

Imagens servidas diretamente pelo site, sem hash de cache e sem otimização
automática. Use esta pasta quando o arquivo:

- Precisa manter o **nome exato** em produção (ex.: og-image, sitemap)
- É grande demais para entrar no bundle inicial
- É referenciado por **CSS** via `url()` ou em **HTML estático**
- É carregado dinamicamente em runtime (galeria, banner trocável)

Para logos, ícones e ilustrações usadas via `import` em componentes,
prefira [`src/assets/`](../../src/assets/README.md) — recebe hash de
cache e é otimizado pelo bundler.

---

## Subpastas

```
images/
├── banners/        ← Banners de hero, fundos promocionais (1920×1080+ típico)
├── icons/          ← Ícones em PNG/SVG (favicons de seção, ícones planos)
├── logos/          ← Logos da marca Provider + FIBRA (variações)
├── photos/         ← Fotos de pessoas, mockups, técnicos
└── streaming/      ← Logos das marcas de streaming parceiras
```

| Pasta        | O que vai aqui                                                      |
| ------------ | ------------------------------------------------------------------- |
| `banners/`   | `hero.png`, `home-banner.jpg`, `combo-bg.jpg`                       |
| `icons/`     | `wifi.svg`, `signal.png` — ícones decorativos não-componente        |
| `logos/`     | `provider-fibra.png`, `provider-fibra-white.png`, variantes verticais |
| `photos/`    | `atendente.jpg`, `tecnico.png`, avatares de depoimentos              |
| `streaming/` | `globoplay.png`, `disney-plus.svg`, `discovery.png`, etc.            |

---

## Como referenciar

```tsx
// Em componente React
<img src="/images/banners/hero.png" alt="Banner principal" />

// Em CSS / Tailwind inline
<div style={{ backgroundImage: "url('/images/banners/streaming-bg.png')" }} />
```

> O caminho começa em `/` porque tudo dentro de `public/` é servido
> a partir da raiz do site. **Não** prefixe com `/public/`.

---

## Convenções

- **Formatos:** prefira **WebP** ou **AVIF** para fotos, **SVG** para
  logos/ícones vetoriais, **PNG** quando precisa de transparência.
- **Nomes:** `kebab-case` em minúsculas (`hero-banner.jpg`, não
  `HeroBanner.JPG`).
- **Tamanho:** mantenha banners ≤ 500 KB. Use ferramentas como
  [Squoosh](https://squoosh.app) para otimizar antes de comitar.
- **Variações de tamanho:** sufixo `-sm`, `-md`, `-lg`
  (`hero-sm.webp`, `hero-lg.webp`).
