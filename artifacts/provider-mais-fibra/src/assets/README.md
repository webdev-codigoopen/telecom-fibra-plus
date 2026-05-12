# `src/assets/` — Assets bundled

Arquivos importados diretamente em componentes TSX. O Vite processa,
otimiza e adiciona **hash de cache** ao nome (`logo.a1b2c3.png`),
permitindo cache eterno no navegador.

---

## Quando usar

- Logos e ícones que aparecem em múltiplos lugares e raramente mudam
- Ilustrações pequenas (< 100 KB) que entram no bundle inicial sem dor
- Qualquer SVG que você queira importar como componente React

Para imagens grandes ou que precisam manter nome fixo (favicon,
og-image, banners trocáveis), use
[`public/images/`](../../public/README.md) em vez disto.

---

## Estrutura

```
src/assets/
├── icons/           ← SVGs como componentes (`import { ReactComponent as Wifi } from ...`)
├── illustrations/   ← Ilustrações decorativas pequenas (PNG/SVG)
└── README.md
```

---

## Como importar

```tsx
import logoColor from "@/assets/illustrations/provider-logo.png";
import { ReactComponent as WifiIcon } from "@/assets/icons/wifi.svg";

export function Header() {
  return (
    <header>
      <img src={logoColor} alt="Provider + FIBRA" className="h-10" />
      <WifiIcon className="w-5 h-5 text-blue-500" />
    </header>
  );
}
```

> O alias `@/` aponta para `src/`. Definido em `vite.config.ts`.

---

## Logos da marca já disponíveis

Os logos oficiais ficam em `attached_assets/` (raiz do monorepo) e
são importados via o alias `@assets/`:

```tsx
import logoBranca from "@assets/logo-provider+fibra-branca_1777059547390.png";
import logoColorida from "@assets/logo-provider+fibra_1777059547390.png";
```

Mantemos eles lá para que possam ser compartilhados entre artifacts
sem duplicação. Quando precisar de uma variação **só deste site**
(ex.: ilustração customizada, ícone derivado), salve em
`src/assets/illustrations/` ou `src/assets/icons/`.
