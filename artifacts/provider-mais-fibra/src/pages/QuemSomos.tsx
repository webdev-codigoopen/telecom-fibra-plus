import { motion } from "framer-motion";
import { Shield, Wifi, Users, Headphones, Award, Zap } from "lucide-react";
import SEO from "@/components/SEO";
import Header from "@/components/sections/Header";
import Footer from "@/components/sections/Footer";
import WhatsAppFloat from "@/components/sections/WhatsAppFloat";
import logoVerticalWhite from "@assets/logo-provider+fibra-_vertical-branco_1777059547389.png";

const stats = [
  { value: "11", label: "Cidades Atendidas", suffix: "+" },
  { value: "100", label: "Fibra Óptica", suffix: "%" },
  { value: "24", label: "Suporte ao Cliente", suffix: "h" },
  { value: "2016", label: "Ano de Fundação", suffix: "" },
];

const values = [
  {
    icon: Shield,
    title: "Confiabilidade",
    desc: "Infraestrutura robusta com 99,9% de uptime garantido para que sua conexão nunca falhe nos momentos que mais importam.",
  },
  {
    icon: Wifi,
    title: "Inovação",
    desc: "Investimos continuamente em tecnologia de ponta, como fibra óptica e Wi-Fi 6, para oferecer sempre o melhor da conectividade.",
  },
  {
    icon: Users,
    title: "Proximidade",
    desc: "Somos da região e entendemos as necessidades locais. Nosso atendimento é humano, rápido e sempre próximo de você.",
  },
  {
    icon: Headphones,
    title: "Suporte Real",
    desc: "Equipe técnica especializada disponível 24 horas por dia via WhatsApp para resolver qualquer problema rapidamente.",
  },
  {
    icon: Award,
    title: "Qualidade",
    desc: "Homologados pela Anatel, seguimos os mais altos padrões de qualidade do setor de telecomunicações brasileiro.",
  },
  {
    icon: Zap,
    title: "Velocidade",
    desc: "Planos de até 900 Mbps com download e upload simétricos para uma experiência de internet sem limitações.",
  },
];

const milestones = [
  { year: "2016", title: "Fundação", desc: "A Provider Mais Fibra nasce com a missão de conectar o interior da Bahia com internet de qualidade." },
  { year: "2018", title: "Expansão Regional", desc: "Chegamos a 5 cidades do Oeste da Bahia, investindo em infraestrutura própria de fibra óptica." },
  { year: "2020", title: "Planos Gigabit", desc: "Lançamos nossos planos de alta velocidade com Wi-Fi 6 para atender home office e famílias conectadas." },
  { year: "2022", title: "IPTV e Streaming", desc: "Integramos serviços de entretenimento — TV e streaming — aos nossos planos de internet." },
  { year: "2024", title: "11 Cidades", desc: "Ampliamos nossa cobertura para 11 municípios, consolidando nossa presença em toda a região Oeste." },
];

