import { motion } from "framer-motion";

const stats = [
  { value: "12", label: "Cidades Atendidas", suffix: "" },
  { value: "100", label: "Fibra Óptica", suffix: "%" },
  { value: "24", label: "Suporte", suffix: "h" },
  { value: "Anatel", label: "Homologado", suffix: "" },
];

export default function About() {
  return (
    <section
      id="sobre"
      data-testid="about-section"
      className="py-20 overflow-hidden"
      style={{ background: "linear-gradient(135deg, #002D75 0%, #0055B8 100%)" }}
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold mb-6"
              style={{ background: "rgba(255,214,0,0.15)", border: "1px solid rgba(255,214,0,0.3)" }}
            >
              <span className="w-2 h-2 rounded-full bg-[#FFD600]" />
              <span className="text-[#FFD600]">Quem Somos</span>
            </div>

            <h2
              className="text-3xl sm:text-4xl font-bold text-white mb-6"
              style={{ letterSpacing: "-0.01em" }}
            >
              Conectando o Oeste da Bahia com
              <span className="text-[#FFD600]"> Fibra de Qualidade</span>
            </h2>

            <p className="text-white/75 text-base leading-relaxed mb-6">
              A Provider Mais Fibra nasceu com a missão de levar internet de alta velocidade para o interior da Bahia. Com infraestrutura 100% em fibra óptica e foco no atendimento ao cliente, estamos presentes em 12 cidades do Oeste da Bahia, oferecendo conectividade confiável para famílias e empresas.
            </p>

            <p className="text-white/60 text-sm leading-relaxed">
              Homologados pela Anatel, garantimos qualidade de serviço, suporte técnico especializado e planos que cabem no bolso. Nossa equipe trabalha 24h para que sua conexão nunca pare.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="grid grid-cols-2 gap-5">
              {stats.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + i * 0.1, duration: 0.4 }}
                  className="flex flex-col items-center justify-center text-center rounded-2xl py-8 px-4"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  <div
                    className="text-4xl sm:text-5xl font-black mb-2 leading-none"
                    style={{ color: "#FFD600", letterSpacing: "-0.02em" }}
                  >
                    {stat.value}
                    {stat.suffix && <span className="text-2xl">{stat.suffix}</span>}
                  </div>
                  <p className="text-white/70 text-sm font-semibold">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
