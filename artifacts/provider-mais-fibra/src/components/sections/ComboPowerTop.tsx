import bgIptv from "@assets/image_1778611956972.png";

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
        backgroundImage: `url(${bgIptv})`,
        backgroundSize: "auto 100%",
        backgroundPosition: "center center",
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}
