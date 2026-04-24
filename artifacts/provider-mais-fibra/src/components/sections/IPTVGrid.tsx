import { motion } from "framer-motion";
import { Tv, MessageCircle } from "lucide-react";

const categories = [
  {
    name: "Canais Abertos",
    color: "#003F99",
    channels: ["Globo", "SBT", "Record", "Band", "RedeTV", "TV Cultura"],
  },
  {
    name: "Notícias",
    color: "#E53935",
    channels: ["GloboNews", "CNN Brasil", "Band News"],
  },
  {
    name: "Esportes",
    color: "#FF8C00",
    channels: ["ESPN", "SporTV", "Fox Sports", "Combate"],
  },
  {
    name: "Filmes e Séries",
    color: "#7B2FBE",
    channels: ["TNT", "Warner", "Space", "AMC", "TELECINE"],
  },
  {
    name: "Entretenimento",
    color: "#E91E8C",
    channels: ["Multishow", "GNT", "E!", "TLC"],
  },
  {
    name: "Infantil",
    color: "#00A86B",
    channels: ["Cartoon Network", "Disney Channel", "Nickelodeon", "Discovery Kids"],
  },
  {
    name: "Documentários",
    color: "#0099CC",
    channels: ["Discovery", "National Geographic", "History", "Animal Planet"],
  },
  {
    name: "Música",
    color: "#FF5500",
    channels: ["MTV", "VH1"],
  },
];

export default function IPTVGrid() {
  return (
    <section
      id="iptv"
      data-testid="iptv-section"
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
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold mb-4"
            style={{ background: "#F0F5FF", color: "#003F99", border: "1px solid #E8EAEF" }}
          >
            <Tv size={14} />
            Grade de Canais
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#003F99] mb-3">
            Mais de 100 Canais de TV no seu Plano
          </h2>
          <p className="text-[#4A4F61]">Incluso a partir do plano 300 Mega</p>
        </motion.div>

        <div className="space-y-8">
          {categories.map((cat, ci) => (
            <motion.div
              key={cat.name}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: ci * 0.06, duration: 0.4 }}
            >
              <div className="flex items-center gap-3 mb-3">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ background: cat.color }}
                />
                <h3 className="text-sm font-bold text-[#B0B5C3] uppercase tracking-wide">
                  {cat.name}
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {cat.channels.map((ch) => (
                  <span
                    key={ch}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-[#4A4F61] transition-all duration-200 hover:-translate-y-0.5"
                    style={{
                      background: "white",
                      border: `1px solid ${cat.color}30`,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                    }}
                  >
                    {ch}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <a
            href="https://wa.me/5577998444757"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="iptv-cta"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-lg font-bold text-base text-white transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: "#003F99",
              boxShadow: "0 4px 12px rgba(0,63,153,0.3)",
            }}
          >
            <MessageCircle size={18} />
            Quero IPTV no meu Plano
          </a>
        </div>
      </div>
    </section>
  );
}
