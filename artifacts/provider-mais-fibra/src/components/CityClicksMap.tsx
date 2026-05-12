import { useMemo, useState } from "react";

type CityCoord = { name: string; lat: number; lon: number };

const CITY_COORDS: CityCoord[] = [
  { name: "Barreiras", lat: -12.1527, lon: -44.9900 },
  { name: "Luís Eduardo Magalhães", lat: -12.0905, lon: -45.7889 },
  { name: "Angical", lat: -12.0186, lon: -44.7155 },
  { name: "Baianópolis", lat: -12.3022, lon: -44.5408 },
  { name: "Cristópolis", lat: -12.2353, lon: -44.4036 },
  { name: "São Desidério", lat: -12.3636, lon: -44.9744 },
  { name: "Jaborandi", lat: -14.0250, lon: -45.8347 },
  { name: "Cotegipe", lat: -11.9989, lon: -44.2519 },
  { name: "Wanderley", lat: -12.1153, lon: -43.8956 },
  { name: "Bom Jesus da Lapa", lat: -13.2553, lon: -43.4181 },
  { name: "Santa Maria da Vitória", lat: -13.3961, lon: -44.2014 },
  { name: "Correntina", lat: -13.3431, lon: -44.6364 },
];

export type CityClickEntry = { name: string; total: number };

type Props = {
  clicks: CityClickEntry[];
};

const VIEW_W = 720;
const VIEW_H = 460;
const PAD = 60;

export default function CityClicksMap({ clicks }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const clickMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of clicks) m.set(c.name, c.total);
    return m;
  }, [clicks]);

  const { lonMin, lonMax, latMin, latMax } = useMemo(() => {
    const lons = CITY_COORDS.map((c) => c.lon);
    const lats = CITY_COORDS.map((c) => c.lat);
    return {
      lonMin: Math.min(...lons),
      lonMax: Math.max(...lons),
      latMin: Math.min(...lats),
      latMax: Math.max(...lats),
    };
  }, []);

  function project(lat: number, lon: number) {
    const x = PAD + ((lon - lonMin) / (lonMax - lonMin)) * (VIEW_W - PAD * 2);
    const y = PAD + ((latMax - lat) / (latMax - latMin)) * (VIEW_H - PAD * 2);
    return { x, y };
  }

  const maxClicks = Math.max(1, ...CITY_COORDS.map((c) => clickMap.get(c.name) ?? 0));
  const totalClicks = CITY_COORDS.reduce((sum, c) => sum + (clickMap.get(c.name) ?? 0), 0);

  function bubbleRadius(total: number) {
    if (total <= 0) return 5;
    const scaled = Math.sqrt(total / maxClicks);
    return 7 + scaled * 28;
  }

  const hoveredCity = hovered
    ? CITY_COORDS.find((c) => c.name === hovered) ?? null
    : null;
  const hoveredTotal = hoveredCity ? clickMap.get(hoveredCity.name) ?? 0 : 0;
  const hoveredPos = hoveredCity ? project(hoveredCity.lat, hoveredCity.lon) : null;

  return (
    <div className="bg-white rounded-xl border border-[#E0E3EB] p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="font-bold text-sm text-[#0D0D0D]">Mapa de cliques por cidade</h3>
          <p className="text-xs text-[#7A7F8C]">
            Bolhas maiores = mais cliques no CTA da cidade. Total: {totalClicks}.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[#7A7F8C]">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: "#0040FF", opacity: 0.6 }} />
            poucos
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block rounded-full" style={{ width: 14, height: 14, background: "#0040FF", opacity: 0.7 }} />
            médio
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block rounded-full" style={{ width: 22, height: 22, background: "#00C040", opacity: 0.8 }} />
            mais
          </span>
        </div>
      </div>
      <div className="relative w-full overflow-hidden rounded-lg" style={{ background: "#F5F7FA" }}>
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="block w-full h-auto"
          role="img"
          aria-label="Mapa de cliques por cidade no Oeste da Bahia"
        >
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E0E3EB" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width={VIEW_W} height={VIEW_H} fill="url(#grid)" />
          <text x={PAD} y={28} fill="#7A7F8C" fontSize="11" fontWeight="600">
            Oeste da Bahia
          </text>
          <text x={VIEW_W - PAD} y={VIEW_H - 16} fill="#B0B5C3" fontSize="10" textAnchor="end">
            N ↑
          </text>
          {CITY_COORDS.map((city) => {
            const { x, y } = project(city.lat, city.lon);
            const total = clickMap.get(city.name) ?? 0;
            const r = bubbleRadius(total);
            const isMax = total > 0 && total === maxClicks;
            const fill = total === 0 ? "#B0B5C3" : isMax ? "#00C040" : "#0040FF";
            const opacity = total === 0 ? 0.35 : 0.7;
            return (
              <g
                key={city.name}
                onMouseEnter={() => setHovered(city.name)}
                onMouseLeave={() => setHovered((cur) => (cur === city.name ? null : cur))}
                style={{ cursor: "pointer" }}
              >
                <circle cx={x} cy={y} r={r} fill={fill} opacity={opacity} />
                <circle cx={x} cy={y} r={3} fill="#0D0D0D" />
                <text
                  x={x}
                  y={y - r - 6}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="600"
                  fill="#2A2D38"
                  pointerEvents="none"
                >
                  {city.name}
                </text>
              </g>
            );
          })}
          {hoveredCity && hoveredPos && (
            <g pointerEvents="none">
              <rect
                x={Math.min(VIEW_W - 180, Math.max(8, hoveredPos.x + 14))}
                y={Math.max(8, hoveredPos.y - 38)}
                width={170}
                height={36}
                rx={6}
                fill="#0D0D0D"
                opacity={0.92}
              />
              <text
                x={Math.min(VIEW_W - 180, Math.max(8, hoveredPos.x + 14)) + 10}
                y={Math.max(8, hoveredPos.y - 38) + 15}
                fill="white"
                fontSize="11"
                fontWeight="700"
              >
                {hoveredCity.name}
              </text>
              <text
                x={Math.min(VIEW_W - 180, Math.max(8, hoveredPos.x + 14)) + 10}
                y={Math.max(8, hoveredPos.y - 38) + 30}
                fill="#A8B0C0"
                fontSize="10"
              >
                {hoveredTotal} {hoveredTotal === 1 ? "clique" : "cliques"}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
