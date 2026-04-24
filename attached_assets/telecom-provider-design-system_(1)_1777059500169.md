# Design System — Telecom Provider / Fibra Campeã

---

## Design System Overview

### 1. Concept and Style

Este sistema de design é orientado por uma linguagem **energética, comercial e de alto impacto**. O produto digital comunica poder, velocidade e valor imediato — características inerentes ao mercado de telecomunicações. A estética equilibra **bold type, gradientes vibrantes e contraste forte** para capturar atenção rapidamente, enquanto estruturas de card bem definidas organizam a densidade informacional.

**Keywords:** `energetic` · `high-contrast` · `bold-commercial` · `tech-forward` · `vibrant` · `structured`

---

## 2. Color System

### Primitive Colors

#### Neutrals

| Token           | HEX       | Uso                          |
|-----------------|-----------|------------------------------|
| `neutral-0`     | `#FFFFFF` | Fundo primário, texto inverso |
| `neutral-50`    | `#F5F6FA` | Fundo de seções alternadas   |
| `neutral-100`   | `#E8EAEF` | Bordas suaves, divisores     |
| `neutral-300`   | `#B0B5C3` | Texto secundário, captions   |
| `neutral-600`   | `#4A4F61` | Texto de corpo em fundo claro|
| `neutral-900`   | `#0D0E14` | Fundo escuro, dark sections  |

#### Core Colors

| Token           | HEX       | Observação                              |
|-----------------|-----------|-----------------------------------------|
| `blue-500`      | `#0055B8` | Azul institucional (logo, destaques)    |
| `blue-600`      | `#003F99` | Azul escuro, headers de seção           |
| `blue-700`      | `#002D75` | Fundo dark-blue de hero                 |
| `orange-400`    | `#FF8C00` | Laranja vibrante — CTA principal        |
| `orange-500`    | `#E67700` | Laranja saturado — hover de botão       |
| `yellow-400`    | `#FFD600` | Amarelo destaque — badges, números      |
| `purple-500`    | `#7B2FBE` | Roxo — gradiente de banner              |
| `pink-500`      | `#E91E8C` | Rosa — gradiente de banner              |
| `green-500`     | `#00A86B` | Verde — ícones de benefício, success    |

---

### Semantic Colors

| Role        | Token de referência | HEX       | Aplicação                                  |
|-------------|---------------------|-----------|--------------------------------------------|
| **Primary** | `blue-600`          | `#003F99` | Ações primárias, links, backgrounds hero   |
| **Secondary**| `neutral-0`        | `#FFFFFF` | Conteúdo sobre fundo escuro                |
| **Accent**  | `orange-400`        | `#FF8C00` | CTAs, badges de preço, destaques           |
| **Highlight**| `yellow-400`       | `#FFD600` | Números grandes, promoções                 |
| **Success** | `green-500`         | `#00A86B` | Ícones de checklist, benefícios ativos     |
| **Warning** | `orange-400`        | `#FF8C00` | Avisos, ofertas por tempo limitado         |
| **Error**   | `#D32F2F`           | —         | Validações de formulário                   |
| **Gradient A** | `purple → pink` | `#7B2FBE → #E91E8C` | Banners promocionais laterais  |
| **Gradient B** | `blue → blue-dark` | `#0055B8 → #002D75` | Hero principal          |

> **Regra de uso:** O laranja (`orange-400`) é o único acento quente permitido em superfícies azuis. O amarelo (`yellow-400`) é reservado exclusivamente para numeração de destaque (preços, mega speeds). Gradientes são permitidos apenas em banners e heroes — nunca em cards de produto.

---

## 3. Typography

### Sistema Tipográfico

O sistema usa uma tipografia **sans-serif display de alta legibilidade** com peso concentrado nas extremidades da escala — títulos em `Black/ExtraBold` e textos de corpo em `Regular`. A hierarquia é agressiva: os números de velocidade e preço dominam visualmente qualquer composição.

### Escala de Hierarquia

