import bannerFutbol from "@assets/banner_futbol_1778789632623.png";

export default function WatchBanner() {
  return (
    <section
      data-testid="watch-banner"
      aria-label="Watch — Viva os grandes jogos e campeonatos ao vivo"
      style={{
        width: "100%",
        backgroundColor: "#020B2E",
        display: "block",
      }}
    >
      <img
        src={bannerFutbol}
        alt="Watch — Viva os grandes jogos e campeonatos ao vivo"
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          margin: "0 auto",
        }}
      />
    </section>
  );
}
