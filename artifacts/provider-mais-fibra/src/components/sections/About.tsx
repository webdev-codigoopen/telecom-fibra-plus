import { motion } from "framer-motion";

const BASE = import.meta.env.BASE_URL;
const LOGO = `${BASE}images/logos/logo-quem-somos-326x56.svg`;
const MAP = `${BASE}images/photos/mapa-oeste-bahia.png`;

const FONT_NUNITO = "'Nunito', system-ui, sans-serif";
const FONT_MONTSERRAT = "'Montserrat', system-ui, sans-serif";

const COLOR_BLUE = "#2238CD";
const COLOR_GREEN = "#49C501";
const COLOR_BODY = "#535353";

export default function About() {
  return (
    <section
      id="sobre"
      data-testid="about-section"
      className="bg-white w-full"
      style={{ paddingTop: 103, paddingBottom: 50 }}
    >
      <div
        className="mx-auto px-6 lg:px-0 flex flex-col lg:flex-row items-center justify-center"
        style={{ maxWidth: 1240, columnGap: 78, rowGap: 48 }}
      >
        {/* Map (Figma Frame 10: 539×611) */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex justify-center w-full lg:w-[539px] lg:flex-none"
        >
          <img
            src={MAP}
            alt="Mapa do Oeste da Bahia — cidades atendidas pela Provider Mais Fibra"
            className="block h-auto w-full max-w-[539px]"
            width={539}
            height={611}
            loading="lazy"
            decoding="async"
          />
        </motion.div>

        {/* Right column (Figma Container: 623 wide, gap 22.8) */}
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="flex flex-col w-full lg:w-[623px] lg:flex-none"
          style={{ maxWidth: 623, rowGap: 22.8 }}
        >
          {/* Heading 2 group (gap 20) */}
          <div className="flex flex-col" style={{ rowGap: 20 }}>
            <img
              src={LOGO}
              alt="Provider + FIBRA"
              className="block w-auto self-start"
              style={{ height: 56 }}
              width={326}
              height={56}
              loading="lazy"
              decoding="async"
            />
            <h2
              className="m-0"
              style={{
                fontFamily: FONT_MONTSERRAT,
                fontWeight: 500,
                fontSize: "clamp(1.75rem, 4.5vw + 0.5rem, 2rem)",
                lineHeight: 1.25,
                letterSpacing: "-0.36px",
                color: COLOR_BLUE,
              }}
            >
              Conectando o Oeste da
              <br />
              Bahia com{" "}
              <span style={{ fontWeight: 700, color: COLOR_GREEN }}>
                Fibra de Qualidade
              </span>
            </h2>
          </div>

          {/* Body paragraph (Montserrat 400 16/33, color #535353) */}
          <p
            className="m-0 whitespace-pre-line"
            style={{
              fontFamily: FONT_MONTSERRAT,
              fontWeight: 400,
              fontSize: 16,
              lineHeight: "33px",
              color: COLOR_BODY,
            }}
          >
            A Provider Mais Fibra nasceu com a missão de levar internet de alta
            velocidade para o interior da Bahia. Com infraestrutura 100% em fibra
            óptica e foco no atendimento ao cliente, estamos presentes em 12
            cidades do Oeste da Bahia, oferecendo conectividade confiável para
            famílias e empresas.{"\n\n"}
            Homologados pela Anatel, garantimos qualidade de serviço, suporte
            técnico especializado e planos que cabem no bolso. Nossa equipe
            trabalha 24h para que sua conexão nunca pare.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
