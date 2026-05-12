import { motion } from "framer-motion";
import { type Plan, buildWhatsAppUrl } from "../lib/plans";

const BASE = import.meta.env.BASE_URL;
const ICON_INSTALACAO = `${BASE}images/icons/instalacao-planos-20.svg`;
const ICON_ROTEADOR = `${BASE}images/icons/roteador-planos-29x20.svg`;
const ICON_CANAIS = `${BASE}images/icons/canais-planos-64x20.svg`;
const ICON_WHATSAPP = `${BASE}images/icons/whatsapp-planos-16.svg`;
const TAG_MEGA = `${BASE}images/icons/mega-tag-planos-47x16.svg`;
const LOGO_WATCH = `${BASE}images/icons/watch-planos-193x42.svg`;
const LOGO_WATCH_POWERTOP = `${BASE}images/icons/watch-powertop-planos-193x42.svg`;

const FONT_BODY = "'Montserrat', system-ui, sans-serif";
const FONT_SPEED = "'Amino', 'Montserrat', sans-serif";
const FONT_PRICE = "'Nexa', 'Montserrat', sans-serif";

const COLORS = {
  cardBg: "#1A38D5",
  cardBorder: "rgba(255,255,255,0.08)",
  cardShadow: "0 12px 36px rgba(0, 8, 80, 0.35)",
  white: "#FFFFFF",
  whiteSoft: "rgba(255,255,255,0.85)",
  whiteFaint: "rgba(255,255,255,0.65)",
  green: "#95EB1D",
};

type Props = {
  plan: Plan;
  index?: number;
  idSuffix?: string;
  source?: string;
};

