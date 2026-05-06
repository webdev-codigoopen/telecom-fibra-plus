import { motion } from "framer-motion";
import { Wifi, Zap, Smartphone } from "lucide-react";

const items = [
  {
    icon: Wifi,
    title: "Roteadores de Última Geração",
    desc: "Wi-Fi 6 nos planos 600 e 900 Mega para máxima performance em todos os dispositivos.",
  },
  {
    icon: Zap,
    title: "Velocidade Estável e Confiável",
    desc: "Fibra óptica dedicada com baixa latência, ideal para home office, games e streaming.",
  },
  {
    icon: Smartphone,
    title: "Conecte Todos os Dispositivos",
    desc: "Suporte a múltiplas conexões simultâneas sem perda de velocidade.",
  },
];

export default function Differentials() {
  return (
    <section
      id="diferenciais"
      data-testid="differentials-section"
      className="py-20 sm:py-24 bg-white border-t"
      style={{ borderColor: "rgba(0,0,0,0.06)" }}
    >
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14 max-w-2xl mx-auto"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0D0D0D] mb-3" style={{ letterSpacing: "-0.025em" }}>
            Por que escolher a <span className="text-[#0040FF] font-black">Provider</span> mais Fibra?
          </h2>
          <p className="text-[#666666] text-base">
            Tecnologia e qualidade que fazem a diferença
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="text-center p-8 rounded-2xl bg-white transition-all duration-300 hover:-translate-y-1"
                style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
                  style={{ background: "#00C040", boxShadow: "0 8px 20px rgba(0,192,64,0.25)" }}
                >
                  <Icon size={24} color="white" />
                </div>
                <h3 className="text-lg font-bold text-[#0D0D0D] mb-2">{item.title}</h3>
                <p className="text-sm text-[#666666] leading-relaxed">{item.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