export default function QuemSomos() {
  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title="Quem Somos — Provider Mais Fibra"
        description="Conheça a Provider Mais Fibra: provedor de internet 100% fibra óptica do Oeste da Bahia desde 2016, presente em 12 cidades com infraestrutura própria e atendimento humano."
        path="/quem-somos"
        keywords={[
          "Provider Mais Fibra",
          "história Provider Mais Fibra",
          "provedor de internet Oeste da Bahia",
          "empresa de internet Barreiras",
        ]}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: "Quem Somos — Provider Mais Fibra",
          url: "https://www.providermaisfibra.com.br/quem-somos",
          inLanguage: "pt-BR",
          about: { "@type": "Organization", name: "Provider Mais Fibra" },
        }}
      />
      <Header />

      <main id="main-content" tabIndex={-1} className="flex-1 pt-16 focus:outline-none">
        <section
          className="relative py-24 overflow-hidden"
          style={{ background: "linear-gradient(135deg, #0A1995 0%, #122AD5 100%)" }}
        >
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: "radial-gradient(ellipse at 80% 20%, #95EB1D 0%, transparent 50%), radial-gradient(ellipse at 20% 80%, #FF8C00 0%, transparent 50%)",
            }}
          />
          <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16 relative z-10">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
              >
                <div
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold mb-6"
                  style={{ background: "rgba(149,235,29,0.15)", border: "1px solid rgba(149,235,29,0.3)" }}
                >
                  <span className="w-2 h-2 rounded-full bg-[#95EB1D]" />
                  <span className="text-[#95EB1D]">Nossa História</span>
                </div>
                <h1
                  className="text-4xl sm:text-5xl font-black text-white mb-6 leading-tight"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  Conectando o Oeste da Bahia há mais de
                  <span style={{ color: "#95EB1D" }}> 8 anos</span>
                </h1>
                <p className="text-white/75 text-lg leading-relaxed mb-6">
                  A Provider Mais Fibra nasceu com uma missão simples: levar internet de alta velocidade e qualidade para o interior da Bahia, democratizando o acesso à conectividade para famílias e empresas da região.
                </p>
                <p className="text-white/60 text-base leading-relaxed">
                  Com infraestrutura 100% em fibra óptica e uma equipe comprometida, crescemos de uma cidade para 11 municípios, sempre com o mesmo cuidado e atenção ao cliente que nos trouxe até aqui.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="flex justify-center"
              >
                <div
                  className="p-10 rounded-3xl flex flex-col items-center"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
                >
                  <img src={logoVerticalWhite} alt="Provider Mais Fibra" className="h-40 w-auto mb-6" />
                  <p className="text-white/60 text-sm text-center">
                    Homologada pela Anatel · CNPJ 12.345.678/0001-99
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <section className="py-16" style={{ background: "#122AD5" }}>
          <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {stats.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  className="text-center"
                >
                  <div
                    className="text-4xl sm:text-5xl font-black mb-1 leading-none"
                    style={{ color: "#95EB1D", letterSpacing: "-0.02em" }}
                  >
                    {stat.value}
                    {stat.suffix && <span className="text-2xl sm:text-3xl">{stat.suffix}</span>}
                  </div>
                  <p className="text-white/70 text-sm font-semibold">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 bg-white">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center mb-14"
            >
              <h2 className="text-3xl sm:text-4xl font-bold text-[#122AD5] mb-3">
                Nossa Missão e Valores
              </h2>
              <p className="text-[#4A4F61] max-w-2xl mx-auto">
                O que nos move todos os dias a oferecer o melhor serviço para nossos clientes
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {values.map((v, i) => {
                const Icon = v.icon;
                return (
                  <motion.div
                    key={v.title}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className="p-7 rounded-xl group hover:-translate-y-1 transition-all duration-300"
                    style={{ border: "1px solid #E8EAEF", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
                      style={{ background: "#122AD5" }}
                    >
                      <Icon size={22} color="white" />
                    </div>
                    <h3 className="text-lg font-bold text-[#122AD5] mb-2">{v.title}</h3>
                    <p className="text-[#4A4F61] text-sm leading-relaxed">{v.desc}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="py-20" style={{ background: "#F5F6FA" }}>
          <div className="max-w-[900px] mx-auto px-4 sm:px-8 lg:px-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-14"
            >
              <h2 className="text-3xl sm:text-4xl font-bold text-[#122AD5] mb-3">Nossa Trajetória</h2>
              <p className="text-[#4A4F61]">Cada marco representa nosso compromisso com a região</p>
            </motion.div>

            <div className="relative">
              <div
                className="absolute left-6 top-0 bottom-0 w-0.5 hidden sm:block"
                style={{ background: "#E8EAEF" }}
              />
              <div className="space-y-8">
                {milestones.map((m, i) => (
                  <motion.div
                    key={m.year}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className="flex gap-6 items-start"
                  >
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-black text-white z-10"
                        style={{ background: "#122AD5" }}
                      >
                        {m.year.slice(2)}
                      </div>
                    </div>
                    <div
                      className="flex-1 p-5 rounded-xl mb-2"
                      style={{ background: "white", border: "1px solid #E8EAEF", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className="text-xs font-bold px-2 py-1 rounded"
                          style={{ background: "#E8F0FF", color: "#122AD5" }}
                        >
                          {m.year}
                        </span>
                        <h3 className="text-base font-bold text-[#0D0D0D]">{m.title}</h3>
                      </div>
                      <p className="text-[#4A4F61] text-sm leading-relaxed">{m.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          className="py-20"
          style={{ background: "linear-gradient(135deg, #0A1995 0%, #122AD5 100%)" }}
        >
          <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Quer fazer parte da nossa história?
              </h2>
              <p className="text-white/70 text-base mb-8">
                Assine agora e descubra por que somos a escolha de milhares de famílias no Oeste da Bahia.
              </p>
              <a
                href="https://wa.me/5577998444757"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-lg font-bold text-base text-[#0D0E14] transition-all duration-200 hover:scale-105"
                style={{ background: "#95EB1D", boxShadow: "0 4px 12px rgba(149,235,29,0.35)" }}
              >
                Falar com a Provider
              </a>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppFloat source="quem-somos-sticky" />
    </div>
  );
}
