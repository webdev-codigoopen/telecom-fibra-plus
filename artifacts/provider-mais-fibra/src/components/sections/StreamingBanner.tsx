import { motion } from "framer-motion";
import { Play, Tv } from "lucide-react";

function WatchLogo() {
  return (
    <svg viewBox="0 0 120 40" className="h-8 w-auto" aria-label="WATCH">
      <rect width="120" height="40" rx="4" fill="#00D4FF" />
      <text x="60" y="27" textAnchor="middle" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="18" fill="#0A0A0A" letterSpacing="2">WATCH</text>
    </svg>
  );
}

function ParamountLogo() {
  return (
    <svg viewBox="0 0 160 40" className="h-8 w-auto" aria-label="Paramount+">
      <rect width="160" height="40" rx="4" fill="#0064FF" />
      <text x="80" y="26" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="700" fontSize="14" fill="white" letterSpacing="0.5">PARAMOUNT</text>
      <text x="145" y="20" textAnchor="middle" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="20" fill="#00CFFF">+</text>
    </svg>
  );
}

function TelecineLogo() {
  return (
    <svg viewBox="0 0 140 40" className="h-8 w-auto" aria-label="Telecine">
      <rect width="140" height="40" rx="4" fill="#E50914" />
      <text x="70" y="27" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="700" fontSize="16" fill="white" letterSpacing="1">TELECINE</text>
    </svg>
  );
}

const contentTags = [
  { label: "Filmes", icon: "🎬" },
  { label: "Séries", icon: "📺" },
  { label: "Documentários", icon: "🎥" },
  { label: "Esportes", icon: "⚽" },
  { label: "Infantil", icon: "🧸" },
];

export default function StreamingBanner() {
  const scrollToPlans = () => {
    const el = document.getElementById("planos");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      data-testid="streaming-section"
      className="relative py-24 overflow-hidden"
      style={{ background: "linear-gradient(180deg, #0D0E14 0%, #1A2240 100%)" }}
    >
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `radial-gradient(ellipse at 70% 30%, #7B2FBE 0%, transparent 60%),
            radial-gradient(ellipse at 30% 70%, #E91E8C 0%, transparent 60%)`,
        }}
      />

      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold mb-6"
              style={{ background: "rgba(123,47,190,0.3)", border: "1px solid rgba(123,47,190,0.5)" }}
            >
              <Play size={12} style={{ color: "#E91E8C" }} />
              <span style={{ color: "#E91E8C" }}>Entretenimento Premium</span>
            </div>

            <h2
              className="text-3xl sm:text-5xl font-black text-white mb-4 leading-tight"
              style={{ letterSpacing: "-0.02em" }}
            >
              Provider Mais Fibra +
              <br />
              <span
                style={{
                  background: "linear-gradient(90deg, #7B2FBE 0%, #E91E8C 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Entretenimento Completo
              </span>
            </h2>

            <p className="text-white/60 text-base mb-8">
              Streaming incluso nos planos a partir de 600 Mega. Acesse o melhor conteúdo sem sair de casa.
            </p>

            <div className="flex flex-wrap gap-2 mb-8">
              {contentTags.map((tag) => (
                <span
                  key={tag.label}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white/80"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  <span>{tag.icon}</span>
                  {tag.label}
                </span>
              ))}
            </div>

            <button
              onClick={scrollToPlans}
              data-testid="streaming-cta"
              className="px-8 py-4 rounded-lg font-bold text-base text-[#0D0E14] transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                background: "linear-gradient(90deg, #FF8C00 0%, #FFD600 100%)",
                boxShadow: "0 4px 12px rgba(255,140,0,0.35)",
              }}
            >
              Ver Planos com Streaming
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col gap-5"
          >
            <p className="text-white/40 text-xs font-semibold uppercase tracking-widest text-center lg:text-left">
              Plataformas Incluídas
            </p>

            <div className="grid grid-cols-1 gap-4">
              {[
                {
                  Logo: WatchLogo,
                  name: "WATCH",
                  desc: "Filmes e séries originais exclusivos",
                  bg: "rgba(0,212,255,0.08)",
                  border: "rgba(0,212,255,0.2)",
                },
                {
                  Logo: ParamountLogo,
                  name: "Paramount+",
                  desc: "Séries originais, filmes e esportes ao vivo",
                  bg: "rgba(0,100,255,0.08)",
                  border: "rgba(0,100,255,0.2)",
                },
                {
                  Logo: TelecineLogo,
                  name: "TELECINE",
                  desc: "O melhor do cinema em alta definição",
                  bg: "rgba(229,9,20,0.08)",
                  border: "rgba(229,9,20,0.25)",
                },
              ].map(({ Logo, name, desc, bg, border }) => (
                <motion.div
                  key={name}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4 }}
                  className="flex items-center gap-5 px-6 py-4 rounded-xl"
                  style={{
                    background: bg,
                    border: `1px solid ${border}`,
                  }}
                >
                  <div className="flex-shrink-0">
                    <Logo />
                  </div>
                  <div className="flex flex-col">
                    <p className="text-white font-bold text-sm">{name}</p>
                    <p className="text-white/50 text-xs">{desc}</p>
                  </div>
                  <div className="ml-auto">
                    <Tv size={16} style={{ color: "rgba(255,255,255,0.3)" }} />
                  </div>
                </motion.div>
              ))}
            </div>

            <div
              className="flex items-center gap-3 px-5 py-3 rounded-xl text-center"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="w-2 h-2 rounded-full bg-[#00A86B] animate-pulse flex-shrink-0" />
              <p className="text-white/50 text-xs">
                Acesso imediato após a ativação do plano. Conteúdo sujeito à disponibilidade das plataformas.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
