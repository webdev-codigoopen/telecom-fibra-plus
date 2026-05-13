import { motion } from "framer-motion";
import watchBanner from "@assets/0760c732-b1ad-4f5d-bc5b-166ae46bc43f_1778705450941.png";
import posterGuerraCivil from "@assets/Guerra-Civil_1778705492539.webp";
import posterApenasUmShow from "@assets/Apenas-Um-Show-As-Fitas-Perdidas_1778705492540.webp";
import posterRickAndMorty from "@assets/RICK-AND-MORTY-DDT-S9_KA_4x5_PRE-LAUNCH_BRA-1_1778705492540.webp";
import posterMorroVentos from "@assets/Camada-1_1778705492541.webp";
import posterAquaman from "@assets/U_AQUAMAN-AND-THE-LOST-KINGDOM_BRANDEDMOVIEPORTRAIT2x3-1_1778705492541.webp";
import posterClo from "@assets/U_REINVENTANDO-CLO_BRANDEDSEASONPORTRAIT2x3-1_1778705492541.webp";
import posterCia from "@assets/U_CIA-S1_BRANDEDSEASONPORTRAIT2x3_1778705492542.webp";

type Poster = {
  src: string;
  alt: string;
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  width: number;
  rotate: number;
  delay: number;
  z: number;
};

const POSTERS: Poster[] = [
  { src: posterAquaman,      alt: "Aquaman 2",                  top: "-40px",  left: "-30px",   width: 150, rotate: -14, delay: 0.05, z: 2 },
  { src: posterGuerraCivil,  alt: "Guerra Civil",               top: "60px",   left: "140px",   width: 130, rotate: 8,   delay: 0.12, z: 1 },
  { src: posterApenasUmShow, alt: "Apenas um Show",             bottom: "-50px", left: "60px",  width: 140, rotate: -10, delay: 0.18, z: 2 },
  { src: posterClo,          alt: "Reinventando Clô",           bottom: "30px", left: "230px",  width: 125, rotate: 12,  delay: 0.24, z: 1 },
  { src: posterRickAndMorty, alt: "Rick and Morty",             top: "-30px",  right: "-20px",  width: 150, rotate: 11,  delay: 0.08, z: 2 },
  { src: posterMorroVentos,  alt: "O Morro dos Ventos Uivantes", top: "70px",   right: "150px",  width: 130, rotate: -9,  delay: 0.16, z: 1 },
  { src: posterCia,          alt: "CIA",                        bottom: "-40px", right: "70px", width: 140, rotate: 9,   delay: 0.22, z: 2 },
];

export default function WatchSection() {
  return (
    <section
      id="watch"
      data-testid="watch-section"
      className="watch-section"
      style={{
        position: "relative",
        width: "100%",
        height: 500,
        overflow: "hidden",
        background:
          "radial-gradient(ellipse 60% 70% at 50% 50%, #1A4FE8 0%, #2037CE 45%, #1626A0 100%)",
      }}
    >
      {/* Subtle blue glow behind the banner to blend it with the bg */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 45% 55% at 50% 50%, rgba(20, 65, 220, 0.85) 0%, rgba(32, 55, 206, 0) 70%)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* Scattered posters */}
      {POSTERS.map((p, i) => (
        <motion.img
          key={i}
          src={p.src}
          alt={p.alt}
          loading="lazy"
          decoding="async"
          initial={{ opacity: 0, scale: 0.85, rotate: p.rotate * 0.3 }}
          whileInView={{ opacity: 1, scale: 1, rotate: p.rotate }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55, delay: p.delay, ease: "easeOut" }}
          className="watch-poster"
          style={{
            position: "absolute",
            top: p.top,
            bottom: p.bottom,
            left: p.left,
            right: p.right,
            width: p.width,
            height: "auto",
            borderRadius: 10,
            boxShadow:
              "0 18px 40px rgba(0, 10, 50, 0.55), 0 4px 12px rgba(0, 10, 50, 0.35)",
            zIndex: p.z,
          }}
        />
      ))}

      {/* Central banner */}
      <div
        style={{
          position: "relative",
          zIndex: 5,
          height: "100%",
          maxWidth: 1240,
          margin: "0 auto",
          paddingLeft: 20,
          paddingRight: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
        }}
      >
        <motion.img
          src={watchBanner}
          alt="WATCH — Os melhores jogos de futebol"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="watch-banner"
          style={{
            display: "block",
            width: "100%",
            maxWidth: 880,
            height: "auto",
            borderRadius: 14,
            boxShadow:
              "0 30px 80px rgba(0, 10, 50, 0.55), 0 8px 24px rgba(0, 10, 50, 0.4)",
          }}
        />
      </div>

      <style>{`
        @media (max-width: 1023px) {
          .watch-section {
            height: 420px !important;
          }
          .watch-poster {
            width: 95px !important;
          }
          .watch-banner {
            max-width: 92% !important;
          }
        }
        @media (max-width: 640px) {
          .watch-section {
            height: 360px !important;
          }
          .watch-poster {
            width: 75px !important;
          }
        }
      `}</style>
    </section>
  );
}
