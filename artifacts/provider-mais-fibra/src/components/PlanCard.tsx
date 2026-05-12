import { motion } from "framer-motion";
import { type Plan, buildWhatsAppUrl, buildPlanShareUrl } from "../lib/plans";

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
  cardBgFrom: "#2C41DA",
  cardBgTo: "#172DD8",
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
    body: JSON.stringify({
      planSpeed: plan.speed,
      planPrice: plan.price,
      source,
    }),
  }).catch((err) => {
    console.warn("[PlanCard] Failed to record click event:", err);
  });
}

function StreamingBox({ logos }: { logos: "watch" | "watch+powertop" }) {
  const src = logos === "watch+powertop" ? LOGO_WATCH_POWERTOP : LOGO_WATCH;
  const intrinsicH = logos === "watch+powertop" ? 80 : 76;
  const alt =
    logos === "watch+powertop"
      ? "+ Assinatura inclusa Watch + Power Top"
      : "+ Assinatura inclusa Watch";
  return (
    <div className="plans-section__streaming flex justify-center">
      <img
        src={src}
        alt={alt}
        width={223}
        height={intrinsicH}
        style={{ width: 223, height: intrinsicH }}
        className="max-w-full"
      />
    </div>
  );
}

export default function PlanCard({
  plan,
  index = 0,
  idSuffix = "",
  source = "hero",
}: Props) {
  const shareUrl = plan.id != null ? buildPlanShareUrl(plan.id) : undefined;
  const whatsappUrl = buildWhatsAppUrl(plan, shareUrl);
  const [reais, centavos] = plan.price.split(",");

  const has600Streaming = plan.speed === "600";
  const has900Streaming = plan.speed === "900";
  const hasStreaming = has600Streaming || has900Streaming;

  // Figma: cards with streaming = padding-top 30 / gap 11; without = padding-top 50 / gap 30
  const paddingTop = hasStreaming ? 30 : 50;
  const innerGap = hasStreaming ? 11 : 30;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08, duration: 0.45 }}
      data-testid={`plan-card-${plan.speed}${idSuffix}`}
      className="plans-section__card relative flex flex-col w-full sm:w-[295px] sm:h-[490px]"
      style={{
        paddingTop,
        paddingBottom: 20,
        paddingLeft: 25,
        paddingRight: 25,
        gap: innerGap,
        background: `linear-gradient(135deg, ${COLORS.cardBgFrom} 20%, ${COLORS.cardBgTo} 96%)`,
        border: `1px solid ${COLORS.cardBorder}`,
        borderRadius: 18,
        boxShadow: COLORS.cardShadow,
        fontFamily: FONT_BODY,
        color: COLORS.white,
      }}
    >
      {/* Top block: header + speed + icons */}
      <div className="flex flex-col items-center" style={{ gap: 15 }}>
        {/* INTERNET 100% FIBRA */}
        <div
          className="text-center font-normal"
          style={{
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "0.02em",
            color: COLORS.white,
          }}
        >
          INTERNET <span style={{ fontWeight: 800 }}>100% FIBRA</span>
        </div>

        {/* Speed + MEGA tag */}
        <div
          className="relative flex items-center justify-center"
          style={{ height: 95 }}
        >
          <span
            className="leading-none"
            style={{
              fontSize: 111,
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
              left: "calc(76% + 1.55ch)",
              top: "50%",
              transform: "translateY(-50%)",
            }}
          />
        </div>

        {/* Icons row — driven by plan.inclusions order */}
        {(() => {
          const ICON_MAP: Record<
            string,
            { src: string; label: string; w: number; h: number }
          > = {
            "Instalação Grátis": {
              src: ICON_INSTALACAO,
              label: "INSTALAÇÃO",
              w: 20,
              h: 20,
            },
            "Roteador Wi-Fi": {
              src: ICON_ROTEADOR,
              label: "ROTEADOR",
              w: 29,
              h: 20,
            },
            "Roteador Wi-Fi 6": {
              src: ICON_ROTEADOR,
              label: "ROTEADOR WI-FI 6",
              w: 29,
              h: 20,
            },
            "100 Canais": { src: ICON_CANAIS, label: "CANAIS", w: 64, h: 20 },
            Watch: { src: LOGO_WATCH, label: "WATCH", w: 92, h: 20 },
            "Power Top": {
              src: LOGO_WATCH_POWERTOP,
              label: "POWER TOP",
              w: 92,
              h: 20,
            },
          };
          const items = plan.inclusions
            .map((name) => ({ name, def: ICON_MAP[name] }))
            .filter(
              (
                x,
              ): x is {
                name: string;
                def: { src: string; label: string; w: number; h: number };
              } => Boolean(x.def),
            );
          if (items.length === 0) return null;
          return (
            <div className="flex items-end justify-center" style={{ gap: 16 }}>
              {items.map((item, i) => (
                <div
                  key={`${item.name}-${i}`}
                  className="flex flex-col items-center"
                  style={{ gap: 6 }}
                >
                  <img
                    src={item.def.src}
                    alt=""
                    width={item.def.w}
                    height={item.def.h}
                  />
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: FONT_BODY,
                      fontWeight: 500,
                      color: COLORS.white,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {item.def.label}
                  </span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
      {/* Streaming bonus (600 / 900) */}
      {has600Streaming && <StreamingBox logos="watch" />}
      {has900Streaming && <StreamingBox logos="watch+powertop" />}
      {/* Bottom block: price + CTA + footer (Figma Frame 33: gap 5, naturally compact) */}
      <div
        className={`flex flex-col ${hasStreaming ? "mt-auto" : ""}`}
        style={{ gap: 5 }}
      >
        {/* Price block — 3-col grid keeps the big numeral optically centered */}
        <div
          className="grid items-end justify-center"
          style={{ gridTemplateColumns: "1fr auto 1fr", columnGap: 6 }}
        >
          <div
            className="flex flex-col items-end leading-none justify-self-end"
            style={{ paddingBottom: 8 }}
          >
            <span
              style={{
                fontSize: 8,
                fontFamily: FONT_SPEED,
                fontWeight: 400,
                color: COLORS.white,
                lineHeight: 1,
              }}
            >
              POR
            </span>
            <span
              style={{
                fontSize: 8,
                fontFamily: FONT_SPEED,
                fontWeight: 400,
                color: COLORS.white,
                lineHeight: 1,
                marginTop: 2,
              }}
            >
              APENAS
            </span>
            <span
              style={{
                fontSize: 21,
                fontFamily: FONT_SPEED,
                color: COLORS.green,
                lineHeight: 1,
                marginTop: 4,
              }}
            >
              R$
            </span>
          </div>
          <span
            className="leading-none"
            style={{
              fontSize: 70,
              fontFamily: FONT_PRICE,
              fontWeight: 900,
              color: COLORS.white,
              letterSpacing: "-0.04em",
              lineHeight: 0.85,
            }}
          >
            {reais}
          </span>
          <div
            className="flex flex-col items-start leading-none justify-self-start"
            style={{ paddingBottom: 4 }}
          >
            <span
              style={{
                fontSize: 26,
                fontFamily: FONT_PRICE,
                fontWeight: 700,
                color: COLORS.white,
                letterSpacing: "-0.04em",
                lineHeight: 1,
              }}
            >
              ,{centavos ?? "00"}
            </span>
            <span
              style={{
                fontSize: 12,
                fontFamily: FONT_SPEED,
                fontWeight: 400,
                color: COLORS.green,
                lineHeight: 1,
                marginTop: 4,
              }}
            >
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
          className="plans-section__cta flex items-center justify-center transition-all duration-200 hover:bg-white/10 active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-[#95EB1D]"
          style={{
            gap: 8,
            width: "100%",
            height: 40,
            borderRadius: 8,
            border: `1.5px solid ${COLORS.white}`,
            color: COLORS.white,
            fontFamily: FONT_BODY,
            fontSize: 14,
            fontWeight: 500,
            letterSpacing: "0.04em",
          }}
        >
          <img src={ICON_WHATSAPP} alt="" width={16} height={16} />
          <span>ASSINE JÁ</span>
        </a>

        {/* Footer note */}
        <p
          className="text-center italic"
          style={{
            fontSize: 10,
            fontFamily: FONT_BODY,
            fontWeight: 400,
            lineHeight: "14.4px",
            color: COLORS.whiteFaint,
          }}
        >
          *Consultar a disponibilidade
          <br />
          de planos na sua cidade
        </p>
      </div>
    </motion.div>
  );
}