| Nível      | Tamanho (base desktop) | Peso        | Uso principal                              |
|------------|------------------------|-------------|---------------------------------------------|
| `display`  | 72–96px                | 900 Black   | Números de mega (300, 600, 900 MEGA)        |
| `H1`       | 40–48px                | 800 ExtraBold | Títulos de hero e seções principais       |
| `H2`       | 28–32px                | 700 Bold    | Títulos de cards e subseções               |
| `H3`       | 20–22px                | 600 SemiBold| Subtítulos, labels de plano                |
| `body-lg`  | 16px                   | 400 Regular | Texto de descrição, benefícios             |
| `body-sm`  | 14px                   | 400 Regular | Termos, notas, textos auxiliares           |
| `caption`  | 11–12px                | 400 Regular | Rodapés, disclaimers legais                |
| `label`    | 13–14px                | 600 SemiBold| Labels de botão, badges                    |
| `price`    | 32–48px                | 800 ExtraBold | Valores monetários (`R$ 69,90`)          |

### Tendências de Espaçamento

- **Letter-spacing:** Levemente negativo em display (`-0.02em`) para coesão em títulos grandes
- **Line-height:** Compacto em display (1.0–1.1), confortável em body (1.5–1.6)
- **Alinhamento:** Predominantemente esquerdo; centralizado apenas em banners promocionais

---

## 4. Spacing and Layout

### Escala de Espaçamento (base 4pt)

| Token       | Valor | Uso                                         |
|-------------|-------|----------------------------------------------|
| `space-1`   | 4px   | Micro-gaps, ícone + label                    |
| `space-2`   | 8px   | Espaço interno mínimo de componentes         |
| `space-3`   | 12px  | Padding interno de badges e chips            |
| `space-4`   | 16px  | Padding padrão de cards                      |
| `space-6`   | 24px  | Gap entre elementos dentro de um card        |
| `space-8`   | 32px  | Espaço entre cards em grid                   |
| `space-12`  | 48px  | Separação entre seções                       |
| `space-16`  | 64px  | Padding vertical de seções maiores           |
| `space-24`  | 96px  | Espaçamento máximo entre blocos de conteúdo  |

### Layout e Grid

- **Grid:** 12 colunas, gutter de `24px`, margem lateral de `32–64px`
- **Densidade:** Compacta-a-balanceada — cards têm bastante conteúdo mas são bem delimitados
- **Max-width do container:** `1200px` centralizado
- **Estrutura de seções:**
  - Seções hero: **full-bleed** (100vw) com gradiente de fundo
  - Seções de cards: container centralizado com grid responsivo
  - Banners intermediários: full-bleed com cor sólida ou gradiente
  - Seções de conteúdo misto (texto + imagem): 2 colunas 50/50 ou 60/40

---

## 5. Shapes and UI Language

### Border Radius

| Contexto                  | Valor      | Descrição                              |
|---------------------------|------------|-----------------------------------------|
| Cards de plano            | `12px`     | Arredondado suave, não excessivo        |
| Botões primários (CTA)    | `8px`      | Levemente arredondado, assertivo        |
| Badges / chips de destaque| `999px`    | Pill completo (ex: "MAIS VENDIDO")      |
| Imagens em banners        | `0px`      | Sem arredondamento, full-bleed          |
| Ícones de benefícios      | `50%`      | Circular                               |
| Inputs de formulário      | `6px`      | Sutil                                  |

### Stroke e Bordas

- Cards usam bordas de `1px` em `neutral-100` sobre fundo branco
- Bordas de destaque em cards selecionados/featured: `2px solid blue-500`
- Sem stroke em elementos sobre fundos coloridos
- Separadores internos de card: `1px dashed neutral-100`

### Component Style

- **Flat com sombra discreta** — componentes não têm elevação por padrão
- Cards ganham `box-shadow` suave apenas no hover
- Sem glassmorphism
- Sem neumorfismo

---

## 6. Visual Details

### Shadows

| Contexto          | Definição                                        |
|-------------------|--------------------------------------------------|
| Cards padrão      | `0 2px 8px rgba(0, 0, 0, 0.08)`                 |
| Cards hover       | `0 8px 24px rgba(0, 85, 184, 0.15)`             |
| Botões CTA        | `0 4px 12px rgba(255, 140, 0, 0.35)`            |
| Modal / Overlay   | `0 16px 48px rgba(0, 0, 0, 0.24)`               |
| Sem sombra        | Banners, heroes, seções full-bleed               |

### Gradientes

