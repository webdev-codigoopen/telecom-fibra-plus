import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";

export default function FinalCTA() {
  const scrollToPlans = () => {
    const el = document.getElementById("planos");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      id="contato"
      data-testid="cta-final-section"
      className="py-24 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #002D75 0%, #0055B8 100%)" }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(ellipse at 20% 50%, rgba(255,214,0,0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 50%, rgba(255,140,0,0.05) 0%, transparent 50%)`,
        }}
      />

      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold mb-8"
            style={{ background: "rgba(255,214,0,0.15)", border: "1px solid rgba(255,214,0,0.3)" }}
          >
            <span className="w-2 h-2 rounded-full bg-[#FFD600] animate-pulse" />
            <span className="text-[#FFD600]">Disponivel agora</span>
          </div>

          <h2
            className="text-3xl sm:text-5xl font-black text-white mb-4 leading-tight"
            style={{ letterSpacing: "-0.02em" }}
          >
            Pronto para se Conectar
            <br />
            com <span style={{ color: "#FFD600" }}>Mais Fibra?</span>
          </h2>

          <p className="text-white/70 text-lg mb-10">
            Fale com nossa equipe agora e assine hoje mesmo.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://wa.me/5577998444757"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="final-cta-whatsapp"
              className="flex items-center gap-3 px-8 py-4 rounded-lg font-bold text-base text-[#0D0E14] transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                background: "linear-gradient(90deg, #FF8C00 0%, #FFD600 100%)",
                boxShadow: "0 4px 12px rgba(255,140,0,0.45)",
              }}
            >
              <MessageCircle size={20} />
              Falar no WhatsApp
            </a>
            <button
              onClick={scrollToPlans}
              data-testid="final-cta-plans"
              className="flex items-center gap-2 px-8 py-4 rounded-lg font-bold text-base text-white transition-all duration-200 hover:bg-white/15"
              style={{ border: "2px solid rgba(255,255,255,0.4)" }}
            >
              Ver Todos os Planos
            </button>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-8">
            {["Instalação Grátis", "Sem Taxa de Fidelidade", "Suporte 24h", "Fibra 100%"].map((item) => (
              <div key={item} className="flex items-center gap-2 text-white/60 text-sm font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00A86B]" />
                {item}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
