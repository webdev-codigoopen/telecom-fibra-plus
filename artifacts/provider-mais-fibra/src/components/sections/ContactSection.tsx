import { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, ChevronDown, MessageCircle } from "lucide-react";

const cities = [
  { name: "Barreiras", lat: -12.1503, lng: -44.9917 },
  { name: "Luís Eduardo Magalhães", lat: -12.0967, lng: -45.7869 },
  { name: "Angical", lat: -12.0008, lng: -44.7028 },
  { name: "Baianópolis", lat: -12.1092, lng: -44.532 },
  { name: "Cristópolis", lat: -11.7028, lng: -44.7803 },
  { name: "São Desidério", lat: -12.365, lng: -44.9731 },
  { name: "Jaborandi", lat: -14.0167, lng: -44.4333 },
  { name: "Cotegipe", lat: -12.0228, lng: -44.2581 },
  { name: "Wanderley", lat: -12.1339, lng: -43.9186 },
  { name: "Bom Jesus da Lapa", lat: -13.255, lng: -43.4181 },
  { name: "Santa Maria da Vitória", lat: -13.3981, lng: -44.1964 },
  { name: "Correntina", lat: -13.3428, lng: -44.6406 },
];

const DEFAULT_CITY = cities[0];
const DELTA = 0.04;

function getMapSrc(city: { lat: number; lng: number }) {
  const bbox = [
    city.lng - DELTA,
    city.lat - DELTA,
    city.lng + DELTA,
    city.lat + DELTA,
  ].join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${city.lat},${city.lng}`;
}

function getMapsUrl(city: { name: string; lat: number; lng: number }) {
  return `https://maps.google.com/?q=${city.lat},${city.lng}`;
}

export default function ContactSection() {
  const [form, setForm] = useState({ name: "", phone: "", city: "", message: "" });
  const [mapCity, setMapCity] = useState(DEFAULT_CITY);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === "city") {
      const found = cities.find((c) => c.name === value);
      if (found) setMapCity(found);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = encodeURIComponent(
      `Olá! Meu nome é *${form.name}*.\n\n` +
        `📍 Cidade: ${form.city || "Não informada"}\n\n` +
        `💬 Mensagem: ${form.message}\n\n` +
        `📱 Telefone: ${form.phone}`
    );
    window.open(`https://wa.me/5577998444757?text=${text}`, "_blank");
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
  };

  const inputBase =
    "w-full px-4 py-3 rounded-lg text-sm font-medium text-[#0D0E14] outline-none transition-all duration-200";
  const inputStyle = {
    background: "#F5F6FA",
    border: "1.5px solid #E8EAEF",
  };

  return (
    <section
      id="contato"
      data-testid="contact-section"
      className="py-20"
      style={{ background: "#fff" }}
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
            style={{ background: "#E8F0FF", color: "#003F99", border: "1px solid #C5D8FF" }}
          >
            <MessageCircle size={14} />
            Fale Conosco
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#003F99] mb-3">
            Entre em Contato
          </h2>
          <p className="text-[#4A4F61] max-w-xl mx-auto">
            Preencha o formulário e nossa equipe entra em contato via WhatsApp. Ou selecione sua cidade para ver a localização no mapa.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div
              className="p-8 rounded-2xl"
              style={{
                background: "white",
                border: "1px solid #E8EAEF",
                boxShadow: "0 4px 20px rgba(0,0,0,0.07)",
              }}
            >
              <h3 className="text-xl font-bold text-[#003F99] mb-6">Envie sua mensagem</h3>

              {submitted && (
                <div
                  className="mb-5 flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold"
                  style={{ background: "#F0FFF6", color: "#00A86B", border: "1px solid #C3EFD6" }}
                >
                  <span className="w-2 h-2 rounded-full bg-[#00A86B]" />
                  Mensagem enviada! Você foi redirecionado para o WhatsApp.
                </div>
              )}

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
                      className={`${inputBase} focus:ring-2 focus:ring-[#003F99]`}
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
                      className={`${inputBase} focus:ring-2 focus:ring-[#003F99]`}
                      style={inputStyle}
                    />
                  </div>
                </div>

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
                      className={`${inputBase} appearance-none pr-10 focus:ring-2 focus:ring-[#003F99]`}
                      style={inputStyle}
                    >
                      <option value="">Selecione a cidade</option>
                      {cities.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B0B5C3] pointer-events-none"
                    />
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
                    placeholder="Como podemos te ajudar? Interesse em um plano, dúvida de cobertura..."
                    className={`${inputBase} resize-none focus:ring-2 focus:ring-[#003F99]`}
                    style={inputStyle}
                  />
                </div>

                <button
                  type="submit"
                  data-testid="contact-submit"
                  className="w-full flex items-center justify-center gap-3 py-4 rounded-lg font-bold text-base text-[#0D0E14] transition-all duration-200 hover:scale-[1.02] active:scale-95"
                  style={{
                    background: "linear-gradient(90deg, #FF8C00 0%, #FFD600 100%)",
                    boxShadow: "0 4px 12px rgba(255,140,0,0.35)",
                  }}
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Enviar via WhatsApp
                </button>

                <p className="text-center text-xs text-[#B0B5C3]">
                  Ao enviar, você será redirecionado para o nosso WhatsApp com a mensagem preenchida.
                </p>
              </form>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-col gap-5"
          >
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                border: "1px solid #E8EAEF",
                boxShadow: "0 4px 20px rgba(0,0,0,0.07)",
              }}
            >
              <div
                className="px-5 py-4 flex items-center justify-between"
                style={{ background: "#003F99" }}
              >
                <div className="flex items-center gap-2">
                  <MapPin size={16} color="white" />
                  <span className="text-white font-bold text-sm">
                    {mapCity.name}, BA
                  </span>
                </div>
                <a
                  href={getMapsUrl(mapCity)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-white/70 hover:text-white transition-colors underline underline-offset-2"
                >
                  Abrir no Google Maps →
                </a>
              </div>

              <div className="relative" style={{ height: "320px" }}>
                <iframe
                  key={mapCity.name}
                  src={getMapSrc(mapCity)}
                  title={`Mapa de ${mapCity.name}`}
                  width="100%"
                  height="100%"
                  style={{ border: 0, display: "block" }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>

              <div
                className="px-5 py-3 flex items-center justify-between"
                style={{ background: "#F5F6FA", borderTop: "1px solid #E8EAEF" }}
              >
                <p className="text-xs text-[#4A4F61]">
                  Selecione sua cidade no formulário para atualizar o mapa
                </p>
                <span className="text-xs text-[#B0B5C3]">© OpenStreetMap</span>
              </div>
            </div>

            <div
              className="rounded-2xl p-5"
              style={{ background: "white", border: "1px solid #E8EAEF", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
            >
              <p className="text-xs font-bold text-[#B0B5C3] uppercase tracking-wide mb-3">
                Cidades com cobertura
              </p>
              <div className="flex flex-wrap gap-2">
                {cities.map((city) => (
                  <button
                    key={city.name}
                    type="button"
                    onClick={() => {
                      setMapCity(city);
                      setForm((prev) => ({ ...prev, city: city.name }));
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 hover:scale-105"
                    style={
                      mapCity.name === city.name
                        ? { background: "#003F99", color: "white" }
                        : { background: "#F0F5FF", color: "#003F99", border: "1px solid #C5D8FF" }
                    }
                  >
                    <MapPin size={10} />
                    {city.name}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
