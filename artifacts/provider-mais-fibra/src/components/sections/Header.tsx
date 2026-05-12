import { useState, useEffect, useRef } from "react";
import { Menu, X } from "lucide-react";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL;
const logoUrl = `${BASE}images/logos/logo-header-264x47.svg`;
const iconWhatsApp = `${BASE}images/icons/whatsapp-header-18.svg`;
const iconInstagram = `${BASE}images/icons/instagram-header-18.svg`;
const iconGooglePlay = `${BASE}images/icons/google-play-header-16x18.svg`;
const iconApple = `${BASE}images/icons/apple-header-18.svg`;

type NavLink = {
  label: string;
  href: string;
  page?: string;
};

const navLinks: NavLink[] = [
  { label: "Home", href: "/", page: "/" },
  { label: "Planos", href: "#planos" },
  { label: "IPTV", href: "#combo" },
  { label: "Sobre Nós", href: "/quem-somos", page: "/quem-somos" },
  { label: "Onde Estamos", href: "/onde-estamos", page: "/onde-estamos" },
  { label: "Contato", href: "/contato", page: "/contato" },
];

const COLORS = {
  active: "#95EB1D",
  inactive: "rgba(255,255,255,0.9)",
  ctaBg: "#95EB1D",
  ctaText: "#2A40DA",
  divider: "rgba(255,255,255,0.6)",
};

const HEADER_BG =
  "linear-gradient(19.475deg, rgb(18, 42, 213) 29.23%, rgb(33, 56, 205) 56.94%, rgb(42, 65, 219) 86.07%)";

