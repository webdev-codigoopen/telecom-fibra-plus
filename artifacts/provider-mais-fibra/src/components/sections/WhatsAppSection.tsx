import { motion } from "framer-motion";
import logoHorizontalWhite from "@assets/logo_provider_atendimento_317x55.svg";
import atendimentoImage from "@assets/atendiment_1778601554742.png";

export default function WhatsAppSection() {
  return (
    <section
      id="atendimento"
      data-testid="whatsapp-section"
      style={{
        width: "100%",
        background:
          "linear-gradient(to right, #002676 0%, #010A30 43.75%, #00091C 75.96%)",
      }}
    >
      <div
        className="atendimento-container"
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          paddingLeft: 20,
          paddingRight: 20,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 48,
          boxSizing: "border-box",
        }}
      >
        {/* Left column */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{
            width: 514,
            flexShrink: 0,
            paddingTop: 40,
            paddingBottom: 40,
            display: "flex",
            flexDirection: "column",
            gap: 15,
          }}
          className="atendimento-left"
        >
          <img
            src={logoHorizontalWhite}
            alt="Provider Mais Fibra"
            style={{ width: 317, height: 55, display: "block", objectFit: "contain", alignSelf: "flex-start" }}
          />

          <h2
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 400,
              fontSize: 32,
              lineHeight: "37.76px",
              color: "#FFFFFF",
              margin: 0,
            }}
          >
            Atendimento r&aacute;pido e direto pelo{" "}
            <span style={{ fontWeight: 600, color: "#95EB1D" }}>WhatsApp</span>
          </h2>

          <p
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 400,
              fontSize: 16,
              lineHeight: "32px",
              color: "#FFFFFF",
              margin: 0,
            }}
          >
            Fale com nossa equipe pelo WhatsApp e resolva tudo em poucos
            minutos. Atendimento humanizado para clientes e novos assinantes,
            com suporte completo para sua internet fibra.
          </p>
        </motion.div>

        {/* Right column — image */}
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{
            width: 619,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          className="atendimento-right"
        >
          <img
            src={atendimentoImage}
            alt="Atendimento via WhatsApp"
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              objectFit: "contain",
            }}
          />
        </motion.div>
      </div>

      <style>{`
        @media (max-width: 1023px) {
          .atendimento-container {
            flex-direction: column !important;
            gap: 32px !important;
            padding-top: 40px !important;
            padding-bottom: 40px !important;
          }
          .atendimento-left, .atendimento-right {
            width: 100% !important;
            max-width: 619px !important;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
          }
        }
      `}</style>
    </section>
  );
}
