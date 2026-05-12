import { motion } from "framer-motion";
import { Tv } from "lucide-react";
import { WHATSAPP_NUMBER } from "../../lib/plans";

type Brand = { name: string; bg: string; color: string };

const brands: Brand[] = [
  { name: "globoplay", bg: "#FF6B00", color: "white" },
  { name: "Telecine", bg: "#E11D2A", color: "white" },
  { name: "discovery+", bg: "#0066FF", color: "white" },
  { name: "MULTISHOW", bg: "#FFC400", color: "#001A6E" },
  { name: "ESPN", bg: "#D90000", color: "white" },
  { name: "GNT", bg: "#E91E63", color: "white" },
  { name: "Disney+", bg: "#0B1A4A", color: "white" },
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
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 50% 0%, rgba(0,192,64,0.18) 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, rgba(26,95,255,0.4) 0%, transparent 50%)",
        }}
      />
      {/* Grid pattern */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
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
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-[0.2em] mb-6 text-white"
            style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)" }}
          >
            <Tv size={12} />
            Combo Power Top
          </div>

          <h2
            className="text-white font-bold leading-[1.15] mb-8 max-w-3xl mx-auto"
            style={{ fontSize: "clamp(26px, 4vw, 42px)", letterSpacing: "-0.02em" }}
          >
            Alterne entre seus streamings favoritos e tenha{" "}
            <span className="text-accent-green font-black">3 pelo preço de 1</span>
          </h2>

          {/* 900 + Mega + WATCH/POWERTOP badges */}
          <div className="flex items-center justify-center gap-3 sm:gap-5 my-10 flex-wrap">
            <div className="flex items-baseline gap-2 leading-none">
              <span
                className="font-amino leading-none text-white"
                style={{ fontSize: "clamp(90px, 12vw, 160px)" }}
              >
                900
              </span>
              <span className="text-2xl sm:text-3xl font-bold text-white">+ Mega</span>
            </div>
            <div className="flex flex-col gap-1.5 items-start">
              <span
                className="px-3 py-1.5 rounded-md text-[11px] font-black tracking-wider text-white"
                style={{ background: "#00C040" }}
              >
                WATCH
              </span>
              <span
                className="px-3 py-1.5 rounded-md text-[11px] font-black tracking-wider text-white"
                style={{ background: "#001A6E", border: "1px solid rgba(255,255,255,0.2)" }}
              >
                + POWER TOP
              </span>
            </div>
          </div>

          {/* Streaming brand pills */}
          <div className="bg-white/95 rounded-full py-3 px-4 sm:px-6 mb-10 mx-auto max-w-3xl flex flex-wrap justify-center items-center gap-2 sm:gap-3 shadow-2xl">
            {brands.map((b) => (
              <span
                key={b.name}
                className="px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-black whitespace-nowrap"
                style={{ background: b.bg, color: b.color, letterSpacing: "0.02em" }}
              >
                {b.name}
              </span>
            ))}
          </div>

          <div className="mb-2 text-white/70 text-xs font-bold uppercase tracking-[0.2em]">Por apenas</div>
          <div className="flex items-baseline justify-center gap-1 mb-8">
            <span className="font-nexa text-white text-2xl">R$</span>
            <span
              className="font-nexa text-white leading-none"
              style={{ fontSize: "clamp(64px, 9vw, 96px)" }}
            >
              139
            </span>
            <span className="font-nexa text-white text-3xl sm:text-4xl leading-none">,90</span>
            <span className="text-white/70 text-base font-medium">/mês</span>
          </div>

          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="combo-cta"
            className="inline-flex items-center gap-2 px-9 py-4 rounded-full font-bold text-sm text-white uppercase tracking-wider transition-all duration-200 hover:scale-105 active:scale-95"
            style={{ background: "#00C040", boxShadow: "0 12px 30px rgba(0,192,64,0.45)" }}
          >
            Conhecer o Aplicativo
          </a>
        </motion.div>
      </div>
    </section>
  );
}
