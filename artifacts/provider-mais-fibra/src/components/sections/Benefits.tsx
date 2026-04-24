import { motion } from "framer-motion";
import { Wifi, Zap, Monitor } from "lucide-react";

const benefits = [
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
    icon: Monitor,
    title: "Conecte Todos os Dispositivos",
    desc: "Suporte a múltiplas conexões simultâneas sem perda de velocidade.",
  },
];

export default function Benefits() {
  return (
    <section
      data-testid="benefits-section"
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
            Por Que Escolher a Provider Mais Fibra?
          </h2>
          <p className="text-[#4A4F61]">Tecnologia e qualidade que fazem a diferença</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {benefits.map((benefit, i) => {
            const Icon = benefit.icon;
            return (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                className="flex flex-col items-center text-center p-8 rounded-xl transition-all duration-300 hover:-translate-y-1 group"
                style={{
                  border: "1px solid #E8EAEF",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110"
                  style={{ background: "#00A86B" }}
                >
                  <Icon size={28} color="white" />
                </div>
                <h3 className="text-xl font-bold text-[#003F99] mb-3">{benefit.title}</h3>
                <p className="text-[#4A4F61] text-sm leading-relaxed">{benefit.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
