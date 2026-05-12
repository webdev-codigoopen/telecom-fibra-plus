import { useState } from "react";
import { motion } from "framer-motion";

const BASE = import.meta.env.BASE_URL;
const CHEVRON = `${BASE}images/icons/chevron-down.svg`;

const FONT_NUNITO = "'Nunito', system-ui, sans-serif";
const FONT_MONTSERRAT = "'Montserrat', system-ui, sans-serif";

const COLOR_HEADING = "#003F99";
const COLOR_SUBTITLE = "#4A4F61";
const COLOR_BORDER = "#E8EAEF";
const COLOR_ITEM_TEXT = "#0D0E14";

type FaqItem = {
  q: string;
  a: string;
};

const leftItems: FaqItem[] = [
  {
    q: "Como é feita a instalação?",
    a: "A instalação é feita por nossa equipe técnica especializada, sem custo adicional nos planos selecionados. Agendamos no melhor horário para você.",
  },
  {
    q: "Quanto tempo leva para instalar minha internet?",
    a: "Após a confirmação do plano, a instalação é realizada em até 48 horas úteis na maioria das cidades atendidas.",
  },
  {
    q: "O que está incluso em todos os planos?",
    a: "Todos os planos incluem instalação grátis, roteador Wi-Fi e mais de 100 canais de TV via aplicativo.",
  },
  {
    q: "O que é o serviço de IPTV?",
    a: "É a transmissão de canais de TV pela internet, permitindo assistir em smart TVs, celulares e tablets com qualidade HD.",
  },
  {
    q: "Como funciona o suporte 24h?",
    a: "Nossa equipe está disponível 24 horas por dia, 7 dias por semana, via WhatsApp, telefone e e-mail para qualquer dúvida ou problema.",
  },
];

const rightItems: FaqItem[] = [
  {
    q: "Minha internet está lenta, o que posso fazer?",
    a: "Reinicie o roteador, verifique se há aparelhos consumindo banda e teste a velocidade. Se persistir, fale com nosso suporte 24h.",
  },
  {
    q: "Como emitir a 2ª via do boleto?",
    a: "Acesse a área do cliente em nosso site ou aplicativo, ou solicite via WhatsApp para receber a segunda via instantaneamente.",
  },
  {
    q: "Como cancelar minha assinatura?",
    a: "Entre em contato com nosso atendimento. O cancelamento é gratuito e processado conforme as condições do contrato.",
  },
  {
    q: "A Provider atende na minha cidade?",
    a: "Atendemos 12 cidades do Oeste da Bahia, incluindo Barreiras, Luís Eduardo Magalhães, Barra, Buritirama, Mansidão e outras.",
  },
  {
    q: "Qual a melhor velocidade para home office e streaming?",
    a: "Para home office e streaming em alta qualidade, recomendamos os planos de 400 Mega ou superiores, garantindo estabilidade.",
  },
];

function FaqRow({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="bg-white"
      style={{
        border: `1px solid ${COLOR_BORDER}`,
        borderRadius: 12,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between cursor-pointer"
        style={{
          paddingLeft: 24,
          paddingRight: 24,
          paddingTop: 16,
          paddingBottom: 16,
          background: "transparent",
          border: 0,
          textAlign: "left",
        }}
      >
        <span
          style={{
            fontFamily: FONT_NUNITO,
            fontWeight: 700,
            fontSize: 14,
            lineHeight: "20px",
            color: COLOR_ITEM_TEXT,
            opacity: 0.61,
          }}
        >
          {item.q}
        </span>
        <img
          src={CHEVRON}
          alt=""
          aria-hidden="true"
          width={18}
          height={18}
          style={{
            display: "block",
            width: 18,
            height: 18,
            flexShrink: 0,
            marginLeft: 16,
            transition: "transform 0.25s ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>
      {open && (
        <div
          style={{
            paddingLeft: 24,
            paddingRight: 24,
            paddingBottom: 16,
            fontFamily: FONT_NUNITO,
            fontWeight: 400,
            fontSize: 14,
            lineHeight: "20px",
            color: COLOR_ITEM_TEXT,
            opacity: 0.75,
          }}
        >
          {item.a}
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  return (
    <section
      id="faq"
      data-testid="faq-section"
      style={{
        background: "#FBFBFB",
        paddingTop: 40,
        paddingBottom: 100,
      }}
    >
      <div
        className="mx-auto flex flex-col w-full px-6 lg:px-0"
        style={{ maxWidth: 1022, rowGap: 30 }}
      >
        {/* Heading group: gap 12 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center text-center"
          style={{ rowGap: 12 }}
        >
          <h2
            className="m-0"
            style={{
              fontFamily: FONT_MONTSERRAT,
              fontWeight: 400,
              fontSize: 32,
              lineHeight: "40px",
              color: COLOR_HEADING,
            }}
          >
            Tire suas <span style={{ fontWeight: 800 }}>Dúvidas</span>
          </h2>
          <p
            className="m-0"
            style={{
              fontFamily: FONT_NUNITO,
              fontWeight: 400,
              fontSize: 16,
              lineHeight: "24px",
              color: COLOR_SUBTITLE,
            }}
          >
            As perguntas mais frequentes dos nossos clientes
          </p>
        </motion.div>

        {/* Two columns of FAQ items */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 w-full"
          style={{ columnGap: 22, rowGap: 8 }}
        >
          <div className="flex flex-col" style={{ rowGap: 8 }}>
            {leftItems.map((item) => (
              <FaqRow key={item.q} item={item} />
            ))}
          </div>
          <div className="flex flex-col" style={{ rowGap: 8 }}>
            {rightItems.map((item) => (
              <FaqRow key={item.q} item={item} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
