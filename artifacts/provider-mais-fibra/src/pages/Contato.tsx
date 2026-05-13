import { useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Instagram, Clock, MapPin, ChevronDown, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import SEO from "@/components/SEO";
import Header from "@/components/sections/Header";
import Footer from "@/components/sections/Footer";
import WhatsAppFloat from "@/components/sections/WhatsAppFloat";
import {
  buildBreadcrumbSchema,
  buildLocalBusinessSchemas,
} from "@/lib/seoConfig";
import { cities as allCities } from "@/lib/cities";

const cityOptions = [
  "Barreiras",
  "Luís Eduardo Magalhães",
  "Correntina",
  "Wanderley",
  "Santa Rita de Cássia",
  "Barra",
  "Buritirama",
  "Mansidão",
  "Múquem de São Francisco",
  "Posto Rosário",
  "Roda Velha",
  "Javi",
];

const reasons = [
  "Quero assinar um plano",
  "Suporte técnico",
  "2ª via de boleto",
  "Cancelamento",
  "Alterar plano",
  "Reclamação",
  "Outro",
];

const FAMILY_IMG = `${import.meta.env.BASE_URL}images/photos/family-contact.png`;

export default function Contato() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    city: "",
    reason: "",
    message: "",
    accept: false,
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const target = e.target as HTMLInputElement;
    const value = target.type === "checkbox" ? target.checked : target.value;
    setForm({ ...form, [target.name]: value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.accept) return;
    const text = encodeURIComponent(
      `Olá! Meu nome é *${form.name}*.\n\n` +
        `📍 Cidade: ${form.city}\n` +
        `📧 E-mail: ${form.email}\n` +
        `📋 Assunto: ${form.reason}\n\n` +
        `💬 Mensagem: ${form.message}\n\n` +
        `📱 WhatsApp: ${form.phone}`,
    );
    window.open(`https://wa.me/5577998444757?text=${text}`, "_blank");
  };

  const labelClass =
    "block text-[13px] font-medium text-[#122AD5] mb-1.5";
  const inputClass =
    "w-full px-4 py-2.5 rounded-md text-[15px] text-[#0D0D0D] bg-white border border-[#E2E5EC] outline-none focus:outline-none focus-visible:outline-none transition-colors duration-150 focus:border-[#122AD5]/60";

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEO
        title="Contato — Provider Mais Fibra"
        description="Fale com a Provider Mais Fibra: WhatsApp (77) 99844-4757, Instagram @provider.fibra e atendimento de seg a sex 8h–18h. Tire dúvidas, contrate planos e peça suporte."
        path="/contato"
        keywords={[
          "contato Provider Mais Fibra",
          "telefone Provider Mais Fibra",
          "WhatsApp Provider Mais Fibra",
          "suporte internet Barreiras",
        ]}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "ContactPage",
            name: "Contato — Provider Mais Fibra",
            url: "https://www.providermaisfibra.com.br/contato",
            inLanguage: "pt-BR",
          },
          buildBreadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Contato", path: "/contato" },
          ]),
          ...buildLocalBusinessSchemas(
            allCities
              .filter((c) => c.slug === "barreiras")
              .map((c) => ({
                slug: c.slug,
                name: c.name,
                address: c.address,
                stateCode: c.stateCode,
                phones: c.phones,
              })),
          ),
        ]}
      />
      <Header />

      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 pt-16 md:pt-[88px] focus:outline-none"
      >
        {/* HERO ---------------------------------------------------------- */}
        <section className="bg-white pt-12 md:pt-20 pb-14 md:pb-24">
          <div className="max-w-[1180px] mx-auto px-5 sm:px-8 lg:px-10">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <p className="text-[15px] text-[#4A4F61] mb-2 font-normal">
                  Fale Conosco
                </p>
                <h1
                  className="text-[#122AD5] font-bold mb-6 text-[36px] md:text-[44px] leading-[1.1]"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  Quer falar com a gente?
                </h1>
                <p className="text-[15px] md:text-[16px] text-[#4A4F61] leading-relaxed max-w-[480px]">
                  Se você tem alguma dúvida, precisa contratar um plano, pedir
                  suporte técnico ou enviar uma sugestão, este é o lugar ideal.
                  Responda o formulário abaixo com a sua solicitação e nossa
                  equipe vai responder em breve.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="relative"
              >
                <div className="overflow-hidden rounded-[20px] aspect-[4/3] bg-[#F5F6FA]">
                  <img
                    src={FAMILY_IMG}
                    alt="Família conectada à internet fibra óptica da Provider Mais Fibra"
                    className="w-full h-full object-cover"
                    loading="eager"
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* FORM SECTION -------------------------------------------------- */}
        <section className="bg-[#FAFBFC] py-16 md:py-24">
          <div className="max-w-[1180px] mx-auto px-5 sm:px-8 lg:px-10">
            <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-start">
              {/* Left column — Whatsapp pitch */}
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="lg:col-span-5 lg:pt-6"
              >
                <p className="text-[15px] text-[#0D0D0D] mb-3 leading-relaxed">
                  <span className="font-bold text-[#122AD5]">Novidade!</span>{" "}
                  Agora você pode entrar em contato também pela nossa{" "}
                  <span className="font-bold text-[#122AD5]">
                    Central de WhatsApp
                  </span>
                  .
                </p>
                <p className="text-[14px] text-[#6B7280] leading-relaxed mb-6">
                  A Provider Mais Fibra também possui um canal exclusivo pelo
                  WhatsApp, basta clicar no botão abaixo e enviar uma mensagem
                  direto para nossa Central de Atendimento.
                </p>
                <a
                  href="https://wa.me/5577998444757"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-[14px] font-semibold text-white bg-[#25D366] hover:bg-[#20BD5A] transition-colors"
                >
                  <MessageCircle size={18} strokeWidth={2.2} />
                  Falar pelo WhatsApp
                </a>

                <div className="mt-10 space-y-5">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#EEF1FF] flex items-center justify-center flex-shrink-0">
                      <Clock size={16} className="text-[#122AD5]" />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-[#0D0D0D] mb-0.5">
                        Atendimento
                      </p>
                      <p className="text-[13px] text-[#6B7280] leading-relaxed">
                        Seg a Sex: 08h às 18h · Sábado: 08h às 12h · Suporte 24h via WhatsApp
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#EEF1FF] flex items-center justify-center flex-shrink-0">
                      <MapPin size={16} className="text-[#122AD5]" />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-[#0D0D0D] mb-0.5">
                        Cobertura
                      </p>
                      <p className="text-[13px] text-[#6B7280] leading-relaxed">
                        Atendemos {allCities.length} cidades no Oeste da Bahia.{" "}
                        <Link
                          href="/onde-estamos"
                          className="text-[#122AD5] font-semibold hover:underline"
                        >
                          Ver cidades
                        </Link>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#EEF1FF] flex items-center justify-center flex-shrink-0">
                      <Instagram size={16} className="text-[#122AD5]" />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-[#0D0D0D] mb-0.5">
                        Instagram
                      </p>
                      <a
                        href="https://instagram.com/provider.fibra"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] text-[#6B7280] hover:text-[#122AD5]"
                      >
                        @provider.fibra
                      </a>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Right column — Form */}
              <motion.div
                initial={{ opacity: 0, x: 16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="lg:col-span-7"
              >
                <div className="bg-white rounded-[16px] border border-[#E8EAEF] p-7 md:p-10">
                  <h2 className="text-[22px] md:text-[24px] font-bold text-[#122AD5] mb-2">
                    Fale conosco sempre que precisar
                  </h2>
                  <p className="text-[14px] text-[#6B7280] leading-relaxed mb-7">
                    Entre em contato com a Provider pelo nosso formulário de
                    contato, via nossos canais de atendimento ou se preferir,
                    venha até uma loja.
                  </p>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <label htmlFor="c-name" className={labelClass}>
                        Nome completo
                      </label>
                      <input
                        id="c-name"
                        type="text"
                        name="name"
                        required
                        value={form.name}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label htmlFor="c-email" className={labelClass}>
                        E-mail
                      </label>
                      <input
                        id="c-email"
                        type="email"
                        name="email"
                        required
                        value={form.email}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label htmlFor="c-phone" className={labelClass}>
                        WhatsApp
                      </label>
                      <input
                        id="c-phone"
                        type="tel"
                        name="phone"
                        required
                        value={form.phone}
                        onChange={handleChange}
                        placeholder="(__) _____-____"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label htmlFor="c-city" className={labelClass}>
                        Cidade
                      </label>
                      <div className="relative">
                        <select
                          id="c-city"
                          name="city"
                          required
                          value={form.city}
                          onChange={handleChange}
                          className={`${inputClass} appearance-none pr-10 bg-white`}
                        >
                          <option value="">Selecione a cidade</option>
                          {cityOptions.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={16}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="c-reason" className={labelClass}>
                        Assunto
                      </label>
                      <div className="relative">
                        <select
                          id="c-reason"
                          name="reason"
                          required
                          value={form.reason}
                          onChange={handleChange}
                          className={`${inputClass} appearance-none pr-10 bg-white`}
                        >
                          <option value="">Informações sobre planos</option>
                          {reasons.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={16}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="c-message" className={labelClass}>
                        Mensagem
                      </label>
                      <textarea
                        id="c-message"
                        name="message"
                        rows={4}
                        value={form.message}
                        onChange={handleChange}
                        className={`${inputClass} resize-none`}
                      />
                    </div>

                    <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        name="accept"
                        checked={form.accept}
                        onChange={handleChange}
                        required
                        className="mt-0.5 w-4 h-4 accent-[#122AD5] cursor-pointer flex-shrink-0"
                      />
                      <span className="text-[13px] text-[#6B7280] leading-relaxed">
                        Ao enviar, você concorda com nossa{" "}
                        <Link
                          href="/politica-de-privacidade"
                          className="text-[#122AD5] font-medium hover:underline"
                        >
                          Política de Privacidade
                        </Link>
                        .
                      </span>
                    </label>

                    <button
                      type="submit"
                      disabled={!form.accept}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-md font-semibold text-[15px] text-white bg-[#122AD5] hover:bg-[#0E22B5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Enviar
                      <ArrowRight size={16} />
                    </button>
                  </form>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppFloat source="contato-sticky" />
    </div>
  );
}
