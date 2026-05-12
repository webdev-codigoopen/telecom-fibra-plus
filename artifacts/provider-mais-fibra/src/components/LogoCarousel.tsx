import { useMemo } from "react";

const logoModules = import.meta.glob<string>(
  "../../../../attached_assets/channel-logos/*.{png,svg}",
  { eager: true, import: "default", query: "?url" },
);

type Logo = { src: string; name: string; family: string };

function familyOf(file: string): string {
  const base = file.replace(/\.(png|svg)$/i, "").toLowerCase();
  // Strip trailing region tag (-br, -us, -lam, -ae)
  const noRegion = base.replace(/-(br|us|lam|ae)$/i, "");
  // Group families: take leading word stem, drop trailing numbers / variant words
  const stem = noRegion
    .replace(/[-_](\d+|plus|premiere|reality|news|cult|fun|pipoca|premium|touch|action|2|3)$/i, "")
    .replace(/[-_](channel|tv|brasil|nova)$/i, "");
  // Special collapses
  if (/^espn/.test(stem)) return "espn";
  if (/^tele[-_]?cine/.test(stem)) return "telecine";
  if (/^universal/.test(stem)) return "universal";
  if (/^sportv/.test(stem)) return "sportv";
  if (/^band/.test(stem)) return "band";
  if (/^record/.test(stem)) return "record";
  if (/^globo|^gloob/.test(stem)) return "globo";
  if (/^canal/.test(stem)) return "canal";
  if (/^rede/.test(stem)) return "rede";
  if (/^tv[-_]/.test(stem)) return "tv-net";
  return stem;
}

const RAW_LOGOS: Logo[] = Object.entries(logoModules).map(([path, src]) => {
  const file = path.split("/").pop() ?? "";
  const name = file.replace(/\.(png|svg)$/i, "").replace(/[-_]/g, " ");
  return { src, name, family: familyOf(file) };
});

// Interleave by family using round-robin so same-family logos are spread apart
function interleaveByFamily(logos: Logo[]): Logo[] {
  const groups = new Map<string, Logo[]>();
  for (const l of logos) {
    if (!groups.has(l.family)) groups.set(l.family, []);
    groups.get(l.family)!.push(l);
  }
  // Sort families by descending size so big families get spread first
  const buckets = Array.from(groups.values())
    .map((g) => g.slice().sort((a, b) => a.name.localeCompare(b.name)))
    .sort((a, b) => b.length - a.length);
  const out: Logo[] = [];
  let added = true;
  let i = 0;
  while (added) {
    added = false;
    for (const b of buckets) {
      if (i < b.length) {
        out.push(b[i]);
        added = true;
      }
    }
    i++;
  }
  return out;
}

const ALL_LOGOS: Logo[] = interleaveByFamily(RAW_LOGOS);

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
