import { motion } from "framer-motion";
import { Link } from "wouter";
import { MapPin, MessageCircle, Phone, Clock, ArrowRight } from "lucide-react";
import Header from "@/components/sections/Header";
import Footer from "@/components/sections/Footer";
import WhatsAppFloat from "@/components/sections/WhatsAppFloat";
import { cities } from "@/lib/cities";

function trackCityAssinar(cityName: string) {
  const baseUrl = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  fetch(`${baseUrl}/api/clicks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planSpeed: "city", planPrice: cityName, source: cityName }),
  }).catch((err) => {
    console.warn("[OndeEstamos] Failed to record city click event:", err);
  });
}

export default function OndeEstamos() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 pt-16">
        <section
          className="py-20"
          style={{ background: "linear-gradient(135deg, #0A1995 0%, #122AD5 100%)" }}
        >
          <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold mb-6"
                style={{ background: "rgba(149,235,29,0.15)", border: "1px solid rgba(149,235,29,0.3)" }}
              >
                <MapPin size={12} style={{ color: "#95EB1D" }} />
                <span className="text-[#95EB1D]">Nossas Cidades</span>
              </div>
              <h1
                className="text-4xl sm:text-5xl font-black text-white mb-4"
                style={{ letterSpacing: "-0.02em" }}
              >
                Onde a Provider
                <span style={{ color: "#95EB1D" }}> Mais Fibra</span> está
              </h1>
              <p className="text-white/70 text-lg mb-8">
                Presentes em <strong className="text-white">{cities.length} cidades</strong> do Oeste da Bahia com fibra óptica 100%
              </p>

              <div className="flex flex-wrap justify-center gap-4">
                <div
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white"
                  style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
                >
                  <span className="text-2xl font-black text-[#95EB1D]">{cities.length}</span>
                  Cidades Atendidas
                </div>
                <div
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white"
                  style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
                >
                  <span className="text-2xl font-black text-[#95EB1D]">100%</span>
                  Fibra Óptica
                </div>
                <div
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white"
                  style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
                >
                  <Clock size={18} style={{ color: "#95EB1D" }} />
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
              <h2 className="text-2xl sm:text-3xl font-bold text-[#122AD5] mb-2">
                Escolha sua cidade e assine agora
              </h2>
              <p className="text-[#4A4F61] text-sm">
                Clique na cidade para ver os planos disponíveis ou fale direto pelo WhatsApp
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {cities.map((city, i) => (
                <motion.div
                  key={city.slug}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                  className="flex flex-col rounded-2xl overflow-hidden group transition-all duration-300 hover:-translate-y-1"
                  style={{
                    background: "white",
                    border: city.highlight ? "2px solid #122AD5" : "1px solid #E8EAEF",
                    boxShadow: city.highlight
                      ? "0 8px 24px rgba(0,63,153,0.15)"
                      : "0 2px 8px rgba(0,0,0,0.06)",
                  }}
                >
                  <Link
                    href={`/cidade/${city.slug}`}
                    data-testid={`link-city-header-${city.slug}`}
                    className="p-5 flex items-start justify-between cursor-pointer"
                    style={{ background: city.highlight ? "#122AD5" : "#F5F6FA" }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: city.highlight ? "rgba(255,255,255,0.2)" : "#122AD5" }}
                      >
                        <MapPin size={18} color="white" />
                      </div>
                      <div>
                        <h3
                          className="font-bold text-base leading-tight"
                          style={{ color: city.highlight ? "white" : "#122AD5" }}
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
                        style={{ background: "#95EB1D", color: "#0D0E14" }}
                      >
                        {city.badge}
                      </span>
                    )}
                  </Link>

                  <div className="p-5 flex-1 flex flex-col">
                    <p className="text-sm text-[#4A4F61] leading-relaxed mb-4 flex-1">
                      {city.description}
                    </p>

                    <div className="mb-4">
                      <p className="text-xs font-bold text-[#B0B5C3] uppercase tracking-wide mb-1.5">
                        Planos disponíveis
                      </p>
                      <p className="text-xs font-semibold text-[#122AD5]">{city.planos}</p>
                    </div>

                    <Link
                      href={`/cidade/${city.slug}`}
                      data-testid={`link-city-page-${city.slug}`}
                      className="flex items-center justify-center gap-1.5 mb-2 py-2 rounded-lg text-xs font-bold transition-all duration-200 hover:bg-[#E8EFFF]"
                      style={{ color: "#122AD5" }}
                    >
                      Ver página de {city.name}
                      <ArrowRight size={13} />
                    </Link>

                    <div className="flex gap-2">
                      <a
                        href={`https://wa.me/${city.whatsapp}?text=${encodeURIComponent(`Olá! Quero assinar um plano em ${city.name} - BA.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => trackCityAssinar(city.name)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold text-white transition-all duration-200 hover:scale-105"
                        style={{ background: "#122AD5" }}
                      >
                        <MessageCircle size={15} />
                        Assinar
                      </a>
                      <a
                        href={`https://wa.me/${city.whatsapp}?text=${encodeURIComponent(`Olá! Tenho uma dúvida sobre cobertura em ${city.name} - BA.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 hover:scale-105"
                        style={{ background: "#F0F5FF", color: "#122AD5", border: "1px solid #C5D8FF" }}
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
                background: "linear-gradient(135deg, #0A1995 0%, #122AD5 100%)",
              }}
            >
              <h3 className="text-2xl font-bold text-white mb-2">
                Não encontrou sua cidade?
              </h3>
              <p className="text-white/70 text-sm mb-6">
                Estamos em expansão! Entre em contato e verifique se sua cidade já está na fila de atendimento.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <a
                  href="https://wa.me/5577998444757?text=Ol%C3%A1!%20Gostaria%20de%20saber%20se%20a%20Provider%20atende%20na%20minha%20cidade."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-lg font-bold text-base text-[#0D0E14] transition-all duration-200 hover:scale-105"
                  style={{ background: "#95EB1D" }}
                >
                  <MessageCircle size={18} />
                  Verificar Cobertura
                </a>
                <Link
                  href="/demanda"
                  data-testid="link-demanda-onde-estamos"
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-lg font-bold text-base transition-all duration-200 hover:scale-105"
                  style={{ background: "#95EB1D", color: "#0D0E14" }}
                >
                  <MapPin size={18} />
                  Ver mapa público de demanda
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppFloat />
    </div>
  );
}
