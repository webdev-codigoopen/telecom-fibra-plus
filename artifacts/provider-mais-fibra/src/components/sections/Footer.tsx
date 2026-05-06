import { Instagram, MapPin, Clock } from "lucide-react";
import { useLocation } from "wouter";
import logoVerticalWhite from "@assets/logo-provider+fibra-_vertical-branco_1777059547389.png";

const links = [
  { label: "Home", href: "/", page: true },
  { label: "Planos", href: "#planos", page: false },
  { label: "Sobre Nós", href: "/quem-somos", page: true },
  { label: "Onde Estamos", href: "/onde-estamos", page: true },
  { label: "Tire suas dúvidas", href: "#faq", page: false },
];

const cities = [
  "Barra", "Barreiras", "Buritirama", "Correntina", "Luís Eduardo Magalhães",
  "Mansidão", "Muquém", "Posto Rosário", "Roda Velha", "Santa Rita", "Wanderley",
];

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

  return (
    <footer
      data-testid="footer"
      style={{ background: "#001A6E" }}
      className="pt-16 pb-6"
    >
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-12">
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 pb-10 border-b"
          style={{ borderColor: "rgba(255,255,255,0.10)" }}
        >
          {/* Col 1 - Brand */}
          <div>
            <img src={logoVerticalWhite} alt="Provider Mais Fibra" className="h-16 w-auto mb-4" />
            <p className="text-white/65 text-sm leading-relaxed mb-5">
              Internet de alta velocidade com fibra óptica 100% para o Oeste da Bahia. Conectando famílias e empresas com qualidade e confiança.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="https://instagram.com/provider.fibra"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
                data-testid="footer-instagram"
              >
                <Instagram size={16} color="rgba(255,255,255,0.85)" />
              </a>
              <a
                href="https://wa.me/5577998444757"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                style={{ background: "rgba(0,192,64,0.15)", border: "1px solid rgba(0,192,64,0.3)" }}
                data-testid="footer-whatsapp"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" style={{ color: "#00D94A" }}>
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Col 2 - Links */}
          <div>
            <h4 className="text-white font-bold text-sm mb-5 uppercase tracking-wider">Links Úteis</h4>
            <ul className="space-y-2.5">
              {links.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    onClick={(e) => { e.preventDefault(); handleNav(link.href, link.page); }}
                    className="text-white/65 hover:text-[#00D94A] text-sm transition-colors duration-200"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3 - Cities */}
          <div>
            <h4 className="text-white font-bold text-sm mb-5 uppercase tracking-wider">Cidades de Atuação</h4>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-2">
              {cities.map((c) => (
                <li key={c} className="text-white/65 text-xs flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-[#00C040]" />
                  {c}
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4 - Atendimento */}
          <div>
            <h4 className="text-white font-bold text-sm mb-5 uppercase tracking-wider">Atendimento</h4>
            <div className="space-y-4">
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider font-bold mb-1">WhatsApp</p>
                <a
                  href="https://wa.me/5577998444757"
                  className="text-white hover:text-[#00D94A] text-sm font-bold transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  (77) 99844-4757
                </a>
              </div>
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider font-bold mb-1 flex items-center gap-1.5">
                  <Clock size={10} /> Horário
                </p>
                <p className="text-white/70 text-xs">Seg–Sex: 8h às 18h</p>
                <p className="text-white/70 text-xs">Sáb: 8h às 12h</p>
              </div>
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider font-bold mb-1 flex items-center gap-1.5">
                  <MapPin size={10} /> Endereço
                </p>
                <p className="text-white/70 text-xs leading-relaxed">
                  Edifício São Matheus, térreo n° 49<br />
                  Rua José Rocha — Centro<br />
                  Barreiras — BA, 47800-184
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-white/40 text-xs">
            © 2026 Provider Mais Fibra. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-white/40 hover:text-white/70 text-xs transition-colors">
              Política de Privacidade
            </a>
            <span className="text-white/20">|</span>
            <a href="#" className="text-white/40 hover:text-white/70 text-xs transition-colors">
              Termos de Uso
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
