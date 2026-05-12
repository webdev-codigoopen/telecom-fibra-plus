import bgPosters from "@assets/Captura_de_Tela_2025-08-12_às_16_27_37_1_1778611251118.png";

const BG_COLOR = "#061CD4";

export default function ComboPowerTop() {
  return (
    <section
      id="combo"
      data-testid="combo-section"
      className="relative w-full overflow-hidden"
      style={{
        minHeight: 695,
        backgroundColor: BG_COLOR,
      }}
    >
      {/* Layer 1: streaming posters image, blended into bg */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url(${bgPosters})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity: 0.15,
          mixBlendMode: "luminosity",
        }}
      />

      {/* Layer 2: radial vignette pulling the image into bg color */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 70% 90% at 50% 58%, ${BG_COLOR}11 0%, ${BG_COLOR} 92%)`,
        }}
      />
    </section>
  );
}
