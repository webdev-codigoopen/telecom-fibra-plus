import { motion } from "framer-motion";
import { MapPin, MessageCircle, Phone, Clock } from "lucide-react";
import Header from "@/components/sections/Header";
import Footer from "@/components/sections/Footer";
import WhatsAppFloat from "@/components/sections/WhatsAppFloat";

function trackCityAssinar(cityName: string) {
  const baseUrl = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  fetch(`${baseUrl}/api/clicks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planSpeed: "city", planPrice: cityName, source: "city-page" }),
  }).catch((err) => {
    console.warn("[OndeEstamos] Failed to record city click event:", err);
  });
}

const cities = [
  {
    name: "Barreiras",
    description: "Sede regional e maior cobertura da rede Provider Mais Fibra.",
    highlight: true,
    badge: "Sede Regional",
    planos: "100M • 300M • 600M • 900M",
    whatsapp: "5577998444757",
    maps: "https://maps.google.com/?q=Barreiras,BA",
  },
  {
    name: "Luís Eduardo Magalhães",
    description: "Cobertura completa para o maior polo agro do Oeste da Bahia.",
    highlight: false,
    badge: null,
    planos: "100M • 300M • 600M • 900M",
    whatsapp: "5577998444757",
    maps: "https://maps.google.com/?q=Luis+Eduardo+Magalhaes,BA",
  },
  {
    name: "Angical",
    description: "Internet rápida e confiável para residências e empresas locais.",
    highlight: false,
    badge: null,
    planos: "100M • 300M • 600M",
    whatsapp: "5577998444757",
    maps: "https://maps.google.com/?q=Angical,BA",
  },
  {
    name: "Baianópolis",
    description: "Fibra óptica chegou até você com velocidade e estabilidade.",
    highlight: false,
    badge: null,
    planos: "100M • 300M • 600M",
    whatsapp: "5577998444757",
    maps: "https://maps.google.com/?q=Baianopolis,BA",
  },
  {
    name: "Cristópolis",
    description: "Conectividade de alta qualidade para o interior do Oeste baiano.",
    highlight: false,
    badge: null,
    planos: "100M • 300M",
    whatsapp: "5577998444757",
    maps: "https://maps.google.com/?q=Cristopolis,BA",
  },
  {
    name: "São Desidério",
    description: "Um dos maiores municípios em área do Brasil, totalmente conectado.",
    highlight: false,
    badge: null,
    planos: "100M • 300M • 600M",
    whatsapp: "5577998444757",
    maps: "https://maps.google.com/?q=Sao+Desiderio,BA",
  },
  {
    name: "Jaborandi",
    description: "Internet fibra para famílias e agronegócio da região.",
    highlight: false,
    badge: null,
    planos: "100M • 300M",
    whatsapp: "5577998444757",
    maps: "https://maps.google.com/?q=Jaborandi,BA",
  },
  {
    name: "Cotegipe",
    description: "Fibra óptica de qualidade no coração do Oeste baiano.",
    highlight: false,
    badge: null,
    planos: "100M • 300M • 600M",
    whatsapp: "5577998444757",
    maps: "https://maps.google.com/?q=Cotegipe,BA",
  },
  {
    name: "Wanderley",
    description: "Conexão estável e veloz para residências e comércios locais.",
    highlight: false,
    badge: null,
    planos: "100M • 300M",
    whatsapp: "5577998444757",
    maps: "https://maps.google.com/?q=Wanderley,BA",
  },
  {
    name: "Bom Jesus da Lapa",
    description: "Internet de qualidade para a cidade santuário do Oeste baiano.",
    highlight: false,
    badge: null,
    planos: "100M • 300M • 600M",
    whatsapp: "5577998444757",
    maps: "https://maps.google.com/?q=Bom+Jesus+da+Lapa,BA",
  },
  {
    name: "Santa Maria da Vitória",
    description: "Cobertura em fibra óptica para toda a cidade e região.",
    highlight: false,
    badge: null,
    planos: "100M • 300M • 600M",
    whatsapp: "5577998444757",
    maps: "https://maps.google.com/?q=Santa+Maria+da+Vitoria,BA",
  },
  {
    name: "Correntina",
    description: "Conectando famílias e empresas às margens do Rio Corrente.",
    highlight: false,
    badge: null,
    planos: "100M • 300M • 600M",
    whatsapp: "5577998444757",
    maps: "https://maps.google.com/?q=Correntina,BA",
  },
];

export default function OndeEstamos() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 pt-16">
        <section
          className="py-20"
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
                <span className="text-[#FFD600]">Nossas Cidades</span>
              </div>
              <h1
                className="text-4xl sm:text-5xl font-black text-white mb-4"
                style={{ letterSpacing: "-0.02em" }}
              >
                Onde a Provider
                <span style={{ color: "#FFD600" }}> Mais Fibra</span> está
              </h1>
              <p className="text-white/70 text-lg mb-8">
                Presentes em <strong className="text-white">11 cidades</strong> do Oeste da Bahia com fibra óptica 100%
              </p>

              <div className="flex flex-wrap justify-center gap-4">
                <div
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white"
                  style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
                >
                  <span className="text-2xl font-black text-[#00D94A]">11</span>
                  Cidades Atendidas
                </div>
                <div
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white"
                  style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
                >
                  <span className="text-2xl font-black text-[#FFD600]">100%</span>
                  Fibra Óptica
                </div>
                <div
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white"
                  style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
                >
                  <Clock size={18} style={{ color: "#FFD600" }} />
                  Suporte 24h
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="py-20" style={{ background: "#F5F6FA" }}>
          <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-2xl sm:text-3xl font-bold text-[#0040FF] mb-2">
                Escolha sua cidade e assine agora
              </h2>
              <p className="text-[#4A4F61] text-sm">
                Clique em "Assinar" para falar com nossa equipe diretamente pelo WhatsApp
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {cities.map((city, i) => (
                <motion.div
                  key={city.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                  className="flex flex-col rounded-2xl overflow-hidden group transition-all duration-300 hover:-translate-y-1"
                  style={{
                    background: "white",
                    border: city.highlight ? "2px solid #0040FF" : "1px solid #E8EAEF",
                    boxShadow: city.highlight
                      ? "0 8px 24px rgba(0,63,153,0.15)"
                      : "0 2px 8px rgba(0,0,0,0.06)",
                  }}
                >
                  <div
                    className="p-5 flex items-start justify-between"
                    style={{ background: city.highlight ? "#0040FF" : "#F5F6FA" }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: city.highlight ? "rgba(255,255,255,0.2)" : "#0040FF" }}
                      >
                        <MapPin size={18} color={city.highlight ? "white" : "white"} />
                      </div>
                      <div>
                        <h3
                          className="font-bold text-base leading-tight"
                          style={{ color: city.highlight ? "white" : "#0040FF" }}
                        >
                          {city.name}
                        </h3>
                        <p
                          className="text-xs font-medium"
                          style={{ color: city.highlight ? "rgba(255,255,255,0.7)" : "#B0B5C3" }}
                        >
                          Bahia
                        </p>
                      </div>
                    </div>
                    {city.badge && (
                      <span
                        className="text-xs font-bold px-2 py-1 rounded-full"
                        style={{ background: "#FFD600", color: "#0D0E14" }}
                      >
                        {city.badge}
                      </span>
                    )}
                  </div>

                  <div className="p-5 flex-1 flex flex-col">
                    <p className="text-sm text-[#4A4F61] leading-relaxed mb-4 flex-1">
                      {city.description}
                    </p>

                    <div className="mb-4">
                      <p className="text-xs font-bold text-[#B0B5C3] uppercase tracking-wide mb-1.5">
                        Planos disponíveis
                      </p>
                      <p className="text-xs font-semibold text-[#0040FF]">{city.planos}</p>
                    </div>

                    <div className="flex gap-2">
                      <a
                        href={`https://wa.me/${city.whatsapp}?text=${encodeURIComponent(`Olá! Quero assinar um plano em ${city.name} - BA.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => trackCityAssinar(city.name)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold text-white transition-all duration-200 hover:scale-105"
                        style={{ background: "#0040FF" }}
                      >
                        <MessageCircle size={15} />
                        Assinar
                      </a>
                      <a
                        href={`https://wa.me/${city.whatsapp}?text=${encodeURIComponent(`Olá! Tenho uma dúvida sobre cobertura em ${city.name} - BA.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 hover:scale-105"
                        style={{ background: "#F0F5FF", color: "#0040FF", border: "1px solid #C5D8FF" }}
                      >
                        <Phone size={14} />
                        Dúvidas
                      </a>
                      <a
                        href={city.maps}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center px-3 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 hover:scale-105"
                        style={{ background: "#F5F6FA", color: "#4A4F61", border: "1px solid #E8EAEF" }}
                        title="Ver no mapa"
                      >
                        <MapPin size={14} />
                      </a>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-12 p-8 rounded-2xl text-center"
              style={{
                background: "linear-gradient(135deg, #001A6E 0%, #0040FF 100%)",
              }}
            >
              <h3 className="text-2xl font-bold text-white mb-2">
                Não encontrou sua cidade?
              </h3>
              <p className="text-white/70 text-sm mb-6">
                Estamos em expansão! Entre em contato e verifique se sua cidade já está na fila de atendimento.
              </p>
              <a
                href="https://wa.me/5577998444757?text=Ol%C3%A1!%20Gostaria%20de%20saber%20se%20a%20Provider%20atende%20na%20minha%20cidade."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-3 rounded-lg font-bold text-base text-white transition-all duration-200 hover:scale-105"
                style={{ background: "#00C040" }}
              >
                <MessageCircle size={18} />
                Verificar Cobertura
              </a>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppFloat />
    </div>
  );
}
