import { motion } from "framer-motion";
import { Headphones, Heart, Zap } from "lucide-react";

function WhatsAppGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

const attrs = [
  { icon: WhatsAppGlyph, label: "Atendimento via WhatsApp" },
  { icon: Heart, label: "Atendimento humanizado" },
  { icon: Zap, label: "Soluções rápidas" },
];

export default function WhatsAppSection() {
  return (
    <section
      id="whatsapp"
      data-testid="whatsapp-section"
      className="relative overflow-hidden py-20 sm:py-24"
      style={{ background: "linear-gradient(180deg, #001050 0%, #001A6E 100%)" }}
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(ellipse at 80% 30%, rgba(37,211,102,0.15) 0%, transparent 50%)",
        }}
      />

      <div className="relative z-10 max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-5"
              style={{ background: "rgba(37,211,102,0.15)", color: "#25D366", border: "1px solid rgba(37,211,102,0.35)" }}
            >
              <Headphones size={12} />
              Atendimento Direto
            </div>
            <h2
              className="text-white font-bold leading-[1.1] mb-5"
              style={{ fontSize: "clamp(30px, 4.5vw, 48px)", letterSpacing: "-0.025em" }}
            >
              Atendimento rápido e direto pelo{" "}
              <span style={{ color: "#25D366" }} className="font-black">WhatsApp</span>
            </h2>
            <p className="text-white/75 text-base leading-relaxed mb-8">
              Fale com nossa equipe pelo WhatsApp e resolva tudo em poucos minutos. Atendimento humanizado para clientes e novos assinantes, com suporte completo para sua internet fibra.
            </p>

            <a
              href="https://wa.me/5577998444757"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="whatsapp-cta"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-base text-white transition-all duration-200 hover:scale-105"
              style={{ background: "#25D366", boxShadow: "0 12px 28px rgba(37,211,102,0.4)" }}
            >
              <WhatsAppGlyph size={20} />
              Falar no WhatsApp
            </a>

            <div className="flex flex-wrap gap-x-6 gap-y-3 mt-10">
              {attrs.map((a) => {
                const Icon = a.icon;
                return (
                  <div key={a.label} className="flex items-center gap-2">
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(0,192,64,0.2)", color: "#00D94A" }}
                    >
                      <Icon size={14} />
                    </span>
                    <span className="text-sm font-semibold text-white/85">{a.label}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Chat mockup */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="flex justify-center"
          >
            <div
              className="w-full max-w-sm rounded-3xl p-5 sm:p-6"
              style={{
                background: "linear-gradient(180deg, #25D366 0%, #128C7E 100%)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
              }}
            >
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/15">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-black text-sm">
                  P+
                </div>
                <div>
                  <p className="text-white font-bold text-sm">Provider Mais Fibra</p>
                  <p className="text-white/75 text-xs flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#00D94A] animate-pulse" />
                    Online · Responde em minutos
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%]">
                  <p className="text-[#0D0D0D] text-sm">Oi! Quero contratar o plano de 600 Mega 😊</p>
                  <p className="text-[10px] text-[#999] text-right mt-1">10:24</p>
                </div>
                <div
                  className="rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%] ml-auto"
                  style={{ background: "#DCF8C6" }}
                >
                  <p className="text-[#0D0D0D] text-sm">Olá! Que ótimo 🚀 Vou te ajudar agora mesmo. Em qual cidade você está?</p>
                  <p className="text-[10px] text-[#666] text-right mt-1">10:24 ✓✓</p>
                </div>
                <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%]">
                  <p className="text-[#0D0D0D] text-sm">Estou em Barreiras!</p>
                  <p className="text-[10px] text-[#999] text-right mt-1">10:25</p>
                </div>
                <div
                  className="rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[90%] ml-auto"
                  style={{ background: "#DCF8C6" }}
                >
                  <p className="text-[#0D0D0D] text-sm">Perfeito! Atendemos toda Barreiras com Wi-Fi 6 e Watch incluso. Posso agendar a instalação para amanhã 👍</p>
                  <p className="text-[10px] text-[#666] text-right mt-1">10:25 ✓✓</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
