import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, X, CheckCircle2 } from "lucide-react";
import SEO from "@/components/SEO";
import Header from "@/components/sections/Header";
import Footer from "@/components/sections/Footer";
import WhatsAppFloat from "@/components/sections/WhatsAppFloat";
import type { CityClickEntry } from "@/components/CityClicksMap";

const CityClicksMap = lazy(() => import("@/components/CityClicksMap"));

const SUGGESTED_CITIES = [
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

function formatWhatsappDisplay(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function DemandaCidades() {
  const [entries, setEntries] = useState<CityClickEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const websiteRef = useRef<HTMLInputElement | null>(null);
  const cityInputRef = useRef<HTMLInputElement | null>(null);

  const baseUrl = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const cancelledRef = useRef(false);

  async function loadEntries() {
    try {
      const res = await fetch(`${baseUrl}/api/clicks/cities`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: CityClickEntry[] = await res.json();
      if (cancelledRef.current) return;
      setEntries(data);
      setError(null);
    } catch {
      if (cancelledRef.current) return;
      setError("Não foi possível carregar o mapa de demanda.");
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    cancelledRef.current = false;
    loadEntries();
    return () => {
      cancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openForm() {
    setSubmitError(null);
    setSubmitted(false);
    setFormOpen(true);
    setTimeout(() => cityInputRef.current?.focus(), 60);
  }

  function closeForm() {
    if (submitting) return;
    setFormOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitError(null);

    const trimmedCity = city.trim();
    const trimmedNeighborhood = neighborhood.trim();
    const digits = whatsapp.replace(/\D/g, "");
    if (trimmedCity.length < 2) {
      setSubmitError("Informe a cidade.");
      return;
    }
    if (trimmedNeighborhood.length < 2) {
      setSubmitError("Informe o bairro ou rua.");
      return;
    }
    if (digits.length < 10 || digits.length > 11) {
      setSubmitError("Informe um WhatsApp válido com DDD (10 ou 11 dígitos).");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${baseUrl}/api/demand/interest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: trimmedCity,
          neighborhood: trimmedNeighborhood,
          whatsapp: digits,
          website: websiteRef.current?.value ?? "",
        }),
      });
      if (!res.ok) {
        let message = "Não foi possível registrar seu interesse. Tente novamente.";
        try {
          const data = await res.json();
          if (typeof data?.error === "string") message = data.error;
        } catch {
          /* ignore */
        }
        setSubmitError(message);
        return;
      }
      setSubmitted(true);
      setCity("");
      setNeighborhood("");
      setWhatsapp("");
      // Refresh the map so the new entry appears immediately.
      loadEntries();
    } catch {
      setSubmitError("Falha de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title="Mapa de Demanda — Provider Mais Fibra"
        description="Veja o mapa de demanda da Provider Mais Fibra e cadastre sua cidade ou bairro para ajudar a definir as próximas regiões com cobertura de internet fibra óptica."
        path="/demanda"
        keywords={[
          "mapa de demanda Provider Mais Fibra",
          "solicitar internet fibra Bahia",
          "cidades em expansão Provider",
        ]}
      />
      <Header />
      <main className="flex-1 pt-16">
        <section
          className="py-16"
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
                <span className="text-[#95EB1D]">Mapa de Demanda</span>
              </div>
              <h1
                className="text-4xl sm:text-5xl font-black text-white mb-4"
                style={{ letterSpacing: "-0.02em" }}
              >
                Onde a procura está
                <span style={{ color: "#95EB1D" }}> mais quente</span>
              </h1>
              <p className="text-white/70 text-base max-w-2xl mx-auto mb-8">
                Bolhas maiores indicam mais cliques de interesse no Oeste da Bahia. Atualizado em tempo real.
              </p>
              <button
                type="button"
                onClick={openForm}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm transition-transform hover:scale-[1.02] active:scale-[0.99]"
                style={{ background: "#95EB1D", color: "#0A1995", boxShadow: "0 6px 20px rgba(0,0,0,0.18)" }}
                data-testid="open-interest-form"
              >
                <MapPin size={16} />
                Não viu sua cidade? Cadastrar interesse
              </button>
            </motion.div>
          </div>
        </section>

        <section className="py-12" style={{ background: "#F5F6FA" }}>
          <div className="max-w-[1100px] mx-auto px-4 sm:px-8 lg:px-16">
            {loading && (
              <div className="text-center text-[#7A7F8C] py-12">Carregando mapa...</div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-6 text-sm">
                {error}
              </div>
            )}
            {!loading && !error && (
              <Suspense fallback={<div style={{ minHeight: 320 }} aria-busy="true" />}>
                <CityClicksMap clicks={entries} />
              </Suspense>
            )}
            <div className="mt-8 text-center">
              <p className="text-[#2A2D38] text-sm mb-3">
                Sua cidade ou bairro ainda não aparece? Ajude a colocar no mapa.
              </p>
              <button
                type="button"
                onClick={openForm}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm border-2 transition-colors hover:bg-[#122AD5] hover:text-white"
                style={{ borderColor: "#122AD5", color: "#122AD5", background: "white" }}
                data-testid="open-interest-form-secondary"
              >
                <MapPin size={14} />
                Cadastrar interesse na minha região
              </button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppFloat source="demanda-cidades-sticky" />

      <AnimatePresence>
        {formOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0, 14, 56, 0.6)" }}
            onClick={closeForm}
            role="dialog"
            aria-modal="true"
            aria-labelledby="interest-form-title"
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-2xl w-full max-w-md p-6 relative shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={closeForm}
                aria-label="Fechar"
                className="absolute top-3 right-3 p-1.5 rounded-full text-[#7A7F8C] hover:bg-[#F5F6FA]"
                data-testid="close-interest-form"
              >
                <X size={18} />
              </button>

              {submitted ? (
                <div className="text-center py-4">
                  <div
                    className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3"
                    style={{ background: "rgba(149,235,29,0.12)" }}
                  >
                    <CheckCircle2 size={28} style={{ color: "#00863A" }} />
                  </div>
                  <h2 id="interest-form-title" className="text-lg font-black text-[#0D0D0D] mb-1">
                    Interesse registrado!
                  </h2>
                  <p className="text-sm text-[#7A7F8C] mb-5">
                    Sua região já aparece no mapa de demanda. Vamos avisar pelo WhatsApp assim que a fibra chegar aí.
                  </p>
                  <div className="flex gap-2 justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        setSubmitted(false);
                      }}
                      className="px-4 py-2 rounded-full text-sm font-bold border border-[#E0E3EB] text-[#2A2D38] hover:bg-[#F5F6FA]"
                      data-testid="register-another"
                    >
                      Cadastrar outro
                    </button>
                    <button
                      type="button"
                      onClick={closeForm}
                      className="px-4 py-2 rounded-full text-sm font-bold text-white"
                      style={{ background: "#122AD5" }}
                      data-testid="close-after-success"
                    >
                      Ver no mapa
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 id="interest-form-title" className="text-lg font-black text-[#0D0D0D] mb-1">
                    Cadastrar interesse
                  </h2>
                  <p className="text-sm text-[#7A7F8C] mb-4">
                    Conte onde você está. Quanto mais gente da sua região se cadastra, mais perto a Provider chega de você.
                  </p>

                  <form onSubmit={handleSubmit} className="space-y-3" noValidate>
                    {/* Honeypot — hidden from users, bots tend to fill it. */}
                    <input
                      ref={websiteRef}
                      type="text"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        left: "-10000px",
                        width: "1px",
                        height: "1px",
                        overflow: "hidden",
                      }}
                    />

                    <div>
                      <label className="block text-xs font-bold text-[#2A2D38] mb-1" htmlFor="interest-city">
                        Cidade
                      </label>
                      <input
                        ref={cityInputRef}
                        id="interest-city"
                        name="city"
                        type="text"
                        list="interest-city-suggestions"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Ex.: Barreiras"
                        maxLength={80}
                        required
                        className="w-full px-3 py-2.5 rounded-lg text-sm font-medium text-[#0D0D0D] outline-none focus:ring-2"
                        style={{ background: "#F5F6FA", border: "1.5px solid #E8EAEF" }}
                        data-testid="input-interest-city"
                      />
                      <datalist id="interest-city-suggestions">
                        {SUGGESTED_CITIES.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#2A2D38] mb-1" htmlFor="interest-neighborhood">
                        Bairro ou rua
                      </label>
                      <input
                        id="interest-neighborhood"
                        name="neighborhood"
                        type="text"
                        value={neighborhood}
                        onChange={(e) => setNeighborhood(e.target.value)}
                        placeholder="Ex.: Bairro Vila Brasil ou Rua das Acácias"
                        maxLength={120}
                        required
                        className="w-full px-3 py-2.5 rounded-lg text-sm font-medium text-[#0D0D0D] outline-none focus:ring-2"
                        style={{ background: "#F5F6FA", border: "1.5px solid #E8EAEF" }}
                        data-testid="input-interest-neighborhood"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#2A2D38] mb-1" htmlFor="interest-whatsapp">
                        WhatsApp (com DDD)
                      </label>
                      <input
                        id="interest-whatsapp"
                        name="whatsapp"
                        type="tel"
                        inputMode="tel"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(formatWhatsappDisplay(e.target.value))}
                        placeholder="(77) 99999-9999"
                        maxLength={16}
                        required
                        className="w-full px-3 py-2.5 rounded-lg text-sm font-medium text-[#0D0D0D] outline-none focus:ring-2"
                        style={{ background: "#F5F6FA", border: "1.5px solid #E8EAEF" }}
                        data-testid="input-interest-whatsapp"
                      />
                    </div>

                    {submitError && (
                      <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2" role="alert">
                        {submitError}
                      </div>
                    )}

                    <p className="text-[10px] text-[#7A7F8C] leading-relaxed">
                      Ao enviar, você concorda em receber contato pelo WhatsApp informado quando a fibra chegar à sua região.
                    </p>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-2.5 rounded-lg font-bold text-sm text-white transition-opacity disabled:opacity-60"
                      style={{ background: "#122AD5" }}
                      data-testid="submit-interest"
                    >
                      {submitting ? "Enviando..." : "Quero fibra na minha região"}
                    </button>
                  </form>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
