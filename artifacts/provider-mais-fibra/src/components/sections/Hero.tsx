import { motion } from "framer-motion";
import { useRef, useState, useCallback } from "react";
import { usePlans } from "../../hooks/usePlans";
import PlanCard from "../PlanCard";

export default function Hero() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { plans } = usePlans();

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const children = Array.from(el.children) as HTMLElement[];
    const scrollMid = el.scrollLeft + el.clientWidth / 2;
    let closest = 0, minDist = Infinity;
    children.forEach((child, i) => {
      const cardMid = child.offsetLeft + child.offsetWidth / 2;
      const dist = Math.abs(scrollMid - cardMid);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    setActiveIndex(closest);
  }, []);

  const scrollToIndex = (i: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const children = Array.from(el.children) as HTMLElement[];
    const child = children[i];
    if (!child) return;
    el.scrollTo({ left: child.offsetLeft - (el.clientWidth - child.offsetWidth) / 2, behavior: "smooth" });
  };

  return (
    <section
      id="planos"
      data-testid="hero-section"
      className="relative overflow-hidden pt-28 pb-20"
      style={{ background: "linear-gradient(135deg, #001A6E 0%, #0040FF 100%)" }}
    >
      {/* Decorative radial overlay */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 20% 30%, rgba(0,192,64,0.25) 0%, transparent 55%), radial-gradient(ellipse at 85% 70%, rgba(26,95,255,0.5) 0%, transparent 55%)",
        }}
      />
      {/* Grid texture */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative z-10 max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-12"
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider mb-6"
            style={{ background: "rgba(0,192,64,0.15)", color: "#00D94A", border: "1px solid rgba(0,192,64,0.35)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#00D94A] animate-pulse" />
            Internet 100% Fibra Óptica
          </div>
          <h1
            className="text-white font-bold leading-[1.05] mb-5"
            style={{ fontSize: "clamp(34px, 5vw, 56px)", letterSpacing: "-0.025em" }}
          >
            A <span className="font-black" style={{ color: "#00D94A" }}>conexão</span> ideal para o seu dia a dia está na Provider
          </h1>
          <p className="text-white/75 text-base sm:text-lg max-w-2xl mx-auto">
            Escolha o plano que combina com você e tenha velocidade, estabilidade e suporte 24h via WhatsApp.
          </p>
        </motion.div>

        {/* Desktop grid */}
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
          {plans.map((plan, i) => (
            <PlanCard key={plan.speed} plan={plan} index={i} />
          ))}
        </div>

        {/* Mobile carousel */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex sm:hidden gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory scroll-smooth no-scrollbar pt-4"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {plans.map((plan, i) => (
            <div key={plan.speed} className="flex-none w-[82vw] max-w-[320px] snap-center">
              <PlanCard plan={plan} index={i} idSuffix="-mobile" />
            </div>
          ))}
        </div>

        <div className="flex sm:hidden items-center justify-center gap-2 mt-5" data-testid="pagination-dots">
          {plans.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollToIndex(i)}
              aria-label={`Ir para plano ${i + 1}`}
              data-testid={`pagination-dot-${i}`}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === activeIndex ? 22 : 8,
                height: 8,
                background: i === activeIndex ? "#00C040" : "rgba(255,255,255,0.35)",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
