import { useState } from "react";
import { motion } from "framer-motion";
import { Check, X, MessageCircle, ChevronDown, ChevronUp } from "lucide-react";
import { plans, buildWhatsAppUrl, ALL_INCLUSIONS } from "../../lib/plans";

function PlanCard({ plan, index, idSuffix = "" }: { plan: typeof plans[0]; index: number; idSuffix?: string }) {
  const whatsappUrl = buildWhatsAppUrl(plan);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      data-testid={`plan-card-${plan.speed}${idSuffix}`}
      className="relative flex flex-col rounded-xl transition-all duration-300 hover:-translate-y-1 h-full"
      style={{
        border: plan.featured ? "2px solid #0055B8" : "1px solid #E8EAEF",
        boxShadow: plan.featured
          ? "0 8px 24px rgba(0,85,184,0.15)"
          : "0 2px 8px rgba(0,0,0,0.08)",
        background: plan.featured ? "linear-gradient(180deg, #F0F5FF 0%, #FFFFFF 100%)" : "#FFFFFF",
      }}
    >
      {plan.featured && plan.badge && (
        <div
          className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1 rounded-full text-xs font-black text-[#0D0E14] tracking-wide whitespace-nowrap"
          style={{
            background: "linear-gradient(90deg, #FF8C00 0%, #FFD600 100%)",
            boxShadow: "0 4px 12px rgba(255,140,0,0.35)",
          }}
        >
          {plan.badge}
        </div>
      )}

      <div className={`p-6 ${plan.featured ? "pt-8" : ""} flex flex-col flex-1`}>
        <div className="text-center mb-6">
          <div
            className="text-7xl font-black leading-none mb-1"
            style={{ color: "#FFD600", letterSpacing: "-0.02em", textShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          >
            {plan.speed}
          </div>
          <div className="text-lg font-bold text-[#003F99]">MEGA</div>
          <div
            className="inline-block mt-2 px-3 py-0.5 rounded-full text-xs font-semibold text-white"
            style={{ background: "#003F99" }}
          >
            {plan.wifi}
          </div>
        </div>

        <ul className="space-y-2 mb-6 flex-1">
          {plan.inclusions.map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm text-[#4A4F61]">
              <Check size={16} className="flex-shrink-0" style={{ color: "#00A86B" }} />
              {item}
            </li>
          ))}
        </ul>

        <div className="text-center mb-5">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-sm font-semibold text-[#4A4F61]">R$</span>
            <span
              className="font-black"
              style={{
                fontSize: 38,
                color: "#003F99",
                letterSpacing: "-0.02em",
              }}
            >
              {plan.price}
            </span>
            <span className="text-sm text-[#B0B5C3] font-medium">/mês</span>
          </div>
        </div>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid={`plan-cta-${plan.speed}${idSuffix}`}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-lg font-bold text-sm transition-all duration-200 hover:scale-105 active:scale-95"
          style={
            plan.featured
              ? {
                  background: "linear-gradient(90deg, #FF8C00 0%, #FFD600 100%)",
                  color: "#0D0E14",
                  boxShadow: "0 4px 12px rgba(255,140,0,0.35)",
                }
              : {
                  background: "#003F99",
                  color: "white",
                }
          }
        >
          <MessageCircle size={16} />
          Assinar Agora
        </a>
      </div>
    </motion.div>
  );
}

function ComparisonTable() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="mt-14 overflow-x-auto"
    >
      <h3 className="text-center text-xl font-bold text-[#003F99] mb-6">Comparativo de Planos</h3>
      <table className="w-full border-collapse text-sm" style={{ minWidth: 560 }}>
        <thead>
          <tr>
            <th className="text-left py-3 px-4 text-[#4A4F61] font-semibold border-b border-[#E8EAEF]">Recurso</th>
            {plans.map((plan) => (
              <th
                key={plan.speed}
                className="py-3 px-4 text-center font-black border-b border-[#E8EAEF]"
                style={{ color: plan.featured ? "#0055B8" : "#003F99" }}
              >
                {plan.speed} MEGA
                {plan.badge && (
                  <span
                    className="block text-[10px] font-black mt-0.5 px-2 py-0.5 rounded-full mx-auto w-fit"
                    style={{ background: "linear-gradient(90deg,#FF8C00,#FFD600)", color: "#0D0E14" }}
                  >
                    {plan.badge}
                  </span>
                )}
              </th>
            ))}
          </tr>
          <tr>
            <td className="py-2 px-4 text-[#4A4F61] border-b border-[#E8EAEF] font-medium">Preço/mês</td>
            {plans.map((plan) => (
              <td key={plan.speed} className="py-2 px-4 text-center font-black text-[#003F99] border-b border-[#E8EAEF]">
                R${plan.price}
              </td>
            ))}
          </tr>
          <tr style={{ background: "#F8F9FC" }}>
            <td className="py-2 px-4 text-[#4A4F61] border-b border-[#E8EAEF] font-medium">Wi-Fi</td>
            {plans.map((plan) => (
              <td key={plan.speed} className="py-2 px-4 text-center text-[#4A4F61] border-b border-[#E8EAEF]">
                {plan.wifi}
              </td>
            ))}
          </tr>
        </thead>
        <tbody>
          {ALL_INCLUSIONS.map((feature, i) => (
            <tr key={feature} style={{ background: i % 2 === 0 ? "#FFFFFF" : "#F8F9FC" }}>
              <td className="py-2 px-4 text-[#4A4F61] border-b border-[#E8EAEF]">{feature}</td>
              {plans.map((plan) => (
                <td key={plan.speed} className="py-2 px-4 text-center border-b border-[#E8EAEF]">
                  {plan.inclusions.includes(feature) ? (
                    <Check size={18} className="mx-auto" style={{ color: "#00A86B" }} />
                  ) : (
                    <X size={18} className="mx-auto text-[#D0D4E0]" />
                  )}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td className="py-3 px-4 border-t border-[#E8EAEF]" />
            {plans.map((plan) => (
              <td key={plan.speed} className="py-3 px-4 text-center border-t border-[#E8EAEF]">
                <a
                  href={buildWhatsAppUrl(plan)}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`plan-table-cta-${plan.speed}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold text-xs transition-all duration-200 hover:scale-105 active:scale-95"
                  style={
                    plan.featured
                      ? {
                          background: "linear-gradient(90deg,#FF8C00,#FFD600)",
                          color: "#0D0E14",
                          boxShadow: "0 4px 12px rgba(255,140,0,0.3)",
                        }
                      : { background: "#003F99", color: "white" }
                  }
                >
                  <MessageCircle size={13} />
                  Assinar
                </a>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </motion.div>
  );
}

export default function Plans() {
  const [showTable, setShowTable] = useState(false);

  return (
    <section
      id="planos"
      data-testid="plans-section"
      className="py-20 bg-white"
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-[#003F99] mb-3">
            Escolha o Plano Ideal Para Você
          </h2>
          <p className="text-[#4A4F61] text-base">
            Instalação + Roteador + IPTV inclusos em todos os planos
          </p>
        </motion.div>

        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan, i) => (
            <PlanCard key={plan.speed} plan={plan} index={i} />
          ))}
        </div>

        <div
          className="flex sm:hidden gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory scroll-smooth"
          style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
        >
          {plans.map((plan, i) => (
            <div
              key={plan.speed}
              className="flex-none w-[80vw] max-w-[300px] snap-center pt-5"
            >
              <PlanCard plan={plan} index={i} idSuffix="-mobile" />
            </div>
          ))}
        </div>

        <p className="sm:hidden text-center text-xs text-[#B0B5C3] mt-3">
          ← Deslize para ver todos os planos →
        </p>

        <div className="mt-10 text-center">
          <button
            onClick={() => setShowTable((v) => !v)}
            data-testid="toggle-comparison-table"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border font-semibold text-sm transition-all duration-200 hover:bg-[#F0F5FF]"
            style={{ border: "1.5px solid #003F99", color: "#003F99" }}
          >
            {showTable ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {showTable ? "Ocultar Comparativo" : "Ver Comparativo de Planos"}
          </button>
        </div>

        {showTable && <ComparisonTable />}
      </div>
    </section>
  );
}
