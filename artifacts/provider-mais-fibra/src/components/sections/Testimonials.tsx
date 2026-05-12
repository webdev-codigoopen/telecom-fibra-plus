import { motion } from "framer-motion";

const testimonials = [
  {
    name: "Ana Lima",
    city: "Barreiras",
    text: "\u201CExcelente atendimento e internet muito r\u00E1pida! Assino h\u00E1 1 ano e nunca tive problemas. Recomendo para toda minha fam\u00EDlia.\u201D",
    initials: "AL",
  },
  {
    name: "Carlos Souza",
    city: "Lu\u00EDs Eduardo Magalh\u00E3es",
    text: "\u201CVelocidade incr\u00EDvel, principalmente para home office. A conex\u00E3o \u00E9 est\u00E1vel e o suporte responde muito r\u00E1pido no WhatsApp.\u201D",
    initials: "CS",
  },
  {
    name: "Patr\u00EDcia Mendes",
    city: "S\u00E3o Desid\u00E9rio",
    text: "\u201CInstala\u00E7\u00E3o r\u00E1pida e equipe muito atenciosa. Estou muito satisfeita com o servi\u00E7o, o Wi-Fi 6 faz toda a diferen\u00E7a!\u201D",
    initials: "PM",
  },
  {
    name: "Rafael Oliveira",
    city: "Angical",
    text: "\u201CInternet est\u00E1vel, sem quedas. O suporte via WhatsApp \u00E9 muito \u00E1gil e resolvem tudo de forma bem r\u00E1pida.\u201D",
    initials: "RO",
  },
];

function StarIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#FFC107" aria-hidden="true">
      <path d="M12 2l2.95 6.99L22 10l-5.5 4.78L18.18 22 12 18.27 5.82 22 7.5 14.78 2 10l7.05-1.01L12 2z" />
    </svg>
  );
}

function GoogleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#FFFFFF" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#FFFFFF" opacity=".85" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FFFFFF" opacity=".7" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#FFFFFF" opacity=".55" />
    </svg>
  );
}

export default function Testimonials() {
  return (
    <section
      id="depoimentos"
      data-testid="testimonials-section"
      className="w-full"
      style={{ backgroundColor: "#FBFBFB", paddingTop: 80, paddingBottom: 40 }}
    >
      <div
        className="mx-auto px-4"
        style={{ maxWidth: 1200, display: "flex", flexDirection: "column", gap: 48 }}
      >
        {/* Heading group */}
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
              fontWeight: 400,
              fontSize: 32,
              lineHeight: "40px",
              color: "#003F99",
              margin: 0,
            }}
          >
            O que nossos{" "}
            <span style={{ fontWeight: 800 }}>Clientes</span> dizem
          </h2>

          {/* Avaliações Google badge row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 9999,
                backgroundColor: "#4285F4",
              }}
            >
              <GoogleIcon size={16} />
              <span
                style={{
                  fontFamily: "Nunito, sans-serif",
                  fontWeight: 700,
                  fontSize: 12,
                  lineHeight: "16px",
                  color: "#FFFFFF",
                  whiteSpace: "nowrap",
                }}
              >
                Avalia&ccedil;&otilde;es Google
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <StarIcon key={i} size={14} />
              ))}
            </div>

            <span
              style={{
                fontFamily: "Nunito, sans-serif",
                fontWeight: 700,
                fontSize: 14,
                lineHeight: "20px",
                color: "#4A4F61",
              }}
            >
              5.0
            </span>
          </div>
        </motion.div>

        {/* Cards row */}
        <div
          className="testimonials-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 285px)",
            gap: 20,
            justifyContent: "center",
          }}
        >
            {testimonials.map((t, i) => (
              <motion.article
                key={t.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.45 }}
                data-testid={`testimonial-card-${i}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: 24,
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E8EAEF",
                  borderRadius: 12,
                }}
              >
                {/* Stars row */}
                <div style={{ display: "flex", alignItems: "center", gap: 4, height: 30 }}>
                  {[0, 1, 2, 3, 4].map((s) => (
                    <StarIcon key={s} size={14} />
                  ))}
                </div>

                {/* Quote */}
                <p
                  style={{
                    fontFamily: "Nunito, sans-serif",
                    fontWeight: 400,
                    fontSize: 14,
                    lineHeight: "22.75px",
                    color: "#4A4F61",
                    margin: 0,
                    flex: 1,
                    paddingTop: 0,
                    paddingBottom: 0,
                  }}
                >
                  {t.text}
                </p>

                {/* Avatar + name/city */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginTop: "auto",
                    paddingTop: 16,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 9999,
                      backgroundColor: "#003F99",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      fontFamily: "Nunito, sans-serif",
                      fontWeight: 900,
                      fontSize: 12,
                      lineHeight: "16px",
                      color: "#FFFFFF",
                    }}
                  >
                    {t.initials}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span
                      style={{
                        fontFamily: "Nunito, sans-serif",
                        fontWeight: 700,
                        fontSize: 14,
                        lineHeight: "20px",
                        color: "#0D0E14",
                      }}
                    >
                      {t.name}
                    </span>
                    <span
                      style={{
                        fontFamily: "Nunito, sans-serif",
                        fontWeight: 400,
                        fontSize: 12,
                        lineHeight: "16px",
                        color: "#B0B5C3",
                      }}
                    >
                      {t.city}
                    </span>
                  </div>
                </div>
              </motion.article>
            ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 1023px) {
          .testimonials-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 599px) {
          .testimonials-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
