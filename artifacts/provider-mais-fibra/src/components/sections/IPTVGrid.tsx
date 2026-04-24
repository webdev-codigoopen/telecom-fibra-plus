import { motion } from "framer-motion";
import { Tv, MessageCircle } from "lucide-react";

function ChannelLogo({ name, bg, textColor = "white", abbr }: { name: string; bg: string; textColor?: string; abbr?: string }) {
  const display = abbr || name.slice(0, 4).toUpperCase();
  return (
    <div
      className="flex items-center justify-center rounded-lg font-black text-xs leading-none select-none"
      style={{
        width: 72,
        height: 44,
        background: bg,
        color: textColor,
        fontFamily: "Arial Black, sans-serif",
        letterSpacing: "-0.5px",
      }}
    >
      {display}
    </div>
  );
}

const channelGrid = [
  {
    category: "Abertos",
    color: "#1565C0",
    channels: [
      { name: "GLOBO", bg: "#1565C0" },
      { name: "SBT", bg: "#E53935" },
      { name: "RECORD", bg: "#333333" },
      { name: "BAND", bg: "#FF6F00" },
      { name: "RedeTV", bg: "#C62828" },
    ],
  },
  {
    category: "Notícias",
    color: "#B71C1C",
    channels: [
      { name: "CNN", bg: "#CC0000", abbr: "CNN" },
      { name: "BAND NEWS", bg: "#FF6F00", abbr: "BN" },
      { name: "GLOBOnews", bg: "#0D47A1", abbr: "GN" },
    ],
  },
  {
    category: "Esportes",
    color: "#E65100",
    channels: [
      { name: "ESPN", bg: "#CC0000", abbr: "ESPN" },
      { name: "SporTV", bg: "#006064", abbr: "STV" },
      { name: "COMBATE", bg: "#1B5E20", abbr: "CMB" },
      { name: "FOX", bg: "#1A237E", abbr: "FOX" },
    ],
  },
  {
    category: "Filmes e Séries",
    color: "#6A1B9A",
    channels: [
      { name: "TNT", bg: "#B71C1C", abbr: "TNT" },
      { name: "WARNER", bg: "#1565C0", abbr: "WBR" },
      { name: "SPACE", bg: "#0D47A1", abbr: "SPC" },
      { name: "AMC", bg: "#000000", abbr: "AMC" },
      { name: "AXN", bg: "#212121", abbr: "AXN" },
    ],
  },
  {
    category: "Entretenimento",
    color: "#AD1457",
    channels: [
      { name: "MULTI", bg: "#E91E63", abbr: "MSH" },
      { name: "GNT", bg: "#7B1FA2", abbr: "GNT" },
      { name: "E!", bg: "#880E4F", abbr: "E!" },
      { name: "TLC", bg: "#283593", abbr: "TLC" },
    ],
  },
  {
    category: "Infantil",
    color: "#2E7D32",
    channels: [
      { name: "CARTOON", bg: "#F57F17", textColor: "#000", abbr: "CN" },
      { name: "DISNEY", bg: "#1565C0", abbr: "DCH" },
      { name: "NICKEL", bg: "#E65100", abbr: "NICK" },
      { name: "DISCOVERY", bg: "#00838F", abbr: "DSC" },
    ],
  },
  {
    category: "Documentários",
    color: "#00695C",
    channels: [
      { name: "NAT GEO", bg: "#F9A825", textColor: "#000", abbr: "NG" },
      { name: "HISTORY", bg: "#5D4037", abbr: "HST" },
      { name: "ANIMALS", bg: "#2E7D32", abbr: "APL" },
      { name: "SCIENCE", bg: "#1565C0", abbr: "SCI" },
    ],
  },
  {
    category: "Música",
    color: "#BF360C",
    channels: [
      { name: "MTV", bg: "#000000", abbr: "MTV" },
      { name: "VH1", bg: "#880E4F", abbr: "VH1" },
      { name: "BRASIL", bg: "#006064", abbr: "MBR" },
    ],
  },
];

export default function IPTVGrid() {
  const totalChannels = channelGrid.reduce((acc, cat) => acc + cat.channels.length, 0);

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
            Grade de Canais IPTV
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#003F99] mb-3">
            Mais de {totalChannels}+ Canais de TV no seu Plano
          </h2>
          <p className="text-[#4A4F61]">Incluso a partir do plano 300 Mega — assista em qualquer tela</p>
        </motion.div>

        <div className="space-y-8">
          {channelGrid.map((cat, ci) => (
            <motion.div
              key={cat.category}
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
                <h3 className="text-xs font-bold text-[#B0B5C3] uppercase tracking-widest">
                  {cat.category}
                </h3>
              </div>
              <div className="flex flex-wrap gap-3">
                {cat.channels.map((ch) => (
                  <motion.div
                    key={ch.name}
                    whileHover={{ scale: 1.06, y: -2 }}
                    transition={{ duration: 0.15 }}
                    className="rounded-lg overflow-hidden"
                    style={{
                      boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                    }}
                  >
                    <ChannelLogo
                      name={ch.name}
                      bg={ch.bg}
                      textColor={(ch as { textColor?: string }).textColor}
                      abbr={(ch as { abbr?: string }).abbr}
                    />
                  </motion.div>
                ))}
                <div
                  className="flex items-center justify-center rounded-lg text-xs font-bold"
                  style={{
                    width: 72,
                    height: 44,
                    background: "#F5F6FA",
                    color: "#B0B5C3",
                    border: "1px dashed #E8EAEF",
                  }}
                >
                  +mais
                </div>
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
