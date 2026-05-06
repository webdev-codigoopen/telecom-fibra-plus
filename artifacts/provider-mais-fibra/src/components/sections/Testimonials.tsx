import { motion } from "framer-motion";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Ana Lima",
    city: "Barreiras",
    text: "Excelente atendimento e internet muito rápida! Assino há 1 ano e nunca tive problemas. Recomendo para toda minha família.",
    initials: "AL",
    color: "#0040FF",
  },
  {
    name: "Carlos Souza",
    city: "Luís Eduardo Magalhães",
    text: "Velocidade incrível, principalmente para home office. A conexão é estável e o suporte responde muito rápido no WhatsApp.",
    initials: "CS",
    color: "#00C040",
  },
  {
    name: "Patrícia Mendes",
    city: "São Desidério",
    text: "Instalação rápida e equipe muito atenciosa. Estou muito satisfeita com o serviço, o Wi-Fi 6 faz toda a diferença!",
    initials: "PM",
    color: "#001A6E",
  },
  {
    name: "Rafael Oliveira",
    city: "Angical",
    text: "Internet estável, sem quedas. O suporte via WhatsApp é muito ágil e resolvem tudo de forma bem rápida.",
    initials: "RO",
    color: "#1A5FFF",
  },
];

export default function Testimonials() {
  return (
    <section
      id="depoimentos"
      data-testid="testimonials-section"
      className="py-20 sm:py-24 bg-white"
    >
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0D0D0D] mb-4" style={{ letterSpacing: "-0.025em" }}>
            O que nossos <span className="text-[#0040FF] font-black">Clientes</span> dizem
          </h2>

          <div
            className="inline-flex items-center gap-3 px-4 py-2 rounded-full"
            style={{ border: "1px solid #00C040", background: "rgba(0,192,64,0.08)" }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span className="text-xs font-bold text-[#0D0D0D]">Avaliações Google</span>
            <div className="flex items-center gap-0.5">
              {[1,2,3,4,5].map(s => (
                <Star key={s} size={13} fill="#FFD700" color="#FFD700" />
              ))}
            </div>
            <span className="text-sm font-black text-[#00C040]">5.0</span>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.45 }}
              data-testid={`testimonial-card-${i}`}
              className="flex flex-col p-6 rounded-2xl bg-white transition-all duration-300 hover:-translate-y-1"
              style={{ border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}
            >
              <div className="flex items-center gap-1 mb-3">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} size={13} fill="#FFD700" color="#FFD700" />
                ))}
              </div>
              <p className="text-sm text-[#333333] leading-relaxed mb-5 flex-1">
                "{t.text}"
              </p>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                  style={{ background: t.color }}
                >
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#0D0D0D]">{t.name}</p>
                  <p className="text-xs text-[#666666]">{t.city}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
