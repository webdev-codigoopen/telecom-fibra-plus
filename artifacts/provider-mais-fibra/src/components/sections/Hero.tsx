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
      className="plans-section relative overflow-hidden pt-24 pb-20"
      style={{
        background:
          "linear-gradient(180deg, #122AD5 0%, #1A38D5 60%, #2138CD 100%)",
        fontFamily: "'Nunito', 'Montserrat', system-ui, sans-serif",
      }}
    >
      <div className="relative z-10 max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-10"
        >
          <h2
            className="text-white leading-[1.25]"
            style={{
              fontSize: "clamp(20px, 2.4vw, 26px)",
              fontWeight: 600,
              letterSpacing: "-0.005em",
            }}
          >
            A <span style={{ fontWeight: 900 }}>conexão</span> ideal para o seu dia a dia está na{" "}
            <span style={{ fontWeight: 900 }}>Provider</span>
          </h2>
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
