import { motion } from "framer-motion";
import { Check, MessageCircle } from "lucide-react";

const plans = [
  {
    speed: "300",
    wifi: "Wi-Fi",
    price: "69,90",
    inclusions: ["Instalação Grátis", "Roteador Wi-Fi", "IPTV"],
    featured: false,
  },
  {
    speed: "400",
    wifi: "Wi-Fi",
    price: "79,90",
    inclusions: ["Instalação Grátis", "Roteador Wi-Fi", "IPTV"],
    featured: false,
  },
  {
    speed: "600",
    wifi: "Wi-Fi 6",
    price: "99,90",
    inclusions: ["Instalação Grátis", "Roteador Wi-Fi 6", "IPTV", "WATCH"],
    featured: true,
    badge: "MAIS VENDIDO",
  },
  {
    speed: "900",
    wifi: "Wi-Fi 6",
    price: "149,90",
    inclusions: ["Instalação Grátis", "Roteador Wi-Fi 6", "IPTV", "WATCH", "Power Top"],
    featured: false,
  },
];

export default function Plans() {
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.speed}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              data-testid={`plan-card-${plan.speed}`}
              className="relative flex flex-col rounded-xl transition-all duration-300 hover:-translate-y-1"
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
                        color: plan.featured ? "#003F99" : "#003F99",
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {plan.price}
                    </span>
                    <span className="text-sm text-[#B0B5C3] font-medium">/mês</span>
                  </div>
                </div>

                <a
                  href="https://wa.me/5577998444757"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`plan-cta-${plan.speed}`}
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
          ))}
        </div>
      </div>
    </section>
  );
}
