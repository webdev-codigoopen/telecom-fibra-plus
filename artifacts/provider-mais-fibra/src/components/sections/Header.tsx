import { useState, useEffect, useRef } from "react";
import { Menu, X, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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

const HEADER_BG = "#1A38D5";

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
      className="header-section fixed top-0 left-0 right-0 z-50 transition-all duration-300 text-[#ffffff] border-t-[#0d0d0d00] border-r-[#0d0d0d00] border-b-[#0d0d0d00] border-l-[#0d0d0d00] bg-[#000000]"
      style={{
        background: scrolled || location !== "/" ? HEADER_BG : "transparent",
        boxShadow: scrolled ? "0 2px 20px rgba(0,0,0,0.30)" : "none",
        fontFamily: FONT_NUNITO,
      }}
    >
      <div className="header-section__container mx-auto flex items-center justify-between min-h-16 py-3 md:py-0 md:h-[88px] max-w-[1240px] px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <button
          onClick={() => {
            navigate("/");
            window.scrollTo({ top: 0 });
          }}
          className="header-section__logo cursor-pointer flex-shrink-0 rounded outline-none focus-visible:ring-2 focus-visible:ring-[#95EB1D] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1F35C9]"
          aria-label="Provider + FIBRA — Início"
        >
          <img
            src={logoUrl}
            alt="Provider + FIBRA"
            className="h-8 md:h-[47px] w-auto mt-[-10px]"
            width={264}
            height={47}
            style={{ transform: "translateY(4px)" }}
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
                className="header-section__nav-link cursor-pointer text-[16px] leading-[20px] transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#95EB1D] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1F35C9] rounded whitespace-nowrap px-2 hover:text-[#95EB1D] text-[#ffffffe6] font-normal"
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
              className="text-[16px] leading-[20px] transition-colors hover:text-[#95EB1D] text-[#ffffffe6] mr-[8px] font-normal"
              style={{ color: COLORS.inactive, fontFamily: FONT_NUNITO, fontWeight: 600 }}
            >
              Aplicativo
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=br.com.telecomprovider.ixc&pli=1"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="header-google-play"
              className="flex items-center justify-center cursor-pointer transition-opacity hover:opacity-100 opacity-90"
              aria-label="Baixar na Google Play"
            >
              <img src={iconGooglePlay} alt="" className="w-4 h-[18px]" width={16} height={18} />
            </a>
            <a
              href="https://apps.apple.com/br/app/provider-mais-fibra/id6762133657"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="header-app-store"
              className="flex items-center justify-center cursor-pointer transition-opacity hover:opacity-100 opacity-90"
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
            className="flex items-center justify-center cursor-pointer transition-opacity opacity-90 hover:opacity-100"
            aria-label="Fale no WhatsApp"
          >
            <img src={iconWhatsApp} alt="" className="w-[18px] h-[18px]" width={18} height={18} />
          </a>
          <a
            href="https://instagram.com/provider.fibra"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="header-instagram"
            className="flex items-center justify-center cursor-pointer transition-opacity opacity-90 hover:opacity-100"
            aria-label="Siga no Instagram"
          >
            <img src={iconInstagram} alt="" className="w-[18px] h-[18px]" width={18} height={18} />
          </a>

          {/* CTA */}
          <button
            onClick={() => handleNav({ label: "Planos", href: "#planos" })}
            data-testid="header-cta"
            className="header-section__cta cursor-pointer ml-2 h-10 px-5 rounded-lg text-[14px] leading-[20px] transition-colors duration-200 hover:brightness-110 active:brightness-95 outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1F35C9] whitespace-nowrap"
            style={{ background: COLORS.ctaBg, color: COLORS.ctaText, fontFamily: FONT_NUNITO, fontWeight: 700 }}
          >
            Assine Já
          </button>
        </div>

        {/* Mobile / tablet hamburger */}
        <button
          id="mobile-menu-trigger"
          className="lg:hidden cursor-pointer text-white p-2 rounded-lg transition-colors hover:bg-white/10 active:bg-white/20 outline-none focus-visible:ring-2 focus-visible:ring-[#95EB1D]"
          onClick={() => setIsOpen(!isOpen)}
          data-testid="header-mobile-menu"
          aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={isOpen}
          aria-controls="mobile-menu"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      {/* Mobile menu — backdrop + drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              key="backdrop"
              className="lg:hidden fixed inset-0"
              style={{
                background: "rgba(5,8,30,0.55)",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                zIndex: 40,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />

            <motion.div
              key="drawer"
              id="mobile-menu"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-menu-trigger"
              className="header-section__mobile lg:hidden fixed top-0 right-0 flex flex-col overflow-hidden"
              style={{
                width: "min(88vw, 380px)",
                height: "100vh",
                background:
                  "linear-gradient(160deg, #1A38D5 0%, #122AD5 45%, #0A1A8C 100%)",
                boxShadow: "-12px 0 40px rgba(0,0,0,0.45)",
                zIndex: 60,
                paddingTop: "env(safe-area-inset-top, 0px)",
                paddingBottom: "env(safe-area-inset-bottom, 0px)",
              }}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", ease: [0.32, 0.72, 0, 1], duration: 0.4 }}
            >
              {/* Decorative accent orb */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  top: -120,
                  right: -120,
                  width: 320,
                  height: 320,
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle, rgba(149,235,29,0.22) 0%, rgba(149,235,29,0) 70%)",
                  pointerEvents: "none",
                }}
              />

              {/* Drawer header: logo + close */}
              <div className="relative flex items-center justify-between px-6 pt-6 pb-5 flex-shrink-0">
                <img
                  src={logoUrl}
                  alt="Provider + FIBRA"
                  className="h-7 w-auto"
                  width={264}
                  height={47}
                />
                <button
                  onClick={() => setIsOpen(false)}
                  className="cursor-pointer text-white w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200 hover:bg-white/15 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-[#95EB1D]"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                  aria-label="Fechar menu"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Nav links — scrollable */}
              <nav className="relative flex-1 overflow-y-auto px-4 pt-2 pb-4">
                {navLinks.map((link, i) => {
                  const active = isActive(link);
                  return (
                    <motion.button
                      key={link.label}
                      onClick={() => handleNav(link)}
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 + i * 0.05, duration: 0.3, ease: "easeOut" }}
                      className="w-full text-left flex items-center justify-between py-4 px-4 my-1 rounded-xl transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#95EB1D] active:scale-[0.98]"
                      style={{
                        background: active ? "rgba(149,235,29,0.12)" : "transparent",
                        color: active ? COLORS.active : COLORS.inactive,
                        fontFamily: FONT_NUNITO,
                        fontWeight: active ? 700 : 600,
                        fontSize: 17,
                        lineHeight: "22px",
                      }}
                    >
                      <span className="flex items-center gap-3">
                        {active && (
                          <span
                            aria-hidden
                            style={{
                              width: 4,
                              height: 20,
                              borderRadius: 2,
                              background: COLORS.active,
                              boxShadow: "0 0 12px rgba(149,235,29,0.6)",
                            }}
                          />
                        )}
                        {link.label}
                      </span>
                      <ChevronRight size={18} className="opacity-50" />
                    </motion.button>
                  );
                })}

                {/* Divider label */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.05 + navLinks.length * 0.05, duration: 0.3 }}
                  className="px-4 pt-6 pb-2 text-[11px] uppercase tracking-[0.12em] text-white/40 font-bold"
                  style={{ fontFamily: FONT_NUNITO }}
                >
                  Baixe o app
                </motion.div>

                {/* App stores row */}
                <motion.div
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + navLinks.length * 0.05, duration: 0.3 }}
                  className="flex gap-2 px-2"
                >
                  <a
                    href="https://play.google.com/store/apps/details?id=br.com.telecomprovider.ixc&pli=1"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsOpen(false)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-200 hover:bg-white/15 active:scale-[0.98]"
                    style={{ background: "rgba(255,255,255,0.08)", color: "#fff", fontFamily: FONT_NUNITO, fontWeight: 600, fontSize: 13 }}
                  >
                    <img src={iconGooglePlay} alt="" className="w-4 h-[18px]" />
                    Play
                  </a>
                  <a
                    href="https://apps.apple.com/br/app/provider-mais-fibra/id6762133657"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsOpen(false)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-200 hover:bg-white/15 active:scale-[0.98]"
                    style={{ background: "rgba(255,255,255,0.08)", color: "#fff", fontFamily: FONT_NUNITO, fontWeight: 600, fontSize: 13 }}
                  >
                    <img src={iconApple} alt="" className="w-[18px] h-[18px]" />
                    App Store
                  </a>
                </motion.div>
              </nav>

              {/* Footer: CTA + social — pinned to bottom */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.35 }}
                className="relative flex-shrink-0 px-6 pt-5 pb-6"
                style={{
                  background:
                    "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.15) 100%)",
                }}
              >
                <button
                  onClick={() => {
                    setIsOpen(false);
                    handleNav({ label: "Planos", href: "#planos" });
                  }}
                  className="w-full h-12 rounded-full text-[15px] leading-[20px] transition-all duration-200 hover:brightness-110 active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#122AD5] mb-4"
                  style={{
                    background: COLORS.ctaBg,
                    color: COLORS.ctaText,
                    fontFamily: FONT_NUNITO,
                    fontWeight: 800,
                    boxShadow: "0 8px 24px rgba(149,235,29,0.35)",
                  }}
                >
                  Assine Já
                </button>
                <div className="flex items-center justify-center gap-3">
                  <a
                    href="https://wa.me/5577998444757"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="WhatsApp"
                    className="w-11 h-11 flex items-center justify-center rounded-full transition-all duration-200 hover:bg-white/15 active:scale-95"
                    style={{ background: "rgba(255,255,255,0.08)" }}
                  >
                    <img src={iconWhatsApp} alt="" className="w-5 h-5" />
                  </a>
                  <a
                    href="https://instagram.com/provider.fibra"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Instagram"
                    className="w-11 h-11 flex items-center justify-center rounded-full transition-all duration-200 hover:bg-white/15 active:scale-95"
                    style={{ background: "rgba(255,255,255,0.08)" }}
                  >
                    <img src={iconInstagram} alt="" className="w-5 h-5" />
                  </a>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
