import { Instagram } from "lucide-react";
import logoVerticalWhite from "@assets/logo-provider+fibra-_vertical-branco_1777059547389.png";

const links = [
  { label: "Home", href: "#" },
  { label: "Planos", href: "#planos" },
  { label: "IPTV", href: "#iptv" },
  { label: "Sobre Nós", href: "#sobre" },
  { label: "Onde Estamos", href: "#cobertura" },
  { label: "Trabalhe Conosco", href: "#" },
  { label: "Blog", href: "#" },
];

export default function Footer() {
  const handleNav = (href: string) => {
    if (href === "#") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <footer
      data-testid="footer"
      style={{ background: "#0D0E14" }}
      className="pt-16 pb-6"
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 pb-12 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div>
            <img src={logoVerticalWhite} alt="Provider Mais Fibra" className="h-16 w-auto mb-4" />
            <p className="text-white/50 text-sm leading-relaxed mb-5">
              Internet de alta velocidade com fibra óptica 100% para o Oeste da Bahia. Conectando famílias e empresas com qualidade e confiança.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="https://instagram.com/provider.fibra"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}
                data-testid="footer-instagram"
              >
                <Instagram size={16} color="rgba(255,255,255,0.7)" />
              </a>
              <a
                href="https://wa.me/5577998444757"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}
                data-testid="footer-whatsapp"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-white/70">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-white font-bold text-sm mb-5">Links Úteis</h4>
            <ul className="space-y-2.5">
              {links.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    onClick={(e) => { e.preventDefault(); handleNav(link.href); }}
                    className="text-white/50 hover:text-white text-sm transition-colors duration-200"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold text-sm mb-5">Atendimento</h4>
            <div className="space-y-3">
              <div>
                <p className="text-white/30 text-xs uppercase tracking-wide font-semibold mb-1">WhatsApp</p>
                <a
                  href="https://wa.me/5577998444757"
                  className="text-white/70 hover:text-white text-sm font-medium transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  (77) 99844-4757
                </a>
              </div>
              <div>
                <p className="text-white/30 text-xs uppercase tracking-wide font-semibold mb-1">Horário</p>
                <p className="text-white/60 text-sm">Seg–Sex: 8h – 18h</p>
                <p className="text-white/60 text-sm">Sáb: 8h – 12h</p>
              </div>
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ background: "rgba(0,168,107,0.2)", color: "#00A86B" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#00A86B] animate-pulse" />
                Suporte 24h via WhatsApp
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-white font-bold text-sm mb-5">Certificacoes</h4>
            <div
              className="inline-flex flex-col items-center justify-center px-6 py-5 rounded-xl mb-3 text-center"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-2"
                style={{ background: "linear-gradient(135deg, #003F99 0%, #0055B8 100%)" }}
              >
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current text-white">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
                </svg>
              </div>
              <p className="text-white font-bold text-sm">Anatel</p>
              <p className="text-white/50 text-xs mt-0.5">Operadora Homologada</p>
            </div>
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: "rgba(255,214,0,0.1)", color: "#FFD600", border: "1px solid rgba(255,214,0,0.2)" }}
            >
              2026
            </div>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-white/30 text-xs">
            © 2026 Provider Mais Fibra. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-white/30 hover:text-white/60 text-xs transition-colors">
              Política de Privacidade
            </a>
            <span className="text-white/20">|</span>
            <a href="#" className="text-white/30 hover:text-white/60 text-xs transition-colors">
              Termos de Uso
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
