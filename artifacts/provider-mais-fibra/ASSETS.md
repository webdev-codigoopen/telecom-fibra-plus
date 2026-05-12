# Guia de assets — Provider Mais Fibra

Todo o site organiza seus arquivos visuais em **três lugares**, cada um
com um propósito específico. Use este guia para decidir onde colocar
um arquivo novo.

---

## TL;DR — onde vai o quê

| Tipo de arquivo                        | Local                                  | Como referencia                          |
| -------------------------------------- | -------------------------------------- | ---------------------------------------- |
| Fontes da marca (Amino, Nexa)          | `public/fonts/`                        | `@font-face` em `src/index.css`          |
| Banners de hero, fundos promocionais   | `public/images/banners/`               | `<img src="/images/banners/x.png" />`    |
| Logos das marcas parceiras (streaming) | `public/images/streaming/`             | `<img src="/images/streaming/x.png" />`  |
| Fotos (atendentes, técnicos, avatares) | `public/images/photos/`                | `<img src="/images/photos/x.jpg" />`     |
| Ícones decorativos (PNG/SVG planos)    | `public/images/icons/`                 | `<img src="/images/icons/x.svg" />`      |
| Logos da marca **Provider + FIBRA**    | `attached_assets/` (compartilhado)     | `import logo from "@assets/logo-…png"`   |
| Ilustrações específicas deste site     | `src/assets/illustrations/`            | `import x from "@/assets/illustrations/x.png"` |
| SVGs que viram componente React        | `src/assets/icons/`                    | `import { ReactComponent as X } from "@/assets/icons/x.svg"` |

---

## As três pastas

### 1. `public/` — Estático servido na raiz
Arquivos copiados como estão para `dist/`. Mantêm o **nome original**
em produção, sem hash de cache.

- ✅ Use quando o arquivo precisa de URL fixa (favicon, og-image, fontes)
- ✅ Use quando o arquivo é referenciado em CSS via `url()`
- ❌ Não use para arquivos que mudam com frequência (cache do navegador trava)

→ Ver [`public/README.md`](./public/README.md)

### 2. `src/assets/` — Bundled com hash
Arquivos importados em componentes TSX. O Vite renomeia para
`x.a1b2c3.png` automaticamente, permitindo cache eterno.

- ✅ Use para ilustrações pequenas usadas em vários lugares
- ✅ Use para SVGs que viram componente React
- ❌ Não use para arquivos grandes (> 500 KB) — pesa o bundle inicial

→ Ver [`src/assets/README.md`](./src/assets/README.md)

### 3. `attached_assets/` — Compartilhado entre artifacts
Pasta na **raiz do monorepo** com assets que podem ser usados por
qualquer artifact (web, mobile, slides). É o lugar dos logos oficiais
e mockups originais enviados pelo cliente.

- Importação via alias: `import logo from "@assets/<nome>.png"`
- Não duplique aqui o que já está em `public/` ou `src/assets/`

---

## Convenções gerais

**Nomes:** `kebab-case` em minúsculas. `hero-banner.jpg`, não
`HeroBanner.JPG` ou `hero_banner.jpg`.

**Formatos:**
- Logos vetoriais → SVG
- Fotos → WebP (fallback JPG)
- Transparências → PNG ou WebP
- Ícones simples → SVG

**Tamanho máximo recomendado:**
- Banner de hero: 500 KB
- Foto comum: 200 KB
- Ícone: 20 KB
- Use [Squoosh](https://squoosh.app) ou [TinyPNG](https://tinypng.com)
  antes de comitar.

**Variações responsivas:** sufixos `-sm`, `-md`, `-lg`
(ex.: `hero-sm.webp`, `hero-lg.webp`) e sirva com `<picture>` ou
`srcset` quando relevante.
