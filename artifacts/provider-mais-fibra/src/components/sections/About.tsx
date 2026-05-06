import { motion } from "framer-motion";
import logoHorizontal from "@assets/logo-provider+fibra_1777059547390.png";

// Pin positions tuned to the Bahia silhouette path below
const cityPins = [
  { name: "Mansidão", x: 130, y: 95 },
  { name: "Buritirama", x: 195, y: 120 },
  { name: "Barra", x: 245, y: 165 },
  { name: "Wanderley", x: 115, y: 175 },
  { name: "Luís Eduardo Magalhães", x: 78, y: 230 },
  { name: "Muquém", x: 265, y: 230 },
  { name: "Barreiras", x: 165, y: 255 },
  { name: "Roda Velha", x: 100, y: 305 },
  { name: "Posto Rosário", x: 215, y: 320 },
  { name: "Santa Rita", x: 145, y: 365 },
  { name: "Correntina", x: 180, y: 415 },
];

export default function About() {
  return (
    <section
      id="sobre"
      data-testid="about-section"
      className="py-16 sm:py-20 lg:py-24 bg-white"
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-12">
        <div className="grid lg:grid-cols-[1fr_1.05fr] gap-10 lg:gap-16 items-center">
          {/* Bahia state map illustration */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="order-2 lg:order-1"
          >
            <div className="relative w-full max-w-[480px] mx-auto">
              <svg viewBox="0 0 360 500" className="w-full h-auto">
                <defs>
                  <linearGradient id="bahiaFill" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1E5BFF" />
                    <stop offset="100%" stopColor="#0040FF" />
                  </linearGradient>
                  <filter id="bahiaShadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="6" />
                  </filter>
                </defs>

                {/* Stylized Bahia silhouette — elongated NS, indented western edge,
                    convex eastern coastline, narrow southern tip. */}
                {(() => {
                  const path =
                    "M 100,55 " +
                    "Q 130,40 165,42 " +     // northern edge
                    "Q 200,45 230,55 " +
                    "Q 258,68 275,90 " +     // top-right slope
                    "L 290,115 " +
                    "Q 305,150 295,180 " +   // east coast bulge
                    "L 305,210 " +
                    "Q 312,240 295,265 " +
                    "L 280,290 " +           // east coast indent
                    "Q 275,320 260,340 " +
                    "L 245,360 " +
                    "Q 235,390 215,420 " +
                    "Q 200,450 185,470 " +   // southern tip
                    "L 170,455 " +
                    "Q 155,425 145,400 " +   // back up west side
                    "L 130,375 " +
                    "Q 110,355 90,330 " +
                    "L 75,300 " +            // western indent (São Francisco)
                    "Q 60,275 65,245 " +
                    "L 55,215 " +
                    "Q 50,180 65,150 " +
                    "L 75,120 " +
                    "Q 82,90 100,55 Z";
                  return (
                    <>
                      <path d={path} fill="#0040FF" opacity="0.15" filter="url(#bahiaShadow)" transform="translate(6 10)" />
                      <path d={path} fill="url(#bahiaFill)" />
                      <path d={path} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.2" />
                    </>
                  );
                })()}

                {/* City pins with labels */}
                {cityPins.map((pin, i) => (
                  <g key={pin.name}>
                    <circle cx={pin.x} cy={pin.y} r="9" fill="#00C040" opacity="0.3">
                      <animate attributeName="r" from="9" to="16" dur="2.4s" repeatCount="indefinite" begin={`${i * 0.18}s`} />
                      <animate attributeName="opacity" from="0.4" to="0" dur="2.4s" repeatCount="indefinite" begin={`${i * 0.18}s`} />
                    </circle>
                    <circle cx={pin.x} cy={pin.y} r="5" fill="#00FF55" stroke="white" strokeWidth="1.5" />
                    <text
                      x={pin.x + 9}
                      y={pin.y + 3}
                      fontSize="9"
                      fontWeight="700"
                      fill="white"
                      style={{ fontFamily: "Inter, sans-serif", letterSpacing: "0.02em" }}
                    >
                      {pin.name}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </motion.div>

          {/* Text + logo */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="order-1 lg:order-2"
          >
            <div className="mb-6">
              <img
                src={logoHorizontal}
                alt="Provider + FIBRA"
                className="h-10 sm:h-12 w-auto"
              />
            </div>

            <h2
              className="text-3xl sm:text-4xl lg:text-[42px] font-bold text-[#0D0D0D] mb-5 leading-[1.1]"
              style={{ letterSpacing: "-0.025em" }}
            >
              Conectando o Oeste da Bahia com{" "}
              <span className="text-accent-green font-black">Fibra de Qualidade</span>
            </h2>

            <p className="text-[#3A3F4D] text-[15px] leading-relaxed mb-4">
              A Provider Mais Fibra nasceu com a missão de levar internet de alta velocidade para o interior da Bahia. Com infraestrutura 100% em fibra óptica e foco no atendimento ao cliente, estamos presentes em <strong className="text-[#0D0D0D]">11 cidades</strong> do Oeste da Bahia, oferecendo conectividade confiável para famílias e empresas.
            </p>

            <p className="text-[#6B7280] text-sm leading-relaxed">
              Homologados pela Anatel, garantimos qualidade de serviço, suporte técnico especializado e planos que cabem no bolso. Nossa equipe trabalha 24h para que sua conexão nunca pare.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
