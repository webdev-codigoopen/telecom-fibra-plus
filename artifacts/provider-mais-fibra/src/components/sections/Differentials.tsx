import { motion } from "framer-motion";
import { Wifi, Zap, Headphones, Package, ShieldCheck } from "lucide-react";

const items = [
  { icon: Wifi, label: "Fibra Óptica 100%" },
  { icon: Zap, label: "Instalação Rápida" },
  { icon: Headphones, label: "Suporte 24h no WhatsApp" },
  { icon: Package, label: "Equipamento Incluso" },
  { icon: ShieldCheck, label: "Homologado pela Anatel" },
];

export default function Differentials() {
  return (
    <section
      data-testid="differentials-section"
      className="bg-white border-b"
      style={{ borderColor: "#E8EAEF" }}
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16 py-6">
        <div className="flex flex-wrap justify-center items-center gap-0 divide-x divide-[#E8EAEF]">
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="flex items-center gap-3 px-6 py-4"
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "#003F99" }}
                >
                  <Icon size={16} color="white" />
                </div>
                <span className="text-sm font-bold text-[#4A4F61] whitespace-nowrap">
                  {item.label}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
