import { motion } from "framer-motion";
import { useEffect } from "react";
import { Link, useParams } from "wouter";
import { MapPin, MessageCircle, Phone, ArrowLeft, Clock, Wifi } from "lucide-react";
import Header from "@/components/sections/Header";
import Footer from "@/components/sections/Footer";
import WhatsAppFloat from "@/components/sections/WhatsAppFloat";
import PlanCard from "@/components/PlanCard";
import { usePlans } from "@/hooks/usePlans";
import { getCityBySlug } from "@/lib/cities";
import NotFound from "@/pages/not-found";

export default function Cidade() {
  const params = useParams<{ slug: string }>();
  const city = params?.slug ? getCityBySlug(params.slug) : undefined;
  const { plans } = usePlans();

  useEffect(() => {
    if (city) {
      document.title = `Internet Fibra em ${city.name} - Provider Mais Fibra`;
    }
    return () => {
      document.title = "Provider Mais Fibra";
    };
  }, [city]);

  if (!city) {
    return <NotFound />;
  }

  const assinarHref = `https://wa.me/${city.whatsapp}?text=${encodeURIComponent(
    `Olá! Quero assinar um plano em ${city.name} - BA.`,
  )}`;
  const duvidasHref = `https://wa.me/${city.whatsapp}?text=${encodeURIComponent(
    `Olá! Tenho uma dúvida sobre cobertura em ${city.name} - BA.`,
  )}`;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 pt-16">
        {/* Hero */}
        <section
          className="py-20"
          style={{ background: "linear-gradient(135deg, #001A6E 0%, #0040FF 100%)" }}
        >
          <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <Link
                href="/onde-estamos"
                className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm font-medium mb-6 transition-colors"
                data-testid="link-back-to-cities"
              >
                <ArrowLeft size={14} />
                Ver todas as cidades
              </Link>

              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold mb-6"
                style={{ background: "rgba(255,214,0,0.15)", border: "1px solid rgba(255,214,0,0.3)" }}
              >
                <MapPin size={12} style={{ color: "#FFD600" }} />
                <span className="text-[#FFD600]">{city.badge ?? "Cobertura Ativa"}</span>
              </div>

              <h1
                className="text-4xl sm:text-5xl font-black text-white mb-4"
                style={{ letterSpacing: "-0.02em" }}
              >
                Internet Fibra em
                <span style={{ color: "#FFD600" }}> {city.name}</span>
              </h1>
              <p className="text-white/80 text-lg max-w-2xl mx-auto mb-8">
                {city.description}
              </p>

              <div className="flex flex-wrap justify-center gap-4">
                <div
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white"
                  style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
                >
                  <Wifi size={16} style={{ color: "#FFD600" }} />
                  100% Fibra Óptica
                </div>
                <div
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white"
                  style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
                >
                  <Clock size={16} style={{ color: "#FFD600" }} />
                  Suporte 24h
                </div>
                <a
                  href={assinarHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="cta-hero-whatsapp"
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
                  style={{ background: "#00C040" }}
                >
                  <MessageCircle size={16} />
                  Falar no WhatsApp
                </a>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Plans */}
        <section
          id="planos"
          className="py-20"
          style={{
            background: "linear-gradient(180deg, #122AD5 0%, #1A38D5 60%, #2138CD 100%)",
          }}
        >
          <div className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center max-w-3xl mx-auto mb-10"
            >
              <h2
                className="text-white leading-[1.25]"
                style={{ fontSize: "clamp(20px, 2.4vw, 26px)", fontWeight: 600, letterSpacing: "-0.005em" }}
              >
                Planos disponíveis em{" "}
                <span style={{ fontWeight: 900 }}>{city.name}</span>
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
              {plans.map((plan, i) => (
                <PlanCard
                  key={plan.speed}
                  plan={plan}
                  index={i}
                  source={city.name}
                  cityName={city.name}
                  idSuffix={`-${city.slug}`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Contact info */}
        <section className="py-20" style={{ background: "#F5F6FA" }}>
          <div className="max-w-[1000px] mx-auto px-4 sm:px-8 lg:px-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-10"
            >
              <h2 className="text-2xl sm:text-3xl font-bold text-[#0040FF] mb-2">
                Atendimento em {city.name}
              </h2>
              <p className="text-[#4A4F61] text-sm">
                Fale com nossa equipe local pelos canais abaixo
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <a
                href={assinarHref}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="contact-card-assinar"
                className="flex flex-col items-center text-center p-6 rounded-2xl bg-white transition-all hover:-translate-y-1"
                style={{ border: "1px solid #E8EAEF", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                  style={{ background: "#00C040" }}
                >
                  <MessageCircle size={20} color="white" />
                </div>
                <h3 className="font-bold text-[#0040FF] mb-1">Assinar plano</h3>
                <p className="text-xs text-[#4A4F61]">
                  Fale agora pelo WhatsApp e contrate seu plano em {city.name}.
                </p>
              </a>

              <a
                href={duvidasHref}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="contact-card-duvidas"
                className="flex flex-col items-center text-center p-6 rounded-2xl bg-white transition-all hover:-translate-y-1"
                style={{ border: "1px solid #E8EAEF", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                  style={{ background: "#0040FF" }}
                >
                  <Phone size={20} color="white" />
                </div>
                <h3 className="font-bold text-[#0040FF] mb-1">Tirar dúvidas</h3>
                <p className="text-xs text-[#4A4F61]">
                  Verifique cobertura e tire dúvidas sobre planos disponíveis.
                </p>
              </a>

              <a
                href={city.maps}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="contact-card-maps"
                className="flex flex-col items-center text-center p-6 rounded-2xl bg-white transition-all hover:-translate-y-1"
                style={{ border: "1px solid #E8EAEF", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                  style={{ background: "#FFD600" }}
                >
                  <MapPin size={20} color="#0D0E14" />
                </div>
                <h3 className="font-bold text-[#0040FF] mb-1">Ver no mapa</h3>
                <p className="text-xs text-[#4A4F61]">
                  Confira a localização de {city.name} - BA no Google Maps.
                </p>
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppFloat />
    </div>
  );
}
