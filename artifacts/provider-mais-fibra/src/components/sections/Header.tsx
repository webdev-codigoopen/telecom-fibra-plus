import { useState, useEffect, useRef } from "react";
import { Menu, X, Instagram } from "lucide-react";
import { useLocation } from "wouter";
import logoWhite from "@assets/logo-provider+fibra-branca_1777059547390.png";

function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

type NavLink = {
  label: string;
  href: string;
  page?: string;
};

const navLinks: NavLink[] = [
  { label: "Home", href: "/", page: "/" },
  { label: "Planos", href: "#planos" },
  { label: "Sobre Nós", href: "/quem-somos", page: "/quem-somos" },
  { label: "Onde Estamos", href: "/onde-estamos", page: "/onde-estamos" },
  { label: "Contato", href: "/contato", page: "/contato" },
  { label: "Aplicativo", href: "#app" },
];

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [location, navigate] = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleNav = (link: NavLink) => {
    setIsOpen(false);
    if (link.page) {
      navigate(link.page);
      window.scrollTo({ top: 0 });
      return;
    }
    if (link.href.startsWith("#")) {
      if (location !== "/") {
        navigate("/");
        setTimeout(() => {
          const el = document.querySelector(link.href);
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }, 150);
      } else {
        const el = document.querySelector(link.href);
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  const isActive = (link: NavLink) => (link.page ? location === link.page : false);

  return (
    <header
      ref={menuRef}
      data-testid="header"
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? "rgba(0, 26, 110, 0.97)" : "#001A6E",
        boxShadow: scrolled ? "0 2px 20px rgba(0,0,0,0.30)" : "none",
        backdropFilter: scrolled ? "blur(8px)" : "none",
      }}
    >
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-12 flex items-center justify-between h-16">
        <button
          onClick={() => { navigate("/"); window.scrollTo({ top: 0 }); }}
          className="flex-shrink-0 focus:outline-none"
        >
          <img src={logoWhite} alt="Provider Mais Fibra" className="h-9 w-auto" />
        </button>

        <nav className="hidden lg:flex items-center gap-7">
          {navLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => handleNav(link)}
              data-testid={`nav-link-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
              className="text-sm font-semibold transition-colors duration-200 focus:outline-none hover:text-[#00D94A]"
              style={{ color: isActive(link) ? "#00C040" : "rgba(255,255,255,0.92)" }}
            >
              {link.label}
            </button>
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
          <button
            onClick={() => handleNav({ label: "Planos", href: "#planos" })}
            data-testid="header-cta"
            className="ml-2 px-6 py-2.5 rounded-full text-sm font-bold text-white transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none"
            style={{ background: "#00C040", boxShadow: "0 6px 16px rgba(0,192,64,0.35)" }}
          >
            Assine Já
          </button>
        </div>

        <button
          id="mobile-menu-trigger"
          className="lg:hidden text-white p-2 rounded-lg transition-colors hover:bg-white/10 active:bg-white/20"
          onClick={() => setIsOpen(!isOpen)}
          data-testid="header-mobile-menu"
          aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={isOpen}
          aria-controls="mobile-menu"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <div
        id="mobile-menu"
        role="region"
        aria-labelledby="mobile-menu-trigger"
        className="lg:hidden overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isOpen ? "560px" : "0px",
          opacity: isOpen ? 1 : 0,
          background: "rgba(0, 16, 80, 0.98)",
        }}
      >
        <div className="px-4 pb-5 pt-2">
          {navLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => handleNav(link)}
              className="w-full text-left py-3.5 text-sm font-semibold border-b border-white/10 transition-colors last:border-b-0 focus:outline-none"
              style={{ color: isActive(link) ? "#00C040" : "rgba(255,255,255,0.92)" }}
            >
              {link.label}
            </button>
          ))}
          <div className="flex items-center gap-4 pt-4 mt-1">
            <a href="https://wa.me/5577998444757" target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white transition-colors" aria-label="WhatsApp">
              <WhatsAppIcon size={20} />
            </a>
            <a href="https://instagram.com/provider.fibra" target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white transition-colors" aria-label="Instagram">
              <Instagram size={20} />
            </a>
            <button
              onClick={() => { setIsOpen(false); handleNav({ label: "Planos", href: "#planos" }); }}
              className="ml-auto px-5 py-2.5 rounded-full text-sm font-bold text-white transition-all duration-200 active:scale-95 focus:outline-none"
              style={{ background: "#00C040", boxShadow: "0 4px 12px rgba(0,192,64,0.30)" }}
            >
              Assine Já
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
