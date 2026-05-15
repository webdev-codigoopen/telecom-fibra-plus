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
      className="plans-section relative overflow-hidden pt-[40px] md:pt-[40px]"
      style={{
        paddingBottom: 100,
        background:
          "linear-gradient(19.475deg, #122AD5 0%, #2138CD 50%, #2A41DB 100%)",
        fontFamily: "'Montserrat', system-ui, sans-serif",
      }}
    >
      <div className="relative z-10 max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-0">
        <div
          className="plans-heading text-center mx-auto pt-[0px] pb-[20px] mb-[0px] pl-[0px]"
          style={{ paddingTop: 21, paddingBottom: 21, marginBottom: 20 }}
        >
          <h2
            className="text-white"
            style={{
              fontFamily: "'Montserrat', system-ui, sans-serif",
              fontSize: 28,
              fontWeight: 400,
              lineHeight: "40px",
              letterSpacing: 0,
            }}
          >
            A <span style={{ fontWeight: 800 }}>conexão</span> ideal para o seu dia a dia está na{" "}
            <span style={{ fontWeight: 800 }}>Provider</span>
          </h2>
        </div>

        {/* Desktop grid — 4 cards × 295px + 3 × 20px gap = 1240px */}
        <div
          className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 justify-items-center"
          style={{ gap: 20 }}
        >
          {plans.map((plan, i) => (
            <PlanCard key={plan.speed} plan={plan} index={i} source="home-hero" />
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
            <div key={plan.speed} className="flex-none w-[295px] snap-center">
              <PlanCard plan={plan} index={i} idSuffix="-mobile" source="home-hero" />
            </div>
          ))}
        </div>

        <style>{`
          @media (max-width: 639px) {
            .plans-heading {
              padding-top: 8px !important;
              padding-bottom: 8px !important;
              margin-bottom: 4px !important;
            }
          }
        `}</style>

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