| Nome              | Definição                                              | Uso                         |
|-------------------|--------------------------------------------------------|-----------------------------|
| `hero-gradient`   | `linear-gradient(135deg, #002D75 0%, #0055B8 100%)`   | Hero principal              |
| `promo-gradient`  | `linear-gradient(90deg, #7B2FBE 0%, #E91E8C 100%)`    | Banners laterais e faixas   |
| `cta-gradient`    | `linear-gradient(90deg, #FF8C00 0%, #FFD600 100%)`    | Botões e badges de destaque |
| `dark-gradient`   | `linear-gradient(180deg, #0D0E14 0%, #1A2240 100%)`   | Seção gaming / dark         |

### Decorações

- **Nenhum ruído (noise) ou blur:** A estética é limpa e nítida
- **Sem glassmorphism**
- Imagens de pessoas (fotografia) são usadas como elementos visuais diretos em banners — sem tratamento adicional
- Logotipos de parceiros/streaming exibidos em row horizontal com opacidade reduzida (`0.7`) sobre fundo escuro

---

## 7. Contrast and Accessibility

### Níveis de Contraste

| Combinação                          | Contraste estimado | Avaliação  |
|-------------------------------------|---------------------|------------|
| Branco sobre azul-600               | ~7:1                | ✅ AAA      |
| Branco sobre laranja-400            | ~3:1                | ⚠️ AA Large |
| Texto escuro (neutral-900) sobre branco | ~18:1           | ✅ AAA      |
| Amarelo sobre azul-700              | ~8:1                | ✅ AAA      |
| Laranja sobre fundo escuro          | ~5:1                | ✅ AA       |

### Diretrizes de Legibilidade

- Nunca usar texto claro sobre `orange-400` puro — apenas texto escuro (`neutral-900`)
- CTAs laranjas devem sempre ter texto preto ou branco — validar caso a caso
- Preços e números de destaque: sempre usar `yellow-400` ou `white` sobre fundos azuis
- Textos de descrição (`body-sm`) nunca devem usar cor abaixo de `neutral-600` sobre branco

### Hierarquia de Ênfase por Cor

1. **Laranja + Amarelo** → Ação imediata, preço, CTA
2. **Azul escuro** → Confiança, institucional, estrutura
3. **Verde** → Confirmação, benefício, disponibilidade
4. **Branco** → Leitura, respiro, contraste sobre dark
5. **Cinza claro** → Informação secundária, contexto de suporte

---

## Tokens de Design (Referência Rápida para Figma)

```
// Colors
--color-primary:        #003F99
--color-primary-dark:   #002D75
--color-primary-light:  #0055B8
--color-accent:         #FF8C00
--color-accent-hover:   #E67700
--color-highlight:      #FFD600
--color-success:        #00A86B
--color-error:          #D32F2F
--color-neutral-0:      #FFFFFF
--color-neutral-50:     #F5F6FA
--color-neutral-100:    #E8EAEF
--color-neutral-300:    #B0B5C3
--color-neutral-600:    #4A4F61
--color-neutral-900:    #0D0E14

// Gradients
--gradient-hero:    linear-gradient(135deg, #002D75 0%, #0055B8 100%)
--gradient-promo:   linear-gradient(90deg, #7B2FBE 0%, #E91E8C 100%)
--gradient-cta:     linear-gradient(90deg, #FF8C00 0%, #FFD600 100%)
--gradient-dark:    linear-gradient(180deg, #0D0E14 0%, #1A2240 100%)

// Spacing
--space-1:  4px
--space-2:  8px
--space-3:  12px
--space-4:  16px
--space-6:  24px
--space-8:  32px
--space-12: 48px
--space-16: 64px
--space-24: 96px

// Border Radius
--radius-sm:   6px
--radius-md:   8px
--radius-lg:   12px
--radius-pill: 999px
--radius-circle: 50%

// Shadows
--shadow-card:   0 2px 8px rgba(0,0,0,0.08)
--shadow-hover:  0 8px 24px rgba(0,85,184,0.15)
--shadow-cta:    0 4px 12px rgba(255,140,0,0.35)
--shadow-modal:  0 16px 48px rgba(0,0,0,0.24)

// Typography Scale
--text-display: 96px / 900
--text-h1:      48px / 800
--text-h2:      32px / 700
--text-h3:      22px / 600
--text-body-lg: 16px / 400
--text-body-sm: 14px / 400
--text-caption: 12px / 400
--text-label:   14px / 600
--text-price:   40px / 800
```

---

*Design System gerado com base na análise visual do produto Telecom Provider / Fibra Campeã. Versão 1.0.*
