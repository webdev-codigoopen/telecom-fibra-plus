import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    q: "Como é feita a instalação?",
    a: "Nossa equipe técnica realiza a instalação no seu imóvel com agendamento prévio, garantindo a melhor configuração para sua conexão. O processo é rápido e o técnico orienta sobre o uso do equipamento.",
  },
  {
    q: "Quanto tempo leva para instalar minha internet?",
    a: "A instalação é realizada em até 3 dias úteis após a contratação, de acordo com a disponibilidade da nossa equipe técnica na sua região.",
  },
  {
    q: "O que está incluso em todos os planos?",
    a: "Todos os planos incluem instalação grátis, roteador Wi-Fi e serviço de IPTV com mais de 100 canais. Os planos 600 e 900 Mega incluem roteador Wi-Fi 6 e acesso ao WATCH.",
  },
  {
    q: "O que é o serviço de IPTV?",
    a: "IPTV é televisão por internet. Com ele você assiste mais de 100 canais direto no seu app, Smart TV ou celular, incluindo canais abertos, notícias, esportes, filmes e séries.",
  },
  {
    q: "Como funciona o suporte 24h?",
    a: "Nosso suporte está disponível 24 horas por dia via WhatsApp para resolver qualquer problema rapidamente. Para situações técnicas que exigem visita, agendamos a visita o mais rápido possível.",
  },
  {
    q: "Minha internet está lenta, o que posso fazer?",
    a: "Reinicie o roteador desconectando da tomada por 30 segundos e reconectando. Teste a velocidade pelo nosso app. Se o problema persistir, entre em contato com nosso suporte via WhatsApp.",
  },
  {
    q: "Como emitir a 2ª via do boleto?",
    a: "Você pode emitir a 2ª via do boleto pelo app Provider Mais Fibra ou entrando em contato com nossa equipe via WhatsApp. É rápido e fácil!",
  },
  {
    q: "Como cancelar minha assinatura?",
    a: "Entre em contato com nossa equipe pelo WhatsApp (77) 99844-4757 para solicitar o cancelamento. O processo é simples e nosso time estará disponível para ajudá-lo.",
  },
  {
    q: "A Provider atende na minha cidade?",
    a: "Atendemos 12 cidades do Oeste da Bahia: Barreiras, Luís Eduardo Magalhães, Angical, Baianópolis, Cristópolis, São Desidério, Jaborandi, Cotegipe, Wanderley, Bom Jesus da Lapa, Santa Maria da Vitória e Correntina.",
  },
  {
    q: "Qual a melhor velocidade para home office e streaming?",
    a: "Para home office e streaming simultâneo de qualidade, recomendamos o plano 600 MEGA com Wi-Fi 6. Para múltiplos usuários e uso intenso, o plano 900 MEGA garante máxima performance para toda a família.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section
      id="faq"
      data-testid="faq-section"
      className="py-20"
      style={{ background: "#F5F6FA" }}
    >
      <div className="max-w-[800px] mx-auto px-4 sm:px-8 lg:px-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-[#003F99] mb-3">
            Tire Suas Dúvidas
          </h2>
          <p className="text-[#4A4F61]">As perguntas mais frequentes dos nossos clientes</p>
        </motion.div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04, duration: 0.4 }}
              className="rounded-xl overflow-hidden"
              style={{
                border: openIndex === i ? "2px solid #003F99" : "1px solid #E8EAEF",
                background: "white",
                boxShadow: openIndex === i ? "0 4px 16px rgba(0,63,153,0.1)" : "0 2px 8px rgba(0,0,0,0.06)",
              }}
            >
              <button
                className="w-full flex items-center justify-between px-6 py-4 text-left group"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                data-testid={`faq-item-${i}`}
              >
                <span
                  className="text-sm font-bold pr-4 transition-colors"
                  style={{ color: openIndex === i ? "#003F99" : "#0D0E14" }}
                >
                  {faq.q}
                </span>
                <ChevronDown
                  size={18}
                  className="flex-shrink-0 transition-transform duration-300"
                  style={{
                    color: "#003F99",
                    transform: openIndex === i ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                />
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    <div
                      className="px-6 pb-5 text-sm leading-relaxed"
                      style={{ color: "#4A4F61", borderTop: "1px solid #E8EAEF" }}
                    >
                      <div className="pt-3">{faq.a}</div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
