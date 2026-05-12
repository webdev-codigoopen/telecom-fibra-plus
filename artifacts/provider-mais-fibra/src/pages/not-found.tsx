import { useLocation } from "wouter";
import { AlertCircle, Home } from "lucide-react";
import SEO from "@/components/SEO";
import Header from "@/components/sections/Header";
import Footer from "@/components/sections/Footer";

export default function NotFound() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title="Página não encontrada — Provider Mais Fibra"
        description="A página que você procura não existe ou foi movida. Volte para a Home da Provider Mais Fibra."
        path="/404"
        noindex
      />
      <Header />
      <main
        className="flex-1 flex items-center justify-center pt-16"
        style={{ background: "linear-gradient(135deg, #001A6E 0%, #0040FF 100%)" }}
      >
        <div className="max-w-md mx-4 text-center py-20">
          <div
            className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}
          >
            <AlertCircle className="h-8 w-8 text-[#00D94A]" />
          </div>
          <h1 className="text-5xl font-black text-white mb-3" style={{ letterSpacing: "-0.02em" }}>
            404
          </h1>
          <p className="text-white/85 text-lg font-bold mb-2">Página não encontrada</p>
          <p className="text-white/65 text-sm mb-8">
            A página que você procura não existe ou foi movida.
          </p>
          <button
            onClick={() => { navigate("/"); window.scrollTo({ top: 0 }); }}
            className="inline-flex items-center gap-2 px-7 py-3 rounded-full font-bold text-sm text-white transition-all duration-200 hover:scale-105"
            style={{ background: "#00C040", boxShadow: "0 6px 16px rgba(0,192,64,0.35)" }}
          >
            <Home size={16} />
            Voltar para Home
          </button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
