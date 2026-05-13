import { motion } from "framer-motion";

const BASE = import.meta.env.BASE_URL;

const FONT_NUNITO = "'Nunito', system-ui, sans-serif";
const FONT_MONTSERRAT = "'Montserrat', system-ui, sans-serif";

const COLOR_HEADING = "#003F99";
const COLOR_BODY = "#4A4F61";
const COLOR_BORDER = "#E8EAEF";
const COLOR_GREEN = "#00C650";

type Card = {
  icon: string;
  title: string;
  desc: string;
};

const cards: Card[] = [
  {
    icon: `${BASE}images/icons/diff-router.svg`,
    title: "Roteadores de Última Geração",
    desc: "Wi-Fi 6 nos planos 600 e 900 Mega para\nmáxima performance em todos os dispositivos.",
  },
  {
    icon: `${BASE}images/icons/diff-speed.svg`,
    title: "Velocidade Estável\ne Confiável",
    desc: "Fibra óptica dedicada com baixa latência,\nideal para home office, games e streaming.",
  },
  {
    icon: `${BASE}images/icons/diff-devices.svg`,
    title: "Conecte Todos os\nDispositivos",
    desc: "Suporte a múltiplas conexões simultâneas\nsem perda de velocidade.",
  },
];

export default function Differentials() {
  return (
    <section
      id="diferenciais"
      data-testid="differentials-section"
      className="bg-white"
      style={{ paddingBottom: 100 }}
    >
      {/* Container: max 1200, vertical, gap 48 */}
      <div
        className="mx-auto flex flex-col w-full px-6 lg:px-0"
        style={{ maxWidth: 1200, rowGap: 48 }}
      >
        {/* Heading 2 group: gap 12 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center text-center"
          style={{ rowGap: 12 }}
        >
          <h2
            className="m-0"
            style={{
              fontFamily: FONT_MONTSERRAT,
              fontWeight: 400,
              fontSize: 32,
              lineHeight: "40px",
              color: COLOR_HEADING,
              letterSpacing: 0,
            }}
          >
            Por que escolher a&nbsp;&nbsp;
            <span style={{ fontWeight: 700 }}>Provider</span>
            {" "}mais{" "}
            <span style={{ fontWeight: 700 }}>Fibra</span>
          </h2>
          <p
            className="m-0"
            style={{
              fontFamily: FONT_NUNITO,
              fontWeight: 400,
              fontSize: 16,
              lineHeight: "24px",
              color: COLOR_BODY,
            }}
          >
            Tecnologia e qualidade que fazem a diferença
          </p>
        </motion.div>

        {/* Cards row: 3 cols, gap 20 */}
        <div
          className="grid grid-cols-1 md:grid-cols-3 w-full"
          style={{ columnGap: 20, rowGap: 20 }}
        >
          {cards.map((card, i) => (
            <motion.article
              key={card.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="flex flex-col items-center text-center bg-white"
              style={{
                border: `1px solid ${COLOR_BORDER}`,
                borderRadius: 12,
                padding: 33,
              }}
            >
              {/* Green icon circle 64×64, padding-bottom 24 below */}
              <div style={{ paddingBottom: 24 }}>
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background: COLOR_GREEN,
                  }}
                >
                  <img
                    src={card.icon}
                    alt=""
                    aria-hidden="true"
                    width={28}
                    height={28}
                    style={{ display: "block", width: 28, height: 28 }}
                  />
                </div>
              </div>

              {/* Heading 3, padding-bottom 12 */}
              <div style={{ paddingBottom: 12 }}>
                <h3
                  className="m-0 whitespace-pre-line"
                  style={{
                    fontFamily: FONT_MONTSERRAT,
                    fontWeight: 500,
                    fontSize: 20,
                    lineHeight: "28px",
                    color: COLOR_HEADING,
                  }}
                >
                  {card.title}
                </h3>
              </div>

              {/* Description */}
              <p
                className="m-0 whitespace-pre-line"
                style={{
                  fontFamily: FONT_NUNITO,
                  fontWeight: 400,
                  fontSize: 14,
                  lineHeight: "22.75px",
                  color: COLOR_BODY,
                }}
              >
                {card.desc}
              </p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
