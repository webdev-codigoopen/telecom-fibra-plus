import { motion } from "framer-motion";
import { Link } from "wouter";
import { MapPin, MessageCircle, Phone, Clock, MapPinned } from "lucide-react";
import SEO from "@/components/SEO";
import Header from "@/components/sections/Header";
import Footer from "@/components/sections/Footer";
import WhatsAppFloat from "@/components/sections/WhatsAppFloat";
import { cities, phoneToTel } from "@/lib/cities";

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
      <SEO
        title="Onde Estamos — Cidades atendidas pela Provider Mais Fibra"
        description={`Veja as ${cities.length} cidades do Oeste da Bahia com cobertura de internet fibra óptica da Provider Mais Fibra: Barreiras, Luís Eduardo Magalhães, Bom Jesus da Lapa e mais.`}
        path="/onde-estamos"
        keywords={[
          "cidades atendidas Provider Mais Fibra",
          "cobertura internet fibra Oeste da Bahia",
          "cidades com fibra óptica Bahia",
        ]}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Cidades atendidas pela Provider Mais Fibra",
          url: "https://www.providermaisfibra.com.br/onde-estamos",
          inLanguage: "pt-BR",
          hasPart: cities.map((c) => ({
            "@type": "Place",
            name: c.name,
            address: {
              "@type": "PostalAddress",
              addressLocality: c.name,
              addressRegion: c.stateCode,
              addressCountry: "BR",
            },
          })),
        }}
      />
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
              <h1
                className="sm:text-5xl text-white mb-4 font-medium text-[40px]"
                style={{ letterSpacing: "-0.02em" }}
              >
                Onde a Provider
                <span style={{ color: "#95EB1D" }}> Mais Fibra</span> está
              </h1>
              <p className="text-white/70 text-lg mb-8">
                Presentes em <strong className="text-white">{cities.length} cidades</strong> do Oeste da Bahia com fibra óptica 100%
              </p>
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
                Escolha sua cidade e fale com a gente
              </h2>
              <p className="text-[#4A4F61] text-sm">
                Fale direto com nossa equipe pelo WhatsApp
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
                  <div
                    className="p-5 flex items-start justify-between"
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
                  </div>

                  <div className="p-5 flex-1 flex flex-col">
                    <p className="text-sm text-[#4A4F61] leading-relaxed mb-4">
                      {city.description}
                    </p>

                    <div
                      className="rounded-xl p-3 mb-4"
                      style={{ background: "#F5F6FA", border: "1px solid #E8EAEF" }}
                    >
                      <p className="text-[10px] font-bold text-[#B0B5C3] uppercase tracking-wide mb-1.5">
                        Telefones
                      </p>
                      <ul
                        className={`${city.phones.length >= 4 ? "grid grid-cols-2 gap-x-3" : "flex flex-col"} gap-1 mb-3`}
                      >
                        {city.phones.map((p, idx) => (
                          <li key={p}>
                            <a
                              href={`tel:${phoneToTel(p)}`}
                              data-testid={`onde-estamos-phone-${city.slug}-${idx}`}
                              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#122AD5] hover:underline"
                            >
                              {!(city.phones.length >= 4 && idx % 2 === 1) && (
                                <Phone size={12} />
                              )}
                              {p}
                            </a>
                          </li>
                        ))}
                      </ul>
                      <p className="text-[10px] font-bold text-[#B0B5C3] uppercase tracking-wide mb-1.5">
                        Endereço
                      </p>
                      <p className="text-xs text-[#4A4F61] leading-snug flex items-start gap-1.5">
                        <MapPinned size={13} className="text-[#122AD5] flex-shrink-0 mt-0.5" />
                        <span>{city.address}</span>
                      </p>
                    </div>

                    <div className="mt-auto flex gap-2">
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
      <WhatsAppFloat source="onde-estamos-sticky" />
    </div>
  );
}
