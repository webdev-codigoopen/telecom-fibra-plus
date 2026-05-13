import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAppSettings } from "@/hooks/useAppSettings";

type Review = {
  id: number;
  source: "manual" | "google" | string;
  authorName: string;
  authorAvatarUrl: string | null;
  rating: number;
  text: string;
  city: string | null;
  postedAt: string | null;
};

// Static fallback used when the API hasn't been hit yet or no reviews exist.
const FALLBACK: Review[] = [
  {
    id: -1,
    source: "manual",
    authorName: "Ana Lima",
    authorAvatarUrl: null,
    rating: 5,
    text: "Excelente atendimento e internet muito rápida! Assino há 1 ano e nunca tive problemas. Recomendo para toda minha família.",
    city: "Barreiras",
    postedAt: null,
  },
  {
    id: -2,
    source: "manual",
    authorName: "Carlos Souza",
    authorAvatarUrl: null,
    rating: 5,
    text: "Velocidade incrível, principalmente para home office. A conexão é estável e o suporte responde muito rápido no WhatsApp.",
    city: "Luís Eduardo Magalhães",
    postedAt: null,
  },
  {
    id: -3,
    source: "manual",
    authorName: "Patrícia Mendes",
    authorAvatarUrl: null,
    rating: 5,
    text: "Instalação rápida e equipe muito atenciosa. Estou muito satisfeita com o serviço, o Wi-Fi 6 faz toda a diferença!",
    city: "São Desidério",
    postedAt: null,
  },
  {
    id: -4,
    source: "manual",
    authorName: "Rafael Oliveira",
    authorAvatarUrl: null,
    rating: 5,
    text: "Internet estável, sem quedas. O suporte via WhatsApp é muito ágil e resolvem tudo de forma bem rápida.",
    city: "Angical",
    postedAt: null,
  },
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function StarIcon({ size = 14, filled = true }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "#FFC107" : "#E0E0E0"} aria-hidden="true">
      <path d="M12 2l2.95 6.99L22 10l-5.5 4.78L18.18 22 12 18.27 5.82 22 7.5 14.78 2 10l7.05-1.01L12 2z" />
    </svg>
  );
}

function GoogleBadge() {
  return (
    <span
      title="Avaliação importada do Google"
      className="inline-flex items-center justify-center w-5 h-5 rounded-full"
      style={{ background: "#fff", border: "1px solid #E0E3EB" }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    </span>
  );
}

export default function Testimonials() {
  const settings = useAppSettings();
  const [reviews, setReviews] = useState<Review[]>(FALLBACK);
  const baseUrl = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  // Reload on every mount so navigation back to home re-randomizes the list.
  useEffect(() => {
    let active = true;
    fetch(`${baseUrl}/api/reviews`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Review[] | null) => {
        if (active && Array.isArray(data) && data.length > 0) setReviews(data);
      })
      .catch(() => {
        /* keep fallback */
      });
    return () => {
      active = false;
    };
  }, [baseUrl]);

  // Show at most 3 reviews on the home section.
  const visibleReviews = reviews.slice(0, 3);

  const gmbUrl = settings.gmb_profile_url.trim();

  return (
    <section
      id="depoimentos"
      data-testid="testimonials-section"
      className="w-full"
      style={{ backgroundColor: "#FBFBFB", paddingTop: 80, paddingBottom: 80 }}
    >
      <div
        className="mx-auto px-4"
        style={{ maxWidth: 1200, display: "flex", flexDirection: "column", gap: 40 }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}
        >
          <h2
            className="text-center"
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 700,
              fontSize: 32,
              lineHeight: "40px",
              color: "#003F99",
              margin: 0,
            }}
          >
            O que nossos clientes dizem
          </h2>
          <p
            className="text-center"
            style={{
              fontSize: 15,
              color: "#4A4F61",
              maxWidth: 540,
              margin: 0,
              lineHeight: 1.55,
            }}
          >
            Avaliações reais de quem já está conectado com a Provider Mais Fibra.
          </p>
        </motion.div>

        <div
          className="grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
          }}
        >
          {visibleReviews.map((r, i) => (
            <motion.article
              key={`${r.id}-${i}`}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.3) }}
              className="rounded-2xl bg-white p-5 flex flex-col gap-3"
              style={{ border: "1px solid #E8EAEF" }}
            >
              <header className="flex items-center gap-3">
                {r.authorAvatarUrl ? (
                  <img
                    src={r.authorAvatarUrl}
                    alt=""
                    width={40}
                    height={40}
                    className="rounded-full object-cover flex-shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div
                    aria-hidden
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-[13px] text-white flex-shrink-0"
                    style={{ background: "#122AD5" }}
                  >
                    {initialsOf(r.authorName)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-[#0D0D0D] truncate">
                    {r.authorName}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <div className="flex gap-0.5" aria-label={`${r.rating} de 5 estrelas`}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <StarIcon key={s} size={12} filled={s <= r.rating} />
                      ))}
                    </div>
                    {r.source === "google" && <GoogleBadge />}
                  </div>
                </div>
              </header>
              <p className="text-[14px] text-[#4A4F61] leading-relaxed line-clamp-5">
                {r.text}
              </p>
              {r.city && (
                <span className="text-[12px] text-[#7A7F8C] mt-auto">{r.city}</span>
              )}
            </motion.article>
          ))}
        </div>

        {gmbUrl && (
          <div className="text-center">
            <a
              href={gmbUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-[14px] font-semibold text-[#122AD5] bg-white border border-[#122AD5]/20 hover:bg-[#122AD5]/5 transition-colors"
            >
              <GoogleBadge />
              Avalie a gente no Google
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
