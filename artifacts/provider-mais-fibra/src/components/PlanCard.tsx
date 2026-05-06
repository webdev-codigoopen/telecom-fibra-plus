import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { type Plan, buildWhatsAppUrl } from "../lib/plans";

type Props = {
  plan: Plan;
  index?: number;
  idSuffix?: string;
};

export default function PlanCard({ plan, index = 0, idSuffix = "" }: Props) {
  const whatsappUrl = buildWhatsAppUrl(plan);
  const isFeatured = plan.featured;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08, duration: 0.45 }}
      data-testid={`plan-card-${plan.speed}${idSuffix}`}
      className="relative flex flex-col h-full rounded-2xl bg-white text-[#0D0D0D] transition-all duration-300 hover:-translate-y-1"
      style={{
        border: isFeatured ? "2px solid #00C040" : "1px solid rgba(0,0,0,0.08)",
        boxShadow: isFeatured
          ? "0 16px 40px rgba(0,192,64,0.25)"
          : "0 8px 24px rgba(0,0,0,0.10)",
      }}
    >
      {isFeatured && plan.badge && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[11px] font-black tracking-wide uppercase whitespace-nowrap text-white"
          style={{ background: "#00C040", boxShadow: "0 4px 12px rgba(0,192,64,0.35)" }}
        >
          {plan.badge}
        </div>
      )}

      <div className="p-6 flex flex-col flex-1">
        <div
          className="inline-flex self-start items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wide mb-5"
          style={{ background: "#D6E4FF", color: "#0040FF" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#0040FF]" />
          INTERNET 100% FIBRA
        </div>

        <div className="mb-5">
          <div className="flex items-baseline gap-2 leading-none">
            <span
              className="font-black text-[#0040FF]"
              style={{ fontSize: 64, letterSpacing: "-0.03em" }}
            >
              {plan.speed}
            </span>
            <span className="text-lg font-bold text-[#0D0D0D]">Mega</span>
          </div>
          <p className="text-xs text-[#666666] mt-1 font-medium">{plan.wifi}</p>
        </div>

        <ul className="space-y-2 mb-5 flex-1">
          {plan.inclusions.map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm text-[#333333]">
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
            className="text-[10px] font-black tracking-wide uppercase px-3 py-1.5 rounded-md mb-4 text-center"
            style={{ background: "#001A6E", color: "#FFD700" }}
          >
            {plan.bonus}
          </div>
        )}

        <div className="mb-5">
          <div className="flex items-start gap-1">
            <span className="text-sm font-semibold text-[#666666] mt-2">R$</span>
            <span
              className="font-black text-[#0D0D0D] leading-none"
              style={{ fontSize: 40, letterSpacing: "-0.02em" }}
            >
              {plan.price.split(",")[0]}
            </span>
            <span className="font-black text-[#0D0D0D] text-lg leading-none mt-1">
              ,{plan.price.split(",")[1] ?? "00"}
            </span>
            <span className="text-sm text-[#666666] font-medium self-end mb-1">/mês</span>
          </div>
        </div>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid={`plan-cta-${plan.speed}${idSuffix}`}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-full font-bold text-sm text-white transition-all duration-200 hover:scale-[1.02] active:scale-95"
          style={{ background: "#00C040", boxShadow: "0 6px 16px rgba(0,192,64,0.35)" }}
        >
          <MessageCircle size={16} />
          Quero esse plano
        </a>

        <p className="text-[10px] text-[#999999] text-center mt-3 italic">
          *Consultar disponibilidade na sua cidade
        </p>
      </div>
    </motion.div>
  );
}
