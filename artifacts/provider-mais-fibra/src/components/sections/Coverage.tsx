import { motion } from "framer-motion";
import { MapPin } from "lucide-react";

const cities = [
  "Barreiras",
  "Luís Eduardo Magalhães",
  "Angical",
  "Baianópolis",
  "Cristópolis",
  "São Desidério",
  "Jaborandi",
  "Cotegipe",
  "Wanderley",
  "Bom Jesus da Lapa",
  "Santa Maria da Vitória",
  "Correntina",
];

export default function Coverage() {
  return (
    <section
      id="cobertura"
      data-testid="coverage-section"
      className="py-20"
      style={{ background: "#F5F6FA" }}
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold mb-4"
            style={{ background: "#E8F0FF", color: "#003F99", border: "1px solid #C5D8FF" }}
          >
            <MapPin size={14} />
            Cobertura
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#003F99] mb-3">
            Presentes em Todo o Oeste da Bahia
          </h2>
          <p className="text-[#4A4F61]">
            Atendemos 12 cidades com fibra óptica de alta velocidade
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {cities.map((city, i) => (
            <motion.div
              key={city}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
              className="flex items-center gap-3 p-4 rounded-xl transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
              style={{
                background: "white",
                border: "1px solid #E8EAEF",
                borderLeft: "4px solid #003F99",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}
            >
              <MapPin size={16} style={{ color: "#003F99", flexShrink: 0 }} />
              <span className="text-sm font-semibold text-[#4A4F61]">{city}</span>
            </motion.div>
          ))}
        </div>

        <div className="text-center">
          <a
            href="#contato"
            onClick={(e) => {
              e.preventDefault();
              const el = document.getElementById("contato");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
            data-testid="coverage-cta"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-lg font-bold text-base text-[#003F99] transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: "white",
              border: "2px solid #003F99",
              boxShadow: "0 4px 12px rgba(0,63,153,0.15)",
            }}
          >
            <MapPin size={18} />
            Ver Unidade na Minha Cidade
          </a>
        </div>
      </div>
    </section>
  );
}
