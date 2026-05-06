import { motion } from "framer-motion";
import { Tv, MessageCircle } from "lucide-react";
import { WHATSAPP_NUMBER } from "../../lib/plans";

const channels = [
  "Globoplay", "SBT", "Terraviva", "Claro", "Multishow",
  "BIS", "ESPN", "GNT", "Universal", "Gazeta",
];

export default function ComboPowerTop() {
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Olá! Quero contratar o Combo Power Top 900 Mega por R$ 139,90/mês")}`;

  return (
    <section
      id="combo"
      data-testid="combo-section"
      className="relative overflow-hidden py-20 sm:py-24"
      style={{ background: "linear-gradient(135deg, #001050 0%, #001A6E 60%, #0040FF 100%)" }}
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(ellipse at 50% 0%, rgba(0,192,64,0.18) 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, rgba(26,95,255,0.4) 0%, transparent 50%)",
        }}
      />

      <div className="relative z-10 max-w-[1100px] mx-auto px-4 sm:px-8 lg:px-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-[0.2em] mb-6"
            style={{ background: "#00C040", color: "white", boxShadow: "0 8px 24px rgba(0,192,64,0.4)" }}
          >
            <Tv size={12} />
            Combo Power Top
          </div>

          <h2
            className="text-white font-bold leading-[1.1] mb-4 max-w-3xl mx-auto"
            style={{ fontSize: "clamp(28px, 4.5vw, 48px)", letterSpacing: "-0.025em" }}
          >
            Alterne entre seus streamings favoritos e tenha{" "}
            <span className="text-accent-green font-black">3 pelo preço de 1</span>
          </h2>

          <div className="flex items-baseline justify-center gap-3 my-8 flex-wrap">
            <span
              className="font-black leading-none"
              style={{ fontSize: "clamp(72px, 10vw, 128px)", color: "#FFFFFF", letterSpacing: "-0.04em" }}
            >
              900
            </span>
            <span className="text-3xl sm:text-4xl font-bold text-white">Mega</span>
          </div>

          <p className="text-white/80 text-sm sm:text-base font-semibold uppercase tracking-wider mb-8">
            + Mais Pacotes de Canais Exclusivos · <span className="text-[#00D94A]">WATCH</span> + <span className="text-[#00D94A]">POWER TOP</span>
          </p>

          <div className="flex flex-wrap justify-center gap-2 mb-10 max-w-2xl mx-auto">
            {channels.map((c) => (
              <span
                key={c}
                className="px-3 py-1.5 rounded-full text-xs font-semibold text-white"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)", backdropFilter: "blur(4px)" }}
              >
                {c}
              </span>
            ))}
          </div>

          <div
            className="inline-flex flex-col items-center gap-3 px-8 py-6 rounded-2xl mb-8"
            style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.15)" }}
          >
            <p className="text-white/60 text-xs font-bold uppercase tracking-[0.2em]">Por apenas</p>
            <div className="flex items-baseline gap-1">
              <span className="text-white text-xl font-bold">R$</span>
              <span
                className="font-black text-white leading-none"
                style={{ fontSize: "clamp(48px, 7vw, 80px)", letterSpacing: "-0.03em" }}
              >
                139,90
              </span>
              <span className="text-white/70 text-base font-medium">/mês</span>
            </div>
          </div>

          <div>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="combo-cta"
              className="inline-flex items-center gap-2 px-9 py-4 rounded-full font-bold text-base text-[#001A6E] transition-all duration-200 hover:scale-105 active:scale-95"
              style={{ background: "white", boxShadow: "0 12px 30px rgba(255,255,255,0.25)" }}
            >
              <MessageCircle size={18} />
              Contrate Já e Aproveite
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