const FONT_NUNITO = "'Nunito', 'Montserrat', system-ui, sans-serif";

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [location, navigate] = useLocation();
  const menuRef = useRef<HTMLElement>(null);

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
      const scrollToAnchor = () => {
        const el = document.querySelector(link.href);
        if (el) el.scrollIntoView({ behavior: "smooth" });
      };
      if (location !== "/") {
        navigate("/");
        setTimeout(scrollToAnchor, 150);
      } else {
        scrollToAnchor();
      }
    }
  };

  const isActive = (link: NavLink) =>
    link.label === "Home" ? location === "/" : link.page ? location === link.page : false;

  return (
    <header
      ref={menuRef}
      data-testid="header"
      className="header-section fixed top-0 left-0 right-0 z-50 transition-all duration-300 text-[#ffffff] border-t-[#0d0d0d00] border-r-[#0d0d0d00] border-b-[#0d0d0d00] border-l-[#0d0d0d00] bg-[#072BDE]"
      style={{
        background: HEADER_BG,
        boxShadow: scrolled ? "0 2px 20px rgba(0,0,0,0.30)" : "0 2px 10px rgba(0,0,0,0.25)",
        fontFamily: FONT_NUNITO,
      }}
    >
      <div className="header-section__container mx-auto flex items-center justify-between h-16 md:h-[88px] max-w-[1240px] px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <button
          onClick={() => {
            navigate("/");
            window.scrollTo({ top: 0 });
          }}
          className="header-section__logo flex-shrink-0 rounded outline-none focus-visible:ring-2 focus-visible:ring-[#95EB1D] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1F35C9]"
          aria-label="Provider + FIBRA — Início"
        >
          <img
            src={logoUrl}
            alt="Provider + FIBRA"
            className="h-8 md:h-[47px] w-auto"
            width={264}
            height={47}
          />
        </button>

        {/* Desktop nav */}
        <nav className="header-section__nav hidden lg:flex items-center gap-3">
          {navLinks.map((link) => {
            const active = isActive(link);
            return (
              <button
                key={link.label}
                onClick={() => handleNav(link)}
                data-testid={`nav-link-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                className="header-section__nav-link text-[16px] leading-[20px] transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#95EB1D] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1F35C9] rounded whitespace-nowrap px-2 hover:text-[#95EB1D] text-[#ffffffe6] font-normal"
                style={{
                  color: active ? COLORS.active : COLORS.inactive,
                  fontFamily: FONT_NUNITO,
                  fontWeight: active ? 700 : 600,
                }}
              >
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* Right cluster (desktop) */}
        <div className="header-section__right hidden lg:flex items-center gap-4">
          {/* App stores group */}
          <div
            className="header-section__app flex items-center gap-[7px] pr-5 border-r"
            style={{ borderColor: COLORS.divider }}
          >
            <a
              href="#app"
              onClick={(e) => {
                e.preventDefault();
                handleNav({ label: "Aplicativo", href: "#app" });
              }}
              data-testid="header-app-link"
              className="text-[16px] leading-[20px] transition-colors hover:text-[#95EB1D] font-normal text-[#ffffffe6] mr-[8px]"
              style={{ color: COLORS.inactive, fontFamily: FONT_NUNITO, fontWeight: 600 }}
            >
              Aplicativo
            </a>
            <a
              href="https://play.google.com/store"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="header-google-play"
              className="flex items-center justify-center transition-opacity hover:opacity-100 opacity-90"
              aria-label="Baixar na Google Play"
            >
              <img src={iconGooglePlay} alt="" className="w-4 h-[18px]" width={16} height={18} />
            </a>
            <a
              href="https://www.apple.com/app-store/"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="header-app-store"
              className="flex items-center justify-center transition-opacity hover:opacity-100 opacity-90"
              aria-label="Baixar na App Store"
            >
              <img src={iconApple} alt="" className="w-[18px] h-[18px]" width={18} height={18} />
            </a>
          </div>

          {/* Social */}
          <a
            href="https://wa.me/5577998444757"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="header-whatsapp"
            className="flex items-center justify-center transition-opacity opacity-90 hover:opacity-100"
            aria-label="Fale no WhatsApp"
          >
            <img src={iconWhatsApp} alt="" className="w-[18px] h-[18px]" width={18} height={18} />
          </a>
          <a
            href="https://instagram.com/provider.fibra"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="header-instagram"
            className="flex items-center justify-center transition-opacity opacity-90 hover:opacity-100"
            aria-label="Siga no Instagram"
          >
            <img src={iconInstagram} alt="" className="w-[18px] h-[18px]" width={18} height={18} />
          </a>

          {/* CTA */}
          <button
            onClick={() => handleNav({ label: "Planos", href: "#planos" })}
            data-testid="header-cta"
            className="header-section__cta ml-2 h-10 px-5 rounded-lg text-[14px] leading-[20px] transition-all duration-200 hover:scale-[1.03] active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1F35C9] whitespace-nowrap"
            style={{ background: COLORS.ctaBg, color: COLORS.ctaText, fontFamily: FONT_NUNITO, fontWeight: 700 }}
          >
            Assine Já
          </button>
        </div>

        {/* Mobile / tablet hamburger */}
        <button
          id="mobile-menu-trigger"
          className="lg:hidden text-white p-2 rounded-lg transition-colors hover:bg-white/10 active:bg-white/20 outline-none focus-visible:ring-2 focus-visible:ring-[#95EB1D]"
          onClick={() => setIsOpen(!isOpen)}
          data-testid="header-mobile-menu"
          aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={isOpen}
          aria-controls="mobile-menu"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      {/* Mobile menu */}
      <div
        id="mobile-menu"
        role="region"
        aria-labelledby="mobile-menu-trigger"
        className="header-section__mobile lg:hidden overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isOpen ? "640px" : "0px",
          opacity: isOpen ? 1 : 0,
          background: "rgba(0, 16, 80, 0.98)",
        }}
      >
        <div className="px-4 pb-5 pt-2">
          {navLinks.map((link) => {
            const active = isActive(link);
            return (
              <button
                key={link.label}
                onClick={() => handleNav(link)}
                className="w-full text-left py-3.5 px-1 text-[16px] leading-[20px] border-b border-white/10 transition-colors last:border-b-0 outline-none focus-visible:ring-2 focus-visible:ring-[#95EB1D] rounded"
                style={{
                  color: active ? COLORS.active : COLORS.inactive,
                  fontFamily: FONT_NUNITO,
                  fontWeight: active ? 700 : 600,
                }}
              >
                {link.label}
              </button>
            );
          })}

          {/* Aplicativo row */}
          <button
            onClick={() => handleNav({ label: "Aplicativo", href: "#app" })}
            className="w-full text-left py-3.5 px-1 text-[16px] leading-[20px] border-b border-white/10 flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-[#95EB1D] rounded"
            style={{ color: COLORS.inactive, fontFamily: FONT_NUNITO, fontWeight: 600 }}
          >
            <span>Aplicativo</span>
            <img src={iconGooglePlay} alt="" className="w-4 h-[18px]" />
            <img src={iconApple} alt="" className="w-[18px] h-[18px]" />
          </button>

          <div className="flex items-center gap-4 pt-4 mt-1">
            <a
              href="https://wa.me/5577998444757"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className="opacity-90 hover:opacity-100"
            >
              <img src={iconWhatsApp} alt="" className="w-5 h-5" />
            </a>
            <a
              href="https://instagram.com/provider.fibra"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="opacity-90 hover:opacity-100"
            >
              <img src={iconInstagram} alt="" className="w-5 h-5" />
            </a>
            <button
              onClick={() => {
                setIsOpen(false);
                handleNav({ label: "Planos", href: "#planos" });
              }}
              className="ml-auto h-10 px-5 rounded-lg text-[14px] leading-[20px] transition-all duration-200 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1F35C9]"
              style={{ background: COLORS.ctaBg, color: COLORS.ctaText, fontFamily: FONT_NUNITO, fontWeight: 700 }}
            >
              Assine Já
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
