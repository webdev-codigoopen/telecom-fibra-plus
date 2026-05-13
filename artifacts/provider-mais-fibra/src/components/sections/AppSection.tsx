import { motion } from "framer-motion";
import iconPlus from "@assets/icone_plus_green.svg";
import icon2Via from "@assets/icon_2via_boleto.svg";
import iconVelocidade from "@assets/icon_teste_velocidade.svg";
import iconArea from "@assets/icon_area_cliente.svg";
import iconViaApp from "@assets/icon_via_app.svg";
import ctaGoogle from "@assets/cta_google_play.svg";
import ctaApple from "@assets/cta_app_store.svg";

const FONT_MONTSERRAT = "Montserrat, sans-serif";
const FONT_NUNITO = "Nunito, sans-serif";
const COLOR_BG = "#FBFBFB";
const COLOR_BLUE = "#003F99";
const COLOR_TEXT = "#4A4F61";
const COLOR_CARD = "#122AD5";
const COLOR_CARD_BORDER = "#061CD2";
const COLOR_GREEN = "#95EB1D";

const cards = [
  {
    icon: icon2Via,
    title: "2\u00AA Via de Boleto",
    desc: "Acesse e pague sua fatura com 1\nclique",
  },
  {
    icon: iconVelocidade,
    title: "Teste de Velocidade",
    desc: "Verifique sua conex\u00E3o a qualquer\nmomento",
  },
  {
    icon: iconArea,
    title: "\u00C1rea do Cliente",
    desc: "Gerencie sua conta de onde estiver",
  },
  {
    icon: iconViaApp,
    title: "Suporte via App",
    desc: "Atendimento r\u00E1pido direto no\naplicativo",
  },
];

export default function AppSection() {
  return (
    <section
      id="app"
      data-testid="app-section"
      style={{
        background: COLOR_BG,
        paddingTop: 80,
        paddingBottom: 80,
      }}
    >
      <div
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          paddingLeft: 20,
          paddingRight: 20,
          display: "flex",
          flexDirection: "column",
          rowGap: 15,
          boxSizing: "border-box",
        }}
      >
        {/* Heading 2: + icon + title */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 0,
          }}
        >
          <h2
            style={{
              fontFamily: FONT_MONTSERRAT,
              fontWeight: 400,
              fontSize: 32,
              lineHeight: "40px",
              color: COLOR_BLUE,
              margin: 0,
              textAlign: "center",
            }}
          >
            <img
              src={iconPlus}
              alt=""
              aria-hidden
              style={{
                width: "0.85em",
                height: "0.85em",
                display: "inline-block",
                verticalAlign: "-0.08em",
                marginRight: 8,
              }}
            />
            <span style={{ fontWeight: 700 }}>Facilidade</span> no Seu{" "}
            <span style={{ fontWeight: 700 }}>Dia a Dia</span>
          </h2>
        </motion.div>

        {/* Subtitle */}
        <p
          style={{
            fontFamily: FONT_NUNITO,
            fontWeight: 400,
            fontSize: 16,
            lineHeight: "24px",
            color: COLOR_TEXT,
            margin: 0,
            textAlign: "center",
          }}
        >
          Gerencie sua internet direto pelo celular. Tudo que voc&ecirc;
          precisa em um s&oacute; lugar.
        </p>

        {/* Cards row */}
        <div
          className="appsection-cards"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            columnGap: 20,
            rowGap: 20,
            paddingTop: 20,
            paddingBottom: 20,
          }}
        >
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
              style={{
                background: COLOR_CARD,
                border: `1px solid ${COLOR_CARD_BORDER}`,
                borderRadius: 12,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                rowGap: 8,
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: COLOR_GREEN,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <img
                  src={card.icon}
                  alt=""
                  aria-hidden
                  style={{ width: 36, height: 36, display: "block" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", rowGap: 2 }}>
                <h3
                  style={{
                    fontFamily: FONT_MONTSERRAT,
                    fontWeight: 600,
                    fontSize: 16,
                    lineHeight: "20px",
                    color: "#FFFFFF",
                    margin: 0,
                  }}
                >
                  {card.title}
                </h3>
                <p
                  style={{
                    fontFamily: FONT_NUNITO,
                    fontWeight: 400,
                    fontSize: 12,
                    lineHeight: "16px",
                    color: "#FFFFFF",
                    margin: 0,
                    whiteSpace: "pre-line",
                  }}
                >
                  {card.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="appsection-cta"
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            columnGap: 12,
            rowGap: 12,
            flexWrap: "wrap",
          }}
        >
          <p
            style={{
              fontFamily: FONT_MONTSERRAT,
              fontWeight: 400,
              fontSize: 18,
              lineHeight: "22px",
              color: COLOR_BLUE,
              margin: 0,
              textAlign: "right",
            }}
          >
            Baixa agora o
            <br />
            nosso <span style={{ fontWeight: 600 }}>Aplicativo</span>
          </p>

          <a
            href="https://play.google.com/store/apps/details?id=br.com.telecomprovider.ixc&pli=1"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="app-google-play"
            aria-label="Disponível no Google Play"
            style={{ display: "inline-block", lineHeight: 0 }}
          >
            <img
              src={ctaGoogle}
              alt="Disponível no Google Play"
              style={{ width: 154, height: 48, display: "block" }}
            />
          </a>

          <a
            href="https://apps.apple.com/br/app/provider-mais-fibra/id6762133657"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="app-apple-store"
            aria-label="Disponível na App Store"
            style={{ display: "inline-block", lineHeight: 0 }}
          >
            <img
              src={ctaApple}
              alt="Disponível na App Store"
              style={{ width: 145, height: 48, display: "block" }}
            />
          </a>
        </motion.div>
      </div>

      <style>{`
        @media (max-width: 1023px) {
          .appsection-cards {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 599px) {
          .appsection-cards {
            grid-template-columns: 1fr !important;
          }
          .appsection-cards > div {
            align-items: center !important;
            text-align: center !important;
          }
          .appsection-cta {
            flex-direction: row !important;
            flex-wrap: wrap !important;
            justify-content: center !important;
          }
          .appsection-cta p {
            text-align: center !important;
            flex: 0 0 100% !important;
          }
        }
      `}</style>
    </section>
  );
}
