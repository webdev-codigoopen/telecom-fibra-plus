import { useMemo } from "react";

const logoModules = import.meta.glob<string>(
  "../../../../attached_assets/channel-logos/*.{png,svg}",
  { eager: true, import: "default", query: "?url" },
);

const ALL_LOGOS: { src: string; name: string }[] = Object.entries(logoModules)
  .map(([path, src]) => {
    const file = path.split("/").pop() ?? "";
    const name = file.replace(/\.(png|svg)$/i, "").replace(/[-_]/g, " ");
    return { src, name };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

type Props = {
  logoHeight?: number;
  gap?: number;
  durationSec?: number;
  reverse?: boolean;
  logos?: { src: string; name: string }[];
};

function Track({ logoHeight, gap, durationSec, reverse, logos }: Required<Props>) {
  const items = [...logos, ...logos];
  return (
    <div
      className="flex w-max items-center"
      style={{
        gap,
        animation: `pmf-logo-scroll ${durationSec}s linear infinite`,
        animationDirection: reverse ? "reverse" : "normal",
      }}
    >
      {items.map((logo, i) => (
        <div
          key={`${logo.src}-${i}`}
          className="flex items-center justify-center shrink-0"
          style={{ height: logoHeight }}
        >
          <img
            src={logo.src}
            alt={logo.name}
            style={{
              height: logoHeight,
              width: "auto",
              maxWidth: logoHeight * 2.6,
              objectFit: "contain",
              display: "block",
            }}
            loading="lazy"
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
}

export default function LogoCarousel({
  logoHeight = 56,
  gap = 48,
  durationSec = 60,
  reverse = false,
  logos,
}: Props) {
  const list = useMemo(() => logos ?? ALL_LOGOS, [logos]);

  return (
    <>
      <style>{`
        @keyframes pmf-logo-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .pmf-logo-mask {
          -webkit-mask-image: linear-gradient(
            to right,
            transparent 0,
            black 8%,
            black 92%,
            transparent 100%
          );
                  mask-image: linear-gradient(
            to right,
            transparent 0,
            black 8%,
            black 92%,
            transparent 100%
          );
        }
        @media (prefers-reduced-motion: reduce) {
          .pmf-logo-track { animation: none !important; }
        }
      `}</style>
      <div className="pmf-logo-mask w-full overflow-hidden">
        <Track
          logoHeight={logoHeight}
          gap={gap}
          durationSec={durationSec}
          reverse={reverse}
          logos={list}
        />
      </div>
    </>
  );
}

export function SplitLogoCarousel({
  logoHeight = 40,
  gap = 32,
  durationSec = 50,
}: {
  logoHeight?: number;
  gap?: number;
  durationSec?: number;
}) {
  const half = Math.ceil(ALL_LOGOS.length / 2);
  const top = ALL_LOGOS.slice(0, half);
  const bottom = ALL_LOGOS.slice(half);
  return (
    <div className="flex flex-col" style={{ gap: 12 }}>
      <LogoCarousel
        logoHeight={logoHeight}
        gap={gap}
        durationSec={durationSec}
        logos={top}
      />
      <LogoCarousel
        logoHeight={logoHeight}
        gap={gap}
        durationSec={durationSec}
        reverse
        logos={bottom}
      />
    </div>
  );
}
