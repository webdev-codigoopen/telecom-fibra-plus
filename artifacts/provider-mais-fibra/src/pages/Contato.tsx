import { useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Instagram, Clock, MapPin, ChevronDown } from "lucide-react";
import Header from "@/components/sections/Header";
import Footer from "@/components/sections/Footer";
import WhatsAppFloat from "@/components/sections/WhatsAppFloat";

const cities = [
  "Barreiras",
  "Luís Eduardo Magalhães",
  "Angical",
  "Baianópolis",
  "Cristópolis",
  "São Desidério",
  "Jaborandi",
  "Cotegipe",
  "Wanderley",
  "Bom Jesus da Lapa",
  "Santa Maria da Vitória",
  "Correntina",
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

export default function Contato() {
  const [form, setForm] = useState({ name: "", phone: "", city: "", reason: "", message: "" });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = encodeURIComponent(
      `Olá! Meu nome é *${form.name}*.\n\n` +
      `📍 Cidade: ${form.city}\n` +
      `📋 Assunto: ${form.reason}\n\n` +
      `💬 Mensagem: ${form.message}\n\n` +
      `📱 Telefone: ${form.phone}`
    );
    window.open(`https://wa.me/5577998444757?text=${text}`, "_blank");
  };

  const inputClass = "w-full px-4 py-3 rounded-lg text-sm font-medium text-[#0D0D0D] outline-none transition-all duration-200 focus:ring-2";
  const inputStyle = {
    background: "#F5F6FA",
    border: "1.5px solid #E8EAEF",
    fontFamily: "Inter, sans-serif",
  };

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
                <span className="w-2 h-2 rounded-full bg-[#FFD600]" />
                <span className="text-[#FFD600]">Fale Conosco</span>
              </div>
              <h1
                className="text-4xl sm:text-5xl font-black text-white mb-4"
                style={{ letterSpacing: "-0.02em" }}
              >
                Como podemos te ajudar?
              </h1>
              <p className="text-white/70 text-lg">
                Nossa equipe está pronta para atender você de segunda a sábado.
              </p>
            </motion.div>
          </div>
        </section>

        <section className="py-20" style={{ background: "#F5F6FA" }}>
          <div className="max-w-[1100px] mx-auto px-4 sm:px-8 lg:px-16">
            <div className="grid lg:grid-cols-5 gap-10">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="lg:col-span-3"
              >
                <div
                  className="p-8 rounded-2xl"
                  style={{ background: "white", border: "1px solid #E8EAEF", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}
                >
                  <h2 className="text-2xl font-bold text-[#0040FF] mb-6">Envie sua mensagem</h2>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-[#4A4F61] uppercase tracking-wide mb-1.5">
                          Seu Nome *
                        </label>
                        <input
                          type="text"
                          name="name"
                          required
                          value={form.name}
                          onChange={handleChange}
                          placeholder="João Silva"
                          className={inputClass}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#4A4F61] uppercase tracking-wide mb-1.5">
                          WhatsApp / Telefone *
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          required
                          value={form.phone}
                          onChange={handleChange}
                          placeholder="(77) 99999-9999"
                          className={inputClass}
                          style={inputStyle}
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-[#4A4F61] uppercase tracking-wide mb-1.5">
                          Sua Cidade *
                        </label>
                        <div className="relative">
                          <select
                            name="city"
                            required
                            value={form.city}
                            onChange={handleChange}
                            className={`${inputClass} appearance-none pr-10`}
                            style={inputStyle}
                          >
                            <option value="">Selecione a cidade</option>
                            {cities.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B0B5C3] pointer-events-none" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#4A4F61] uppercase tracking-wide mb-1.5">
                          Assunto *
                        </label>
                        <div className="relative">
                          <select
                            name="reason"
                            required
                            value={form.reason}
                            onChange={handleChange}
                            className={`${inputClass} appearance-none pr-10`}
                            style={inputStyle}
                          >
                            <option value="">Selecione o assunto</option>
                            {reasons.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B0B5C3] pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#4A4F61] uppercase tracking-wide mb-1.5">
                        Mensagem
                      </label>
                      <textarea
                        name="message"
                        rows={4}
                        value={form.message}
                        onChange={handleChange}
                        placeholder="Descreva como podemos te ajudar..."
                        className={`${inputClass} resize-none`}
                        style={inputStyle}
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full flex items-center justify-center gap-3 py-4 rounded-lg font-bold text-base text-white transition-all duration-200 hover:scale-[1.02] active:scale-95"
                      style={{
                        background: "#00C040",
                        boxShadow: "0 4px 12px rgba(0,192,64,0.35)",
                      }}
                    >
                      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      Enviar via WhatsApp
                    </button>

                    <p className="text-center text-xs text-[#B0B5C3]">
                      Ao enviar, você será direcionado para o nosso WhatsApp com a mensagem preenchida.
                    </p>
                  </form>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.15 }}
                className="lg:col-span-2 flex flex-col gap-5"
              >
                <div
                  className="p-6 rounded-xl"
                  style={{ background: "white", border: "1px solid #E8EAEF", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
                >
                  <h3 className="text-base font-bold text-[#0040FF] mb-4">Contato Direto</h3>
                  <div className="space-y-4">
                    <a
                      href="https://wa.me/5577998444757"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-4 p-4 rounded-xl transition-all duration-200 hover:-translate-y-0.5"
                      style={{ background: "#F0FFF6", border: "1px solid #C3EFD6" }}
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: "#25D366" }}
                      >
                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-[#4A4F61] font-semibold mb-0.5">WhatsApp</p>
                        <p className="text-base font-bold text-[#0D0D0D]">(77) 99844-4757</p>
                      </div>
                    </a>

                    <a
                      href="https://instagram.com/provider.fibra"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-4 p-4 rounded-xl transition-all duration-200 hover:-translate-y-0.5"
                      style={{ background: "#FFF0F8", border: "1px solid #F8C3E0" }}
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)" }}
                      >
                        <Instagram size={18} color="white" />
                      </div>
                      <div>
                        <p className="text-xs text-[#4A4F61] font-semibold mb-0.5">Instagram</p>
                        <p className="text-base font-bold text-[#0D0D0D]">@provider.fibra</p>
                      </div>
                    </a>
                  </div>
                </div>

                <div
                  className="p-6 rounded-xl"
                  style={{ background: "white", border: "1px solid #E8EAEF", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Clock size={16} style={{ color: "#0040FF" }} />
                    <h3 className="text-base font-bold text-[#0040FF]">Horário de Atendimento</h3>
                  </div>
                  <div className="space-y-2">
                    {[
                      { days: "Segunda a Sexta", hours: "08h às 18h" },
                      { days: "Sábado", hours: "08h às 12h" },
                      { days: "Suporte técnico", hours: "24h via WhatsApp" },
                    ].map((h) => (
                      <div key={h.days} className="flex justify-between items-center py-2 border-b border-[#F0F2F5] last:border-0">
                        <span className="text-sm text-[#4A4F61]">{h.days}</span>
                        <span className="text-sm font-bold text-[#0D0D0D]">{h.hours}</span>
                      </div>
                    ))}
                  </div>
                  <div
                    className="mt-4 flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold"
                    style={{ background: "#F0FFF6", color: "#00C040" }}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#00C040] animate-pulse" />
                    Suporte 24h disponível agora
                  </div>
                </div>

                <div
                  className="p-6 rounded-xl"
                  style={{ background: "white", border: "1px solid #E8EAEF", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <MapPin size={16} style={{ color: "#0040FF" }} />
                    <h3 className="text-base font-bold text-[#0040FF]">Cobertura</h3>
                  </div>
                  <p className="text-sm text-[#4A4F61] mb-3">
                    Atendemos 12 cidades no Oeste da Bahia.
                  </p>
                  <a
                    href="/onde-estamos"
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0040FF] hover:underline"
                  >
                    Ver todas as cidades →
                  </a>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppFloat />
    </div>
  );
}
