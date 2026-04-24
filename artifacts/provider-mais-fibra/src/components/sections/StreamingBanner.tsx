import { motion } from "framer-motion";
import { Play } from "lucide-react";

const platforms = [
  { name: "WATCH", color: "#00D4FF" },
  { name: "Paramount+", color: "#0064FF" },
  { name: "TELECINE", color: "#E50914" },
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
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(ellipse at 70% 30%, #7B2FBE 0%, transparent 60%),
              radial-gradient(ellipse at 30% 70%, #E91E8C 0%, transparent 60%)`,
          }}
        />
      </div>

      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,1) 2px, rgba(255,255,255,1) 3px)",
          backgroundSize: "100% 6px",
        }}
      />

      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
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

          <p className="text-white/60 text-lg mb-10">
            Streaming incluso nos planos a partir de 600 Mega
          </p>

          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {platforms.map((platform) => (
              <motion.div
                key={platform.name}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4 }}
                className="px-8 py-4 rounded-xl font-black text-xl tracking-tight"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: platform.color,
                  backdropFilter: "blur(10px)",
                }}
              >
                {platform.name}
              </motion.div>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {["Filmes", "Séries", "Documentários", "Esportes", "Infantil"].map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full text-xs font-semibold text-white/70"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                {tag}
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
      </div>
    </section>
  );
}
