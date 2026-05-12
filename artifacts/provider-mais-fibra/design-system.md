# Provider Mais Fibra — Design System

Sistema visual canônico extraído da homepage. Todas as outras páginas
do site (`QuemSomos`, `Contato`, `OndeEstamos`, `Cidade`,
`DemandaCidades`) devem usar esta paleta e estas fontes. Estrutura,
layout, animações e componentes ficam intocados — só **cores** e
**tipografia** mudam.

---

## 1. Paleta de cores

### Marca primária — gradientes azuis

| Token | Hex | Uso |
|---|---|---|
| `--brand-blue-1` | `#122AD5` | Início do gradiente da Hero, fundo do card do app, headings principais |
| `--brand-blue-2` | `#2138CD` | Meio do gradiente da Hero |
| `--brand-blue-3` | `#2A41DB` | Fim do gradiente da Hero |
| `--brand-blue-header` | `#1A38D5` | Fundo do header fixo |
| `--brand-blue-deep` | `#0A1995` | Tons profundos para sombras / variações escuras de fundo |
| `--brand-blue-heading` | `#003F99` | Headings de seções claras (FAQ, Differentials, AppSection) |
| `--brand-blue-about` | `#2238CD` | Heading da seção About |
| `--brand-blue-footer` | `#043198` | Fundo do footer |

**Gradiente canônico** para hero/CTA banners:

```css
linear-gradient(19.475deg, #122AD5 0%, #2138CD 50%, #2A41DB 100%)
```

**Gradiente alternativo** para seções escuras (WhatsApp banner):

```css
linear-gradient(to right, #002676 0%, #010A30 43.75%, #00091C 75.96%)
```

### CTA / acento — verde-limão

| Token | Hex | Uso |
|---|---|---|
| `--cta-green` | `#95EB1D` | Cor de todos os botões CTA, badges, destaques |
| `--cta-green-text` | `#2A40DA` ou `#0D0E14` | Texto sobre o verde (azul forte ou quase-preto, nunca branco) |

### Verdes secundários (auxiliares, mantidos onde já existem nas seções)

| Token | Hex | Uso |
|---|---|---|
| `--green-fresh` | `#49C501` | Acento na About |
| `--green-success` | `#00C650` | Itens de checklist em Differentials |

### Neutros e UI

| Token | Hex | Uso |
|---|---|---|
| `--text-strong` | `#0D0E14` | Texto principal sobre fundo claro |
| `--text-body` | `#4A4F61` | Texto corrido, descrições |
| `--text-soft` | `#535353` | Body em seção About |
| `--text-muted` | `#B0B5C3` | Captions, placeholders, labels secundárias |
| `--surface` | `#FFFFFF` | Cards e fundos brancos |
| `--surface-soft` | `#FBFBFB` | Fundo das seções claras (Testimonials, FAQ) |
| `--surface-alt` | `#F5F6FA` | Inputs, fundos suaves alternativos |
| `--border` | `#E8EAEF` | Borda padrão de cards |

### Cores **proibidas** (paleta antiga, não usar)

- `#0040FF` → trocar por `#122AD5`
- `#001A6E` → trocar por `#0A1995` ou pelo gradiente canônico
- `#FFD600` / `#FFD700` (amarelo) → trocar por `#95EB1D`
- `#00C040` / `#00D94A` (verde-WhatsApp) → trocar por `#95EB1D`

---

## 2. Tipografia

### Famílias

| Token | Stack | Uso |
|---|---|---|
| `--font-display` | `'Montserrat', system-ui, sans-serif` | Headings (h1–h3), corpo padrão (já é o `body` global) |
| `--font-ui` | `'Nunito', sans-serif` | Header, navegação, botões, labels de UI |
| `--font-speed` | `'Amino', 'Montserrat', sans-serif` | Apenas o número grande de velocidade (200/500/900 Mbps) |
| `--font-price` | `'Nexa', 'Montserrat', sans-serif` | Apenas o preço (R$ 69,90 etc.) |

> O `body` já está configurado globalmente para Montserrat em
> `index.css`, então qualquer página herda automaticamente. Use Nunito
> apenas em **botões, links de header e labels de formulário** para
> manter o contraste tipográfico do design.

### Pesos e tamanhos de referência

| Elemento | Família | Peso | Tamanho |
|---|---|---|---|
| `h1` hero | Montserrat | 900 (black) | `clamp(36px, 5vw, 56px)`, `letter-spacing: -0.02em` |
| `h2` seção | Montserrat | 700–900 | `clamp(24px, 3vw, 40px)` |
| `h3` card | Montserrat | 700 | `18–20px` |
| Body | Montserrat | 400 | `16px / 1.6` |
| Caption | Nunito | 600 | `12–14px / 1.4` |
| Botão CTA | Nunito | 700 | `14–16px` |

---

## 3. Aplicação nas páginas internas

Para cada página interna (`QuemSomos`, `Contato`, `OndeEstamos`,
`Cidade`, `DemandaCidades`):

1. **Não mexer em layout, grid, animações, componentes ou estrutura
   semântica.**
2. Trocar **cor a cor** seguindo a tabela "Cores proibidas → cor nova".
3. Em qualquer botão CTA com fundo `#95EB1D`, mudar a cor do texto
   para `#0D0E14` (ou `#2A40DA`) — branco fica ilegível no verde-limão.
4. Manter `Header` e `Footer` como estão (já usam o sistema correto).

Esse processo garante que todas as páginas falem a mesma língua visual
da homepage sem reescrever uma linha de markup.
