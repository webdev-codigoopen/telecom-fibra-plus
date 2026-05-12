import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import Header from "@/components/sections/Header";
import Footer from "@/components/sections/Footer";
import WhatsAppFloat from "@/components/sections/WhatsAppFloat";
import CityClicksMap, { type CityClickEntry } from "@/components/CityClicksMap";

export default function DemandaCidades() {
  const [entries, setEntries] = useState<CityClickEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const baseUrl = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${baseUrl}/api/clicks/cities`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: CityClickEntry[] = await res.json();
        if (!cancelled) setEntries(data);
      } catch {
        if (!cancelled) setError("Não foi possível carregar o mapa de demanda.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-16">
        <section
          className="py-16"
          style={{ background: "linear-gradient(135deg, #001A6E 0%, #0040FF 100%)" }}
        >
          <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold mb-6"
                style={{ background: "rgba(255,214,0,0.15)", border: "1px solid rgba(255,214,0,0.3)" }}
              >
                <MapPin size={12} style={{ color: "#FFD600" }} />
                <span className="text-[#FFD600]">Mapa de Demanda</span>
              </div>
              <h1
                className="text-4xl sm:text-5xl font-black text-white mb-4"
                style={{ letterSpacing: "-0.02em" }}
              >
                Onde a procura está
                <span style={{ color: "#FFD600" }}> mais quente</span>
              </h1>
              <p className="text-white/70 text-base max-w-2xl mx-auto">
                Bolhas maiores indicam mais cliques de interesse no Oeste da Bahia. Atualizado em tempo real.
              </p>
            </motion.div>
          </div>
        </section>

        <section className="py-12" style={{ background: "#F5F6FA" }}>
          <div className="max-w-[1100px] mx-auto px-4 sm:px-8 lg:px-16">
            {loading && (
              <div className="text-center text-[#7A7F8C] py-12">Carregando mapa...</div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-6 text-sm">
                {error}
              </div>
            )}
            {!loading && !error && <CityClicksMap clicks={entries} />}
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppFloat />
    </div>
  );
}
