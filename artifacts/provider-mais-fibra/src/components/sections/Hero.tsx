import { motion } from "framer-motion";
import { MessageCircle, ChevronDown } from "lucide-react";

const streamingBadges = ["WATCH", "Paramount+", "TELECINE"];

export default function Hero() {
  const scrollToPlans = () => {
    const el = document.getElementById("planos");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      data-testid="hero-section"
      className="relative flex items-center overflow-hidden pt-16"
      style={{ background: "linear-gradient(135deg, #002D75 0%, #0055B8 100%)", minHeight: "100vh" }}
    >
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `radial-gradient(ellipse at 20% 50%, #FFD600 0%, transparent 50%),
            radial-gradient(ellipse at 80% 20%, #0099FF 0%, transparent 50%)`,
        }}
      />

      <div
        className="absolute top-0 right-0 w-1/2 h-full opacity-5"
        style={{
          backgroundImage: `repeating-linear-gradient(
            60deg,
            transparent,
            transparent 40px,
            rgba(255,255,255,0.3) 40px,
            rgba(255,255,255,0.3) 41px
          )`,
        }}
      />

      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16 py-20 w-full relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold mb-6"
              style={{ background: "rgba(255,214,0,0.15)", border: "1px solid rgba(255,214,0,0.3)" }}
            >
              <span className="w-2 h-2 rounded-full bg-[#FFD600] animate-pulse" />
              <span className="text-[#FFD600]">Internet de Alta Velocidade</span>
            </div>

            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-4"
              style={{ letterSpacing: "-0.02em" }}
            >
              Internet Mais Fibra
              <br />
              <span style={{ color: "#FFD600" }}>Para Você</span>
            </h1>

            <p className="text-white/70 text-lg font-medium mb-8">
              + Conteúdo para toda a família
            </p>

            <div
              className="inline-block p-5 rounded-xl mb-8"
              style={{
                background: "rgba(0,0,0,0.25)",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              <div className="flex items-baseline gap-2 mb-1">
                <span
                  className="text-6xl font-black leading-none"
                  style={{ color: "#FFD600", letterSpacing: "-0.02em" }}
                >
                  600
                </span>
                <span className="text-2xl font-bold text-white">MEGA</span>
              </div>
              <p className="text-white/70 text-sm mb-2">Wi-Fi 6 incluso</p>
              <p className="text-white text-lg font-semibold">
                a partir de{" "}
                <span className="text-[#FFD600] font-black text-2xl">R$ 99,90</span>
                <span className="text-white/60 text-sm">/mês</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2 mb-8">
              {streamingBadges.map((badge) => (
                <span
                  key={badge}
                  className="px-3 py-1 rounded-full text-xs font-bold text-white"
                  style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)" }}
                >
                  {badge}
                </span>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={scrollToPlans}
                data-testid="hero-cta-plans"
                className="px-8 py-4 rounded-lg font-bold text-base text-[#0D0E14] transition-all duration-200 hover:scale-105 active:scale-95"
                style={{
                  background: "linear-gradient(90deg, #FF8C00 0%, #FFD600 100%)",
                  boxShadow: "0 4px 12px rgba(255,140,0,0.35)",
                }}
              >
                Ver Planos
              </button>
              <a
                href="https://wa.me/5577998444757"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="hero-cta-whatsapp"
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-lg font-bold text-base text-white transition-all duration-200 hover:bg-white/20"
                style={{ border: "2px solid rgba(255,255,255,0.5)" }}
              >
                <MessageCircle size={20} />
                Falar no WhatsApp
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: 40 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
            className="hidden lg:flex justify-center items-center"
          >
            <div className="relative">
              <div
                className="relative rounded-2xl overflow-hidden"
                style={{
                  width: 420,
                  height: 480,
                  background: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)",
                  border: "1px solid rgba(255,255,255,0.2)",
                }}
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8 text-center">
                  <div
                    className="w-24 h-24 rounded-full flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #FFD600 0%, #FF8C00 100%)" }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="w-12 h-12 text-[#002D75]" stroke="currentColor" strokeWidth="2">
                      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
                      <path d="M9 12l2 2 4-4" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white/60 text-sm font-medium mb-1">Conectividade Premium</p>
                    <div className="flex items-center gap-3 justify-center mb-4">
                      {["Família", "Home Office", "Games", "Streaming"].map((tag) => (
                        <span
                          key={tag}
                          className="text-xs text-white/80 font-semibold px-2 py-1 rounded-full"
                          style={{ background: "rgba(255,255,255,0.1)" }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 w-full">
                    {[
                      { label: "Velocidade", value: "900 Mega" },
                      { label: "Wi-Fi", value: "Wi-Fi 6" },
                      { label: "Latência", value: "<5ms" },
                      { label: "Uptime", value: "99.9%" },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-xl p-3 text-center"
                        style={{ background: "rgba(255,255,255,0.1)" }}
                      >
                        <p className="text-xl font-black" style={{ color: "#FFD600" }}>
                          {stat.value}
                        </p>
                        <p className="text-white/60 text-xs font-medium">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <button
        onClick={scrollToPlans}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/50 hover:text-white/80 transition-colors animate-bounce"
        aria-label="Rolar para planos"
      >
        <ChevronDown size={32} />
      </button>
    </section>
  );
}
