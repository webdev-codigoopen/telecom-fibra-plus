import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";

const faqs = [
  { q: "Como é feita a instalação?", a: "Nossa equipe técnica realiza a instalação no seu imóvel com agendamento prévio, garantindo a melhor configuração para sua conexão. O processo é rápido e o técnico orienta sobre o uso do equipamento." },
  { q: "Minha internet está lenta, o que posso fazer?", a: "Reinicie o roteador desconectando da tomada por 30 segundos e reconectando. Teste a velocidade pelo nosso app. Se o problema persistir, entre em contato com nosso suporte via WhatsApp." },
  { q: "Quanto tempo leva para instalar minha internet?", a: "A instalação é realizada em até 3 dias úteis após a contratação, de acordo com a disponibilidade da nossa equipe técnica na sua região." },
  { q: "Como emitir a 2ª via do boleto?", a: "Você pode emitir a 2ª via do boleto pelo app Provider Mais Fibra ou entrando em contato com nossa equipe via WhatsApp. É rápido e fácil!" },
  { q: "O que está incluso em todos os planos?", a: "Todos os planos incluem instalação grátis, roteador Wi-Fi e 100 canais de IPTV. Os planos 600 e 900 Mega incluem roteador Wi-Fi 6 e acesso ao Watch." },
  { q: "Como cancelar minha assinatura?", a: "Entre em contato com nossa equipe pelo WhatsApp (77) 99844-4757 para solicitar o cancelamento. O processo é simples e nosso time estará disponível para ajudá-lo." },
  { q: "O que é o serviço de IPTV?", a: "IPTV é televisão por internet. Com ele você assiste mais de 100 canais direto no seu app, Smart TV ou celular, incluindo canais abertos, notícias, esportes, filmes e séries." },
  { q: "A Provider atende na minha cidade?", a: "Atendemos 11 cidades do Oeste da Bahia: Barra, Barreiras, Buritirama, Correntina, Luís Eduardo Magalhães, Mansidão, Muquém, Posto Rosário, Roda Velha, Santa Rita e Wanderley." },
  { q: "Como funciona o suporte 24h?", a: "Nosso suporte está disponível 24 horas por dia via WhatsApp para resolver qualquer problema rapidamente. Para situações técnicas que exigem visita, agendamos a visita o mais rápido possível." },
  { q: "Qual a melhor velocidade para home office e streaming?", a: "Para home office e streaming simultâneo de qualidade, recomendamos o plano 600 MEGA com Wi-Fi 6. Para múltiplos usuários e uso intenso, o plano 900 MEGA garante máxima performance para toda a família." },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section
      id="faq"
      data-testid="faq-section"
      className="py-20 sm:py-24"
      style={{ background: "#F4F4F4" }}
    >
      <div className="max-w-[1100px] mx-auto px-4 sm:px-8 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0D0D0D] mb-3" style={{ letterSpacing: "-0.025em" }}>
            Tire suas <span className="text-[#0040FF] font-black">Dúvidas</span>
          </h2>
          <p className="text-[#666666]">As perguntas mais frequentes dos nossos clientes</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-x-6 gap-y-3">
          {faqs.map((faq, i) => {
            const open = openIndex === i;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04, duration: 0.4 }}
                className="rounded-2xl overflow-hidden bg-white transition-all duration-200 self-start"
                style={{
                  border: open ? "2px solid #0040FF" : "1px solid rgba(0,0,0,0.06)",
                  boxShadow: open ? "0 8px 24px rgba(0,64,255,0.12)" : "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                <button
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                  onClick={() => setOpenIndex(open ? null : i)}
                  data-testid={`faq-item-${i}`}
                >
                  <span
                    className="text-sm font-bold transition-colors"
                    style={{ color: open ? "#0040FF" : "#0D0D0D" }}
                  >
                    {faq.q}
                  </span>
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                    style={{ background: open ? "#0040FF" : "#F4F4F4", color: open ? "white" : "#0040FF" }}
                  >
                    {open ? <Minus size={14} /> : <Plus size={14} />}
                  </span>
                </button>
                <AnimatePresence>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      style={{ overflow: "hidden" }}
                    >
                      <div className="px-5 pb-5 text-sm leading-relaxed text-[#666666]">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
