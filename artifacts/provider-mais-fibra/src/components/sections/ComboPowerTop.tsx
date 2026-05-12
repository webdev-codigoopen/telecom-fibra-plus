import bgIptv from "@assets/bg-sessao-iptv_1778611391057.png";
import img900 from "@assets/iptv/iptv-900.svg";
import imgWatchPowerTop from "@assets/iptv/iptv-watch-powertop.svg";
import imgPlus from "@assets/iptv/iptv-plus.svg";
import LogoCarousel, { SplitLogoCarousel } from "../LogoCarousel";
import { WHATSAPP_NUMBER } from "../../lib/plans";

const BG_COLOR = "#061CD4";
const GREEN = "#95EB1D";
const FONT_BODY = "'Montserrat', system-ui, sans-serif";
const FONT_PRICE = "'Nexa', 'Montserrat', sans-serif";

export default function ComboPowerTop() {
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    "Olá! Quero contratar o Combo Power Top 900 Mega por R$ 139,90/mês",
  )}`;

  return (
    <section
      id="combo"
      data-testid="combo-section"
      className="relative w-full overflow-hidden flex flex-col items-center justify-center"
      style={{
        minHeight: 695,
        backgroundColor: BG_COLOR,
        backgroundImage: `url(${bgIptv})`,
        backgroundSize: "auto 100%",
        backgroundPosition: "center center",
        backgroundRepeat: "no-repeat",
        paddingTop: 80,
        paddingBottom: 80,
        paddingLeft: 24,
        paddingRight: 24,
        gap: 30,
        color: "#fff",
      }}
    >
      {/* 1. Header */}
      <div className="flex flex-col items-center text-center" style={{ gap: 16 }}>
        <h2
          style={{
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: 40,
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          Combo Power Top
        </h2>
        <p
          style={{
            fontFamily: FONT_BODY,
            fontWeight: 400,
            fontSize: 18,
            lineHeight: 1.3,
            margin: 0,
          }}
        >
          Alterne entre seus streamings favoritos e tenha 3 pelo preço de 1
        </p>
      </div>

      {/* 2. 900 mega + plus + WATCH/POWERTOP */}
      <div
        className="flex items-center justify-center"
        style={{ gap: 17 }}
      >
        <img src={img900} alt="900 mega" width={232} height={85} style={{ display: "block" }} />
        <img src={imgPlus} alt="+" width={36} height={35} style={{ display: "block" }} />
        <img
          src={imgWatchPowerTop}
          alt="Mais pacotes de canais exclusivos — Watch + Power Top"
          width={223}
          height={80}
          style={{ display: "block" }}
        />
      </div>

      {/* 3. Channel logos carousel — pill on desktop, two opposite rows on mobile */}
      <div className="w-full" style={{ maxWidth: 1240 }}>
        {/* Desktop: single infinite row inside white pill */}
        <div
          className="hidden md:block"
          style={{
            backgroundColor: "#fff",
            borderRadius: 24,
            paddingTop: 18,
            paddingBottom: 18,
          }}
        >
          <LogoCarousel logoHeight={56} gap={72} durationSec={350} />
        </div>

        {/* Mobile: two rows (left and right) inside white pill */}
        <div
          className="md:hidden"
          style={{
            backgroundColor: "#fff",
            borderRadius: 20,
            paddingTop: 14,
            paddingBottom: 14,
          }}
        >
          <SplitLogoCarousel logoHeight={36} gap={56} durationSec={260} />
        </div>
      </div>

      {/* 4. Price */}
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
              fontFamily: FONT_BODY,
              fontWeight: 400,
              fontSize: 10,
              lineHeight: 1.1,
              textAlign: "right",
            }}
          >
            POR
            <br />
            APENAS
          </span>
          <span
            style={{
              fontFamily: FONT_BODY,
              fontWeight: 700,
              fontSize: 24,
              color: GREEN,
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
            fontFamily: FONT_PRICE,
            fontWeight: 900,
            fontSize: 87,
            letterSpacing: "-0.04em",
            lineHeight: 0.85,
          }}
        >
          139
        </span>

        <div
          className="flex flex-col items-start leading-none justify-self-start"
          style={{ paddingBottom: 4 }}
        >
          <span
            style={{
              fontFamily: FONT_PRICE,
              fontWeight: 700,
              fontSize: 26,
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}
          >
            ,90
          </span>
          <span
            style={{
              fontFamily: FONT_BODY,
              fontWeight: 700,
              fontSize: 14,
              color: GREEN,
              lineHeight: 1,
              marginTop: 4,
            }}
          >
            /MÊS
          </span>
        </div>
      </div>

      {/* 5. CTA button */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="combo-cta"
        className="inline-flex items-center justify-center transition-colors duration-200 hover:bg-white/10 active:bg-white/20"
        style={{
          height: 55,
          paddingLeft: 40,
          paddingRight: 40,
          borderRadius: 20,
          border: "1px solid #fff",
          color: "#fff",
          fontFamily: FONT_BODY,
          fontWeight: 700,
          fontSize: 18,
          textDecoration: "none",
        }}
      >
        Contrate já e Aproveite
      </a>
    </section>
  );
}
