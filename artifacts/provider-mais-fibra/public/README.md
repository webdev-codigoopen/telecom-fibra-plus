# `public/` — Assets estáticos

Arquivos colocados aqui são servidos **diretamente** pelo Vite na raiz do site.
Use esta pasta para arquivos que precisam manter o **mesmo nome** em produção
(favicon, robots.txt, og-image, fontes auto-hospedadas, etc.).

> Para assets que devem ter hash de cache (`logo.abc123.png`) e participar do
> bundle, coloque em [`src/assets/`](../src/assets/README.md) e importe no TSX.

---

## Estrutura

```
public/
├── favicon.svg              ← favicon do site
├── opengraph.jpg            ← imagem usada nos compartilhamentos sociais
├── fonts/                   ← fontes web auto-hospedadas (woff2/woff/ttf)
│   └── README.md
└── images/                  ← imagens estáticas referenciadas via URL
    ├── banners/             ← banners de hero, fundos promocionais
    ├── icons/               ← ícones em PNG/SVG (favicons de seção, etc.)
    ├── logos/               ← variações da marca Provider + FIBRA
    ├── photos/              ← fotos de pessoas, mockups, técnicos
    ├── streaming/           ← logos das marcas de streaming (Globoplay, Disney+, etc.)
    └── README.md
```

---

## Como referenciar

Em qualquer componente ou CSS, use o caminho absoluto a partir da raiz:

```tsx
<img src="/images/banners/hero.png" alt="Banner principal" />
```

```css
background-image: url("/images/banners/streaming-bg.png");
```

Em fontes:

```css
@font-face {
  font-family: "Amino";
  src: url("/fonts/Amino-Black.woff2") format("woff2");
}
```

---

## Quando usar `public/` vs `src/assets/`

| Critério                                    | `public/`              | `src/assets/`         |
| ------------------------------------------- | ---------------------- | --------------------- |
| Precisa manter o nome exato                 | ✅                     | ❌ (recebe hash)      |
| Referenciado em CSS por URL                 | ✅                     | ⚠ funciona, complica |
| Importado via `import logo from "..."`      | ❌                     | ✅                    |
| Otimização automática de imagens            | ❌                     | ✅                    |
| Tamanho do bundle inicial                   | não conta              | conta                 |