function trackPlanClick(plan: Plan, source: string) {
  const baseUrl = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  fetch(`${baseUrl}/api/clicks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planSpeed: plan.speed, planPrice: plan.price, source }),
  }).catch((err) => {
    console.warn("[PlanCard] Failed to record click event:", err);
  });
}

function StreamingBox({ logos }: { logos: "watch" | "watch+powertop" }) {
  const src = logos === "watch+powertop" ? LOGO_WATCH_POWERTOP : LOGO_WATCH;
  const alt =
    logos === "watch+powertop"
      ? "+ Assinatura inclusa Watch + Power Top"
      : "+ Assinatura inclusa Watch";
  return (
    <div className="plans-section__streaming flex justify-center mb-5">
      <img src={src} alt={alt} width={193} height={42} className="max-w-full h-auto" />
    </div>
  );
}

export default function PlanCard({ plan, index = 0, idSuffix = "", source = "hero" }: Props) {
  const whatsappUrl = buildWhatsAppUrl(plan);
  const [reais, centavos] = plan.price.split(",");

  const has600Streaming = plan.speed === "600";
  const has900Streaming = plan.speed === "900";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08, duration: 0.45 }}
      data-testid={`plan-card-${plan.speed}${idSuffix}`}
      className="plans-section__card relative flex flex-col h-full rounded-2xl px-6 pt-7 pb-6"
      style={{
        background: COLORS.cardBg,
        border: `1px solid ${COLORS.cardBorder}`,
        boxShadow: COLORS.cardShadow,
        fontFamily: FONT_BODY,
        color: COLORS.white,
      }}
    >
      {/* "INTERNET 100% FIBRA" header */}
      <div
        className="text-center text-[12px] tracking-[0.04em] mb-3"
        style={{ color: COLORS.white, fontWeight: 600 }}
      >
        INTERNET <span style={{ fontWeight: 800 }}>100% FIBRA</span>
      </div>

      {/* Speed + MEGA tag (tag overlaps the last 0, centered vertically on it) */}
      <div className="relative flex items-center justify-center mb-5" style={{ height: 88 * 0.85 }}>
        <span
          className="leading-none"
          style={{
            fontSize: 88,
            fontFamily: FONT_SPEED,
            color: COLORS.white,
            letterSpacing: "-0.02em",
            lineHeight: 0.85,
          }}
        >
          {plan.speed}
        </span>
        <img
          src={TAG_MEGA}
          alt="Mega"
          width={47}
          height={16}
          className="absolute pointer-events-none"
          style={{
            left: "calc(50% + 1.05ch)",
            top: "50%",
            transform: "translateY(-50%)",
          }}
        />
      </div>

      {/* Icons row */}
      <div className="flex items-start justify-center gap-5 mb-5">
        <div className="flex flex-col items-center gap-1.5">
          <img src={ICON_INSTALACAO} alt="" width={20} height={20} />
          <span className="text-[10px] tracking-[0.05em]" style={{ color: COLORS.whiteSoft, fontFamily: FONT_BODY, fontWeight: 600 }}>
            INSTALAÇÃO
          </span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <img src={ICON_ROTEADOR} alt="" width={29} height={20} />
          <span className="text-[10px] tracking-[0.05em]" style={{ color: COLORS.whiteSoft, fontFamily: FONT_BODY, fontWeight: 600 }}>
            ROTEADOR
          </span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <img src={ICON_CANAIS} alt="" width={64} height={20} />
          <span className="text-[10px] tracking-[0.05em]" style={{ color: COLORS.whiteSoft, fontFamily: FONT_BODY, fontWeight: 600 }}>
            CANAIS
          </span>
        </div>
      </div>

      {/* Streaming bonus (600 / 900) */}
      {has600Streaming && <StreamingBox logos="watch" />}
      {has900Streaming && <StreamingBox logos="watch+powertop" />}

      {/* Price block */}
      <div className="flex items-end justify-center gap-2 mb-6 mt-auto">
        <div className="flex flex-col items-end leading-none pb-2">
          <span className="text-[10px] tracking-[0.05em]" style={{ color: COLORS.green, fontFamily: FONT_BODY, fontWeight: 700 }}>
            POR
          </span>
          <span className="text-[10px] tracking-[0.05em]" style={{ color: COLORS.green, fontFamily: FONT_BODY, fontWeight: 700 }}>
            APENAS
          </span>
          <span className="text-[20px] mt-1" style={{ color: COLORS.green, fontFamily: FONT_PRICE }}>
            R$
          </span>
        </div>
        <span
          className="leading-none"
          style={{
            fontSize: 56,
            fontFamily: FONT_PRICE,
            color: COLORS.white,
            letterSpacing: "-0.02em",
            lineHeight: 0.85,
          }}
        >
          {reais}
        </span>
        <div className="flex flex-col items-start leading-none pb-1">
          <span className="text-[14px]" style={{ color: COLORS.white, fontFamily: FONT_PRICE }}>
            ,{centavos ?? "00"}
          </span>
          <span className="text-[10px] tracking-[0.05em]" style={{ color: COLORS.whiteSoft, fontFamily: FONT_BODY, fontWeight: 600 }}>
            /MÊS
          </span>
        </div>
      </div>

      {/* CTA */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-testid={`plan-cta-${plan.speed}${idSuffix}`}
        onClick={() => trackPlanClick(plan, source)}
        className="plans-section__cta flex items-center justify-center gap-2 w-full h-11 rounded-lg text-[14px] transition-all duration-200 hover:bg-white/10 active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-[#95EB1D]"
        style={{
          border: `1.5px solid ${COLORS.white}`,
          color: COLORS.white,
          fontWeight: 700,
          letterSpacing: "0.04em",
        }}
      >
        <img src={ICON_WHATSAPP} alt="" width={16} height={16} />
        <span>ASSINE JÁ</span>
      </a>

      {/* Footer note */}
      <p
        className="text-center text-[10px] mt-4 italic leading-tight"
        style={{ color: COLORS.whiteFaint, fontWeight: 400 }}
      >
        *Consultar a disponibilidade<br />de planos na sua cidade
      </p>
    </motion.div>
  );
}
