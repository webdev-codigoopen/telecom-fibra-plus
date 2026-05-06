import { motion } from "framer-motion";
import { FileText, Zap, User, Headphones, Sparkles } from "lucide-react";

const features = [
  { icon: FileText, label: "2ª Via de Boleto", desc: "Acesse e pague sua fatura com 1 clique." },
  { icon: Zap, label: "Teste de Velocidade", desc: "Verifique sua conexão a qualquer momento." },
  { icon: User, label: "Área do Cliente", desc: "Gerencie sua conta de onde estiver." },
  { icon: Headphones, label: "Suporte via App", desc: "Atendimento rápido direto no aplicativo." },
];

export default function AppSection() {
  return (
    <section
      id="app"
      data-testid="app-section"
      className="py-20 sm:py-24"
      style={{ background: "#F4F4F4" }}
    >
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14 max-w-2xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 mb-3">
            <Sparkles size={18} style={{ color: "#00C040" }} />
            <span className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "#0040FF" }}>
              Aplicativo Provider
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0D0D0D] mb-3" style={{ letterSpacing: "-0.025em" }}>
            <span className="text-accent-green font-black">Facilidade</span> no Seu Dia a Dia
          </h2>
          <p className="text-[#666666] text-base">
            Gerencie sua internet direto pelo celular. Tudo que você precisa em um só lugar.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {features.map((feat, i) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={feat.label}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.45 }}
                className="p-6 rounded-2xl text-white transition-all duration-300 hover:-translate-y-1"
                style={{ background: "#001A6E", boxShadow: "0 8px 24px rgba(0,26,110,0.20)" }}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                  style={{ background: "#00C040", boxShadow: "0 4px 12px rgba(0,192,64,0.4)" }}
                >
                  <Icon size={20} color="white" />
                </div>
                <h3 className="text-base font-bold mb-1.5">{feat.label}</h3>
                <p className="text-sm text-white/70 leading-relaxed">{feat.desc}</p>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <p className="text-[#0D0D0D] font-bold text-base mb-4">Baixe agora o nosso Aplicativo</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="#"
              data-testid="app-google-play"
              className="flex items-center gap-3 px-6 py-3 rounded-full font-semibold text-sm text-white transition-all duration-200 hover:scale-105"
              style={{ background: "#0D0D0D" }}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                <path d="M3.18 23.76c.37.21.8.22 1.18.04l11.65-6.73L13.27 14l-10.09 9.76zM.75 1.13A1.35 1.35 0 0 0 .5 2v20a1.35 1.35 0 0 0 .25.87l.12.11L12.5 11.86v-.28L.87 1.02l-.12.11zM20.9 10.27l-3.27-1.89-3.27 3.18 3.27 3.18 3.3-1.9a1.36 1.36 0 0 0 0-2.57zM4.36.2 16 6.93l-2.74 2.63L3.18.2A1.34 1.34 0 0 0 4.36.2z" />
              </svg>
              <div className="text-left leading-tight">
                <p className="text-[10px] text-white/60">Disponível no</p>
                <p>Google Play</p>
              </div>
            </a>
            <a
              href="#"
              data-testid="app-apple-store"
              className="flex items-center gap-3 px-6 py-3 rounded-full font-semibold text-sm text-white transition-all duration-200 hover:scale-105"
              style={{ background: "#0D0D0D" }}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                <path d="M14.94 5.19A4.38 4.38 0 0 0 16 2a4.44 4.44 0 0 0-3 1.52 4.17 4.17 0 0 0-1 3.09 3.69 3.69 0 0 0 2.94-1.42zm2.52 7.44a4.51 4.51 0 0 1 2.16-3.81 4.66 4.66 0 0 0-3.66-2c-1.56-.16-3 .91-3.83.91s-2-.89-3.3-.87a4.92 4.92 0 0 0-4.14 2.53C2.86 12.29 4 17 5.93 19.51c.95 1.35 2.07 2.88 3.54 2.83s1.9-.9 3.57-.9 2.12.9 3.56.87 2.49-1.39 3.43-2.75a11 11 0 0 0 1.54-3.18 4.37 4.37 0 0 1-2.61-4.75z" />
              </svg>
              <div className="text-left leading-tight">
                <p className="text-[10px] text-white/60">Disponível na</p>
                <p>App Store</p>
              </div>
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
