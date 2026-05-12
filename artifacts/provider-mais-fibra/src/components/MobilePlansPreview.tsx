import { useCallback, useRef, useState } from "react";
import PlanCard from "./PlanCard";
import { type Plan } from "../lib/plans";

type Props = {
  plans: { id: number; plan: Plan }[];
  source?: string;
};

export default function MobilePlansPreview({ plans, source }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const children = Array.from(el.children) as HTMLElement[];
    const scrollMid = el.scrollLeft + el.clientWidth / 2;
    let closest = 0;
    let minDist = Infinity;
    children.forEach((child, i) => {
      const cardMid = child.offsetLeft + child.offsetWidth / 2;
      const dist = Math.abs(scrollMid - cardMid);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    });
    setActiveIndex(closest);
  }, []);

  const scrollToIndex = (i: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const children = Array.from(el.children) as HTMLElement[];
    const child = children[i];
    if (!child) return;
    el.scrollTo({
      left: child.offsetLeft - (el.clientWidth - child.offsetWidth) / 2,
      behavior: "smooth",
    });
  };

  return (
    <div className="flex flex-col items-center">
      <div
        className="rounded-[28px] border-[6px] border-[#0D0D0D] bg-[#0A1F8C] overflow-hidden shadow-xl"
        style={{ width: 360 }}
      >
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-4 overflow-x-auto px-4 py-5 snap-x snap-mandatory scroll-smooth no-scrollbar"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {plans.map(({ id, plan }, i) => (
            <div key={id} className="flex-none w-[295px] snap-center">
              <PlanCard
                plan={plan}
                index={i}
                idSuffix={`-preview-mobile-${id}`}
                source={source}
              />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-2 pb-4">
          {plans.map(({ id }, i) => (
            <button
              key={id}
              type="button"
              onClick={() => scrollToIndex(i)}
              aria-label={`Ir para plano ${i + 1}`}
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
    </div>
  );
}
