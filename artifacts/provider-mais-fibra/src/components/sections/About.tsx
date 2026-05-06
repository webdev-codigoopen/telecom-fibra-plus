import { motion } from "framer-motion";
import { MapPin } from "lucide-react";

const cities = [
  "Barra", "Barreiras", "Buritirama", "Correntina", "Luís Eduardo Magalhães",
  "Mansidão", "Muquém", "Posto Rosário", "Roda Velha", "Santa Rita", "Wanderley",
];

export default function About() {
  return (
    <section
      id="sobre"
      data-testid="about-section"
      className="py-20 sm:py-24 bg-white"
    >
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          {/* Map illustration */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="order-2 lg:order-1"
          >
            <div
              className="relative rounded-3xl overflow-hidden p-8 sm:p-10"
              style={{ background: "linear-gradient(160deg, #001A6E 0%, #0040FF 100%)", aspectRatio: "1 / 1" }}
            >
              {/* Stylized Bahia map (abstract SVG) */}
              <svg viewBox="0 0 400 400" className="absolute inset-0 w-full h-full opacity-90">
                <defs>
                  <radialGradient id="mapGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#1A5FFF" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="transparent" />
                  </radialGradient>
                </defs>
                <circle cx="200" cy="200" r="180" fill="url(#mapGlow)" />
                {/* Abstract Bahia outline */}
                <path
                  d="M120 80 L200 60 L260 90 L300 130 L320 180 L340 230 L320 280 L290 320 L240 340 L180 350 L130 320 L100 280 L80 230 L90 170 L100 120 Z"
                  fill="rgba(255,255,255,0.04)"
                  stroke="rgba(0,192,64,0.5)"
                  strokeWidth="1.5"
                />
                {/* Map pins for cities */}
                {[
                  { x: 150, y: 130 }, { x: 180, y: 170 }, { x: 130, y: 200 },
                  { x: 220, y: 200 }, { x: 170, y: 230 }, { x: 250, y: 240 },
                  { x: 200, y: 280 }, { x: 280, y: 200 }, { x: 240, y: 290 },
                  { x: 160, y: 290 }, { x: 220, y: 110 },
                ].map((pin, i) => (
                  <g key={i}>
                    <circle cx={pin.x} cy={pin.y} r="8" fill="#00C040" opacity="0.25">
                      <animate attributeName="r" from="8" to="18" dur="2s" repeatCount="indefinite" begin={`${i * 0.15}s`} />
                      <animate attributeName="opacity" from="0.4" to="0" dur="2s" repeatCount="indefinite" begin={`${i * 0.15}s`} />
                    </circle>
                    <circle cx={pin.x} cy={pin.y} r="5" fill="#00C040" stroke="white" strokeWidth="1.5" />
                  </g>
                ))}
              </svg>
              <div className="relative z-10 h-full flex flex-col justify-end">
                <div
                  className="inline-flex self-start items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-sm"
                  style={{ background: "rgba(0,192,64,0.2)", color: "#00D94A", border: "1px solid rgba(0,192,64,0.4)" }}
                >
                  <MapPin size={12} />
                  Oeste da Bahia
                </div>
              </div>
            </div>
          </motion.div>

          {/* Text */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="order-1 lg:order-2"
          >
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-5"
              style={{ background: "#D6E4FF", color: "#0040FF" }}
            >
              Quem Somos
            </div>
            <h2
              className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0D0D0D] mb-5 leading-[1.1]"
              style={{ letterSpacing: "-0.025em" }}
            >
              Conectando o Oeste da Bahia com{" "}
              <span className="text-accent-green font-black">Fibra de Qualidade</span>
            </h2>

            <p className="text-[#333333] text-base leading-relaxed mb-5">
              A Provider Mais Fibra nasceu com a missão de levar internet de alta velocidade para o interior da Bahia. Com infraestrutura 100% em fibra óptica e foco no atendimento ao cliente, estamos presentes em <strong>11 cidades</strong> do Oeste da Bahia, oferecendo conectividade confiável para famílias e empresas.
            </p>

            <p className="text-[#666666] text-sm leading-relaxed mb-7">
              Homologados pela Anatel, garantimos qualidade de serviço, suporte técnico especializado e planos que cabem no bolso. Nossa equipe trabalha 24h para que sua conexão nunca pare.
            </p>

            <div className="flex flex-wrap gap-2">
              {cities.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ background: "#F4F4F4", color: "#333333", border: "1px solid rgba(0,0,0,0.06)" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00C040]" />
                  {c}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
