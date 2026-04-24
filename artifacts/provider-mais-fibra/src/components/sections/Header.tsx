import { useState, useEffect } from "react";
import { Menu, X, Phone, Instagram } from "lucide-react";
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
            <Phone size={18} />
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
              <Phone size={18} />
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
