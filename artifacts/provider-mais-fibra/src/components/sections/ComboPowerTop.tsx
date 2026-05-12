import bgIptv from "@assets/bg-sessao-iptv_1778611391057.png";

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
        backgroundSize: "contain",
        backgroundPosition: "center center",
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}
