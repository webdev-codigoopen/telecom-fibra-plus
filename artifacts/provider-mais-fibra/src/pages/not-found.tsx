import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Home, MessageCircle, Wifi } from "lucide-react";
import SEO from "@/components/SEO";

export default function NotFound() {
  const [, navigate] = useLocation();

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden"
      style={{
        background:
          "radial-gradient(120% 80% at 50% 0%, #1A38D5 0%, #0A1995 55%, #050B4A 100%)",
      }}
    >
      <SEO
        title="Página não encontrada — Provider Mais Fibra"
        description="A página que você procura não existe ou foi movida. Volte para a Home da Provider Mais Fibra."
        path="/404"
        noindex
      />

      {/* Decorative glow */}
      <div
        aria-hidden
        className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-3xl opacity-30"
        style={{ background: "#95EB1D" }}
      />
      <div
        aria-hidden
        className="absolute bottom-[-200px] right-[-100px] w-[400px] h-[400px] rounded-full blur-3xl opacity-20"
        style={{ background: "#95EB1D" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 max-w-lg w-full text-center"
      >
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold mb-8"
          style={{
            background: "rgba(149,235,29,0.15)",
            border: "1px solid rgba(149,235,29,0.3)",
            color: "#95EB1D",
          }}
        >
          <Wifi size={12} />
          Provider Mais Fibra
        </div>

        <h1
          className="text-white font-black mb-4"
          style={{
            fontSize: "clamp(80px, 18vw, 160px)",
            lineHeight: 1,
            letterSpacing: "-0.04em",
            textShadow: "0 8px 32px rgba(149,235,29,0.25)",
          }}
        >
          4<span style={{ color: "#95EB1D" }}>0</span>4
        </h1>

        <h2
          className="text-2xl sm:text-3xl font-bold text-white mb-3"
          style={{ letterSpacing: "-0.01em" }}
        >
          Sinal perdido por aqui
        </h2>
        <p className="text-white/70 text-sm sm:text-base mb-10 max-w-md mx-auto">
          A página que você procura não existe, foi movida ou está fora do ar.
          Mas a sua conexão com a gente continua firme.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => {
              navigate("/");
              window.scrollTo({ top: 0 });
            }}
            data-testid="button-back-home"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-[#0D0E14] transition-all duration-200 hover:scale-105"
            style={{ background: "#95EB1D", boxShadow: "0 6px 20px rgba(149,235,29,0.35)" }}
          >
            <Home size={16} />
            Voltar para a Home
          </button>
          <a
            href="https://wa.me/5577998444757"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-whatsapp-404"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white transition-all duration-200 hover:bg-white/10"
            style={{ border: "1px solid rgba(255,255,255,0.25)" }}
          >
            <MessageCircle size={16} />
            Falar no WhatsApp
          </a>
        </div>
      </motion.div>
    </main>
  );
}
