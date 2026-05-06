import { motion } from "framer-motion";
import { type Plan, buildWhatsAppUrl } from "../lib/plans";

type Props = {
  plan: Plan;
  index?: number;
  idSuffix?: string;
};

export default function PlanCard({ plan, index = 0, idSuffix = "" }: Props) {
  const whatsappUrl = buildWhatsAppUrl(plan);
  const isFeatured = plan.featured;
  const [reais, centavos] = plan.price.split(",");

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08, duration: 0.45 }}
      data-testid={`plan-card-${plan.speed}${idSuffix}`}
      className="relative flex flex-col h-full rounded-2xl bg-white text-[#0D0D0D] transition-all duration-300 hover:-translate-y-1"
      style={{
        border: isFeatured ? "2px solid #00C040" : "1px solid rgba(0,0,0,0.06)",
        boxShadow: isFeatured
          ? "0 18px 44px rgba(0,192,64,0.30)"
          : "0 8px 22px rgba(0,0,0,0.08)",
      }}
    >
      {isFeatured && plan.badge && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-black tracking-[0.15em] uppercase whitespace-nowrap text-white"
          style={{ background: "#00C040", boxShadow: "0 4px 12px rgba(0,192,64,0.35)" }}
        >
          {plan.badge}
        </div>
      )}

      <div className="px-5 pt-5 pb-5 flex flex-col flex-1">
        <div className="flex items-start justify-between mb-3">
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wide"
            style={{ background: "#E8F0FF", color: "#0040FF" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#0040FF]" />
            INTERNET 100% FIBRA
          </div>
          <div
            className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] font-black"
            style={{ background: "#00C040", color: "white" }}
          >
            +100
          </div>
        </div>

        <div className="mb-1">
          <div className="flex items-baseline gap-1.5 leading-none">
            <span
              className="font-black text-[#0040FF]"
              style={{ fontSize: 56, letterSpacing: "-0.04em" }}
            >
              {plan.speed}
            </span>
            <span className="text-base font-bold text-[#0D0D0D]">Mega</span>
          </div>
          <p className="text-[11px] text-[#7A7F8C] mt-1 font-medium">{plan.wifi}</p>
        </div>

        <div className="h-px bg-[#EEF0F5] my-4" />

        <ul className="space-y-2 mb-4 flex-1">
          {plan.inclusions.map((item) => (
            <li key={item} className="flex items-center gap-2 text-[13px] text-[#2A2D38]">
              <span
                className="inline-flex items-center justify-center w-4 h-4 rounded-full flex-shrink-0"
                style={{ background: "#00C040" }}
              >
                <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              {item}
            </li>
          ))}
        </ul>

        {plan.bonus && (
          <div
            className="text-[9px] font-black tracking-[0.1em] uppercase px-2.5 py-2 rounded-lg mb-4 text-center text-white leading-tight"
            style={{ background: "linear-gradient(135deg, #001A6E 0%, #0040FF 100%)" }}
          >
            {plan.bonus}
          </div>
        )}

        <div className="mb-4">
          <div className="flex items-start gap-1">
            <span className="text-xs font-semibold text-[#666666] mt-2">R$</span>
            <span
              className="font-black text-[#0D0D0D] leading-none"
              style={{ fontSize: 36, letterSpacing: "-0.02em" }}
            >
              {reais}
            </span>
            <span className="font-black text-[#0D0D0D] text-base leading-none mt-1">
              ,{centavos ?? "00"}
            </span>
            <span className="text-xs text-[#666666] font-medium self-end mb-1">/mês</span>
          </div>
        </div>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid={`plan-cta-${plan.speed}${idSuffix}`}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-full font-bold text-[13px] text-white transition-all duration-200 hover:scale-[1.02] active:scale-95"
          style={{ background: "#00C040", boxShadow: "0 6px 16px rgba(0,192,64,0.35)" }}
        >
          Quero esse plano
        </a>

        <p className="text-[9px] text-[#999999] text-center mt-2.5 italic">
          *Consultar disponibilidade na sua cidade
        </p>
      </div>
    </motion.div>
  );
}
