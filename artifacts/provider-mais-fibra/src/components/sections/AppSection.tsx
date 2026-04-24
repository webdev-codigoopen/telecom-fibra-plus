import { motion } from "framer-motion";
import { FileText, Zap, User, Headphones, Smartphone } from "lucide-react";

const features = [
  { icon: FileText, label: "2ª Via de Boleto", desc: "Acesse e pague sua fatura com 1 clique" },
  { icon: Zap, label: "Teste de Velocidade", desc: "Verifique sua conexão a qualquer momento" },
  { icon: User, label: "Área do Cliente", desc: "Gerencie sua conta de onde estiver" },
  { icon: Headphones, label: "Suporte via App", desc: "Atendimento rápido direto no aplicativo" },
];

export default function AppSection() {
  return (
    <section
      data-testid="app-section"
      className="py-20"
      style={{ background: "#F5F6FA" }}
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold mb-6"
              style={{ background: "#E8F0FF", color: "#003F99", border: "1px solid #C5D8FF" }}
            >
              <Smartphone size={14} />
              Aplicativo Provider
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#003F99] mb-4">
              Mais Facilidade no
              <br />Seu Dia a Dia
            </h2>
            <p className="text-[#4A4F61] text-base mb-8">
              Gerencie sua internet direto pelo celular. Tudo que você precisa em um só lugar.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-8">
              {features.map((feat) => {
                const Icon = feat.icon;
                return (
                  <div
                    key={feat.label}
                    className="flex flex-col gap-2 p-4 rounded-xl"
                    style={{
                      background: "white",
                      border: "1px solid #E8EAEF",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center"
                      style={{ background: "#003F99" }}
                    >
                      <Icon size={16} color="white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#003F99]">{feat.label}</p>
                      <p className="text-xs text-[#B0B5C3] mt-0.5">{feat.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              <a
                href="#"
                data-testid="app-google-play"
                className="flex items-center gap-3 px-5 py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:scale-105"
                style={{ background: "#0D0E14" }}
              >
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                  <path d="M3.18 23.76c.37.21.8.22 1.18.04l11.65-6.73L13.27 14l-10.09 9.76zM.75 1.13A1.35 1.35 0 0 0 .5 2v20a1.35 1.35 0 0 0 .25.87l.12.11L12.5 11.86v-.28L.87 1.02l-.12.11zM20.9 10.27l-3.27-1.89-3.27 3.18 3.27 3.18 3.3-1.9a1.36 1.36 0 0 0 0-2.57zM4.36.2 16 6.93l-2.74 2.63L3.18.2A1.34 1.34 0 0 0 4.36.2z" />
                </svg>
                <div>
                  <p className="text-[10px] text-white/60 leading-none">Disponível no</p>
                  <p className="leading-none">Google Play</p>
                </div>
              </a>
              <a
                href="#"
                data-testid="app-apple-store"
                className="flex items-center gap-3 px-5 py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:scale-105"
                style={{ background: "#0D0E14" }}
              >
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                  <path d="M14.94 5.19A4.38 4.38 0 0 0 16 2a4.44 4.44 0 0 0-3 1.52 4.17 4.17 0 0 0-1 3.09 3.69 3.69 0 0 0 2.94-1.42zm2.52 7.44a4.51 4.51 0 0 1 2.16-3.81 4.66 4.66 0 0 0-3.66-2c-1.56-.16-3 .91-3.83.91s-2-.89-3.3-.87a4.92 4.92 0 0 0-4.14 2.53C2.86 12.29 4 17 5.93 19.51c.95 1.35 2.07 2.88 3.54 2.83s1.9-.9 3.57-.9 2.12.9 3.56.87 2.49-1.39 3.43-2.75a11 11 0 0 0 1.54-3.18 4.37 4.37 0 0 1-2.61-4.75z" />
                </svg>
                <div>
                  <p className="text-[10px] text-white/60 leading-none">Disponível na</p>
                  <p className="leading-none">App Store</p>
                </div>
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex justify-center"
          >
            <div className="relative">
              <div
                className="relative flex items-center justify-center rounded-3xl"
                style={{
                  width: 280,
                  height: 480,
                  background: "linear-gradient(135deg, #003F99 0%, #0055B8 100%)",
                  boxShadow: "0 20px 60px rgba(0,63,153,0.3)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <div
                  className="absolute top-4 left-1/2 -translate-x-1/2 w-16 h-1.5 rounded-full"
                  style={{ background: "rgba(0,0,0,0.3)" }}
                />
                <div
                  className="relative rounded-2xl p-5 mx-4"
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    width: "100%",
                  }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-white text-xs opacity-70">Velocidade atual</p>
                      <p className="text-[#FFD600] text-3xl font-black">598</p>
                      <p className="text-white text-xs opacity-70">Mbps</p>
                    </div>
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center"
                      style={{ background: "linear-gradient(135deg, #FFD600 0%, #FF8C00 100%)" }}
                    >
                      <Zap size={24} color="#0D0E14" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: "Download", value: "598 Mbps", bar: 0.98 },
                      { label: "Upload", value: "300 Mbps", bar: 0.5 },
                      { label: "Latência", value: "4ms", bar: 0.04 },
                    ].map((stat) => (
                      <div key={stat.label}>
                        <div className="flex justify-between text-xs text-white/70 mb-1">
                          <span>{stat.label}</span>
                          <span className="text-white font-semibold">{stat.value}</span>
                        </div>
                        <div
                          className="h-1.5 rounded-full"
                          style={{ background: "rgba(255,255,255,0.15)" }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${stat.bar * 100}%`,
                              background: "linear-gradient(90deg, #00A86B 0%, #00D4AA 100%)",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div
                    className="mt-4 py-2 rounded-lg text-center text-xs font-bold text-white/80"
                    style={{ background: "rgba(0,168,107,0.3)" }}
                  >
                    Conexao Otima
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
