import { useLocation } from "wouter";
import logoVerticalWhite from "@assets/logo-provider+fibra-_vertical-branco_1777059547389.png";
import { cities as cityList } from "@/lib/cities";

const links = [
  { label: "Planos", href: "#planos", page: false },
  { label: "IPTV", href: "#iptv", page: false },
  { label: "Sobre N\u00F3s", href: "/quem-somos", page: true },
  { label: "Mapa de Demanda", href: "/demanda", page: true },
  { label: "Indique um Amigo", href: "/indique-um-amigo", page: true },
  { label: "Tire suas d\u00FAvidas", href: "#faq", page: false },
];

const cities = [...cityList]
  .map((c) => ({ name: c.name, slug: c.slug }))
  .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

function InstagramIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="#FFFFFF" stroke="none" />
    </svg>
  );
}

function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#FFFFFF" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

const TEXT_COLOR = "#FFFFFF";
const HEADING_FONT = "Nunito, sans-serif";
const BODY_FONT = "Nunito, sans-serif";
const PARA_FONT = "Montserrat, sans-serif";

export default function Footer() {
  const [location, navigate] = useLocation();

  const handleNav = (href: string, page: boolean) => {
    if (page) {
      navigate(href);
      window.scrollTo({ top: 0 });
      return;
    }
    if (location !== "/") {
      navigate("/");
      setTimeout(() => {
        const el = document.querySelector(href);
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 150);
    } else {
      const el = document.querySelector(href);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const headingStyle: React.CSSProperties = {
    fontFamily: HEADING_FONT,
    fontWeight: 700,
    fontSize: 14,
    lineHeight: "20px",
    color: TEXT_COLOR,
    margin: 0,
  };

  const bodyStyle: React.CSSProperties = {
    fontFamily: BODY_FONT,
    fontWeight: 400,
    fontSize: 14,
    lineHeight: "20px",
    color: TEXT_COLOR,
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: BODY_FONT,
    fontWeight: 600,
    fontSize: 12,
    lineHeight: "16px",
    color: TEXT_COLOR,
    textTransform: "uppercase",
    margin: 0,
  };

  return (
    <footer
      data-testid="footer"
      style={{
        backgroundColor: "#043198",
        paddingTop: 64,
        paddingBottom: 24,
        width: "100%",
      }}
    >
      <div
        className="footer-container"
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          paddingLeft: 64,
          paddingRight: 64,
          boxSizing: "border-box",
        }}
      >
        {/* Top section with bottom border */}
        <div
          className="footer-top"
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 68,
            paddingBottom: 32,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {/* Col 1 — Brand */}
          <div
            className="footer-brand"
            style={{
              width: 271,
              display: "flex",
              flexDirection: "column",
              gap: 15.1,
              flexShrink: 0,
            }}
          >
            <img
              src={logoVerticalWhite}
              alt="Provider Mais Fibra"
              width={125}
              height={64}
              loading="lazy"
              decoding="async"
              style={{ width: 125, height: 64, objectFit: "contain", display: "block" }}
            />
            <p
              style={{
                fontFamily: PARA_FONT,
                fontWeight: 400,
                fontSize: 14,
                lineHeight: "22.75px",
                color: TEXT_COLOR,
                margin: 0,
                width: 271,
              }}
            >
              Internet de alta velocidade com fibra &oacute;ptica 100% para o
              Oeste da Bahia. Conectando fam&iacute;lias e empresas com
              qualidade e confian&ccedil;a.
            </p>
            <div style={{ display: "flex", flexDirection: "row", gap: 12 }}>
              <a
                href="https://instagram.com/provider.fibra"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                data-testid="footer-instagram"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9999,
                  backgroundColor: "rgba(255,255,255,0.13)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background-color 0.2s",
                }}
              >
                <InstagramIcon size={18} />
              </a>
              <a
                href="https://wa.me/5577998444757"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                data-testid="footer-whatsapp"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9999,
                  backgroundColor: "rgba(255,255,255,0.13)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background-color 0.2s",
                }}
              >
                <WhatsAppIcon size={18} />
              </a>
            </div>
          </div>

          {/* Col 2 — Links Úteis */}
          <div
            style={{
              width: 161,
              display: "flex",
              flexDirection: "column",
              gap: 20,
              flexShrink: 0,
            }}
          >
            <h4 style={headingStyle}>Links &Uacute;teis</h4>
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleNav(link.href, link.page);
                }}
                style={{ ...bodyStyle, textDecoration: "none", cursor: "pointer" }}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Col 3 — Cidades */}
          <div
            style={{
              width: 198,
              display: "flex",
              flexDirection: "column",
              gap: 15,
              flexShrink: 0,
            }}
          >
            <h4 style={headingStyle}>Cidade(s) de Atua&ccedil;&atilde;o</h4>
            {cities.map((c) => (
              <span key={c.slug} style={bodyStyle}>
                {c.name}
              </span>
            ))}
          </div>

          {/* Col 4 — Atendimento */}
          <div
            style={{
              width: 238,
              display: "flex",
              flexDirection: "column",
              gap: 20,
              flexShrink: 0,
            }}
          >
            <h4 style={headingStyle}>Atendimento</h4>

            <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <p style={labelStyle}>WHATSAPP</p>
                <a
                  href="https://wa.me/5577998444757"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontFamily: BODY_FONT,
                    fontWeight: 500,
                    fontSize: 14,
                    lineHeight: "20px",
                    color: TEXT_COLOR,
                    textDecoration: "none",
                  }}
                >
                  (77) 99844-4757
                </a>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <p style={labelStyle}>HOR&Aacute;RIO</p>
                <p style={{ ...bodyStyle, margin: 0 }}>Seg&ndash;Sex: 8h &ndash; 18h</p>
                <p style={{ ...bodyStyle, margin: 0 }}>S&aacute;b: 8h &ndash; 12h</p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <p style={labelStyle}>Endere&ccedil;o sede</p>
                <p style={{ ...bodyStyle, margin: 0 }}>
                  Edif&iacute;cio S&atilde;o Matheus, t&eacute;rreo &ndash; n&deg;49
                </p>
                <p style={{ ...bodyStyle, margin: 0 }}>
                  Rua Jos&eacute; Rocha &ndash; Centro - BA &ndash; 47800-184
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="footer-bottom"
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 24,
            gap: 16,
          }}
        >
          <p
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 400,
              fontSize: 12,
              lineHeight: "16.8px",
              color: TEXT_COLOR,
              margin: 0,
            }}
          >
            &copy; 2026 Provider Mais Fibra. Todos os direitos reservados. · CNPJ 28.632.900/0001-70
          </p>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 16 }}>
            <a
              href="/politica-de-privacidade"
              onClick={(e) => {
                e.preventDefault();
                navigate("/politica-de-privacidade");
                window.scrollTo({ top: 0 });
              }}
              style={{
                fontFamily: BODY_FONT,
                fontWeight: 400,
                fontSize: 12,
                lineHeight: "16px",
                color: TEXT_COLOR,
                textDecoration: "none",
              }}
            >
              Pol&iacute;tica de Privacidade
            </a>
            <span
              style={{
                fontFamily: BODY_FONT,
                fontWeight: 400,
                fontSize: 16,
                lineHeight: "24px",
                color: TEXT_COLOR,
              }}
              aria-hidden="true"
            >
              |
            </span>
            <a
              href="/termos-de-uso"
              onClick={(e) => {
                e.preventDefault();
                navigate("/termos-de-uso");
                window.scrollTo({ top: 0 });
              }}
              style={{
                fontFamily: BODY_FONT,
                fontWeight: 400,
                fontSize: 12,
                lineHeight: "16px",
                color: TEXT_COLOR,
                textDecoration: "none",
              }}
            >
              Termos de Uso
            </a>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1023px) {
          .footer-top { flex-wrap: wrap !important; gap: 40px !important; }
          .footer-top > div { width: calc(50% - 20px) !important; }
        }
        @media (max-width: 599px) {
          .footer-container { padding-left: 24px !important; padding-right: 24px !important; }
          .footer-top > div { width: 100% !important; }
          .footer-brand { align-items: flex-start !important; text-align: left !important; }
          .footer-brand p { width: 100% !important; }
          .footer-brand > div { justify-content: flex-start !important; }
          .footer-bottom { flex-direction: column !important; align-items: flex-start !important; }
        }
      `}</style>
    </footer>
  );
}
