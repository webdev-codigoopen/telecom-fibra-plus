# `public/fonts/` — Fontes auto-hospedadas

Fontes da marca, servidas diretamente do site para evitar dependência de CDNs
externos e garantir que o `font-display: swap` funcione sem flash de texto.

---

## Fontes atuais

| Arquivo                | Família   | Uso                                               |
| ---------------------- | --------- | ------------------------------------------------- |
| `Amino-Black.{woff2,woff,ttf}` | **Amino** Black 900 | Números grandes de velocidade (300, 400, 600, 900 Mega) |
| `Nexa-Black.{woff2,woff,ttf}`  | **Nexa**  Black 900 | Números grandes de preço (R$ 69,90 etc.)         |

> **Montserrat** (corpo de texto) é carregada via Google Fonts no
> `index.html` — não precisa estar aqui.

---

## Adicionar uma fonte nova

1. Coloque os arquivos em `public/fonts/` (preferência por **woff2** + woff
   como fallback; ttf opcional para navegadores muito antigos).
2. Declare o `@font-face` em `src/index.css` no topo do arquivo:

   ```css
   @font-face {
     font-family: "MinhaFonte";
     src: url("/fonts/MinhaFonte-Bold.woff2") format("woff2"),
          url("/fonts/MinhaFonte-Bold.woff")  format("woff");
     font-weight: 700;
     font-style: normal;
     font-display: swap;
   }
   ```

3. (Opcional) Crie uma classe utilitária no mesmo arquivo:

   ```css
   .font-minha {
     font-family: "MinhaFonte", "Montserrat", sans-serif;
     font-weight: 700;
   }
   ```

4. Use no JSX: `<h1 className="font-minha">Título</h1>`.

---

## Convenções de nome

`<NomeDaFamilia>-<Peso>.<formato>` — exemplo: `Nexa-Black.woff2`,
`Montserrat-SemiBold.woff2`. Mantém a ordenação visual no diretório.
