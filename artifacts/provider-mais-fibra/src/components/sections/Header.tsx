import { useState, useEffect } from "react";
import { Menu, X, Instagram } from "lucide-react";

function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
import logoWhite from "@assets/logo-provider+fibra-branca_1777059547390.png";

const navLinks = [
  { label: "Home", href: "#" },
  { label: "Planos", href: "#planos" },
  { label: "IPTV", href: "#iptv" },
  { label: "Sobre Nós", href: "#sobre" },
  { label: "Onde Estamos", href: "#cobertura" },
  { label: "Contato", href: "#contato" },
];

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNav = (href: string) => {
    setIsOpen(false);
    if (href === "#") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header
      data-testid="header"
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled
          ? "rgba(0, 45, 117, 0.97)"
          : "linear-gradient(135deg, #002D75 0%, #003F99 100%)",
        boxShadow: scrolled ? "0 2px 20px rgba(0,0,0,0.25)" : "none",
      }}
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16 flex items-center justify-between h-16">
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); handleNav("#"); }}
          className="flex-shrink-0"
        >
          <img src={logoWhite} alt="Provider Mais Fibra" className="h-9 w-auto" />
        </a>

        <nav className="hidden lg:flex items-center gap-7">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={(e) => { e.preventDefault(); handleNav(link.href); }}
              className="text-white/90 hover:text-white text-sm font-semibold transition-colors duration-200"
              data-testid={`nav-link-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-4">
          <a
            href="https://wa.me/5577998444757"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/80 hover:text-white transition-colors"
            title="WhatsApp"
            data-testid="header-whatsapp"
          >
            <WhatsAppIcon size={18} />
          </a>
          <a
            href="https://instagram.com/provider.fibra"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/80 hover:text-white transition-colors"
            title="Instagram"
            data-testid="header-instagram"
          >
            <Instagram size={18} />
          </a>
          <a
            href="#planos"
            onClick={(e) => { e.preventDefault(); handleNav("#planos"); }}
            data-testid="header-cta"
            className="ml-2 px-5 py-2 rounded-lg text-sm font-bold text-[#0D0E14] transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: "linear-gradient(90deg, #FF8C00 0%, #FFD600 100%)",
              boxShadow: "0 4px 12px rgba(255,140,0,0.35)",
            }}
          >
            Assine Agora
          </a>
        </div>

        <button
          className="lg:hidden text-white p-2"
          onClick={() => setIsOpen(!isOpen)}
          data-testid="header-mobile-menu"
          aria-label="Menu"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {isOpen && (
        <div
          className="lg:hidden px-4 pb-4 pt-2"
          style={{ background: "rgba(0, 31, 96, 0.98)" }}
        >
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={(e) => { e.preventDefault(); handleNav(link.href); }}
              className="block py-3 text-white/90 hover:text-white text-sm font-semibold border-b border-white/10 transition-colors"
            >
              {link.label}
            </a>
          ))}
          <div className="flex items-center gap-4 pt-4">
            <a
              href="https://wa.me/5577998444757"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/80 hover:text-white"
            >
              <WhatsAppIcon size={18} />
            </a>
            <a
              href="https://instagram.com/provider.fibra"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/80 hover:text-white"
            >
              <Instagram size={18} />
            </a>
            <a
              href="#planos"
              onClick={(e) => { e.preventDefault(); handleNav("#planos"); }}
              className="ml-auto px-5 py-2 rounded-lg text-sm font-bold text-[#0D0E14]"
              style={{ background: "linear-gradient(90deg, #FF8C00 0%, #FFD600 100%)" }}
            >
              Assine Agora
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
