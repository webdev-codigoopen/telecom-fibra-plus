import { useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import worldTopo from "world-atlas/countries-110m.json";

type Position = number[];
type Polygon = { type: "Polygon"; coordinates: Position[][] };
type MultiPolygon = { type: "MultiPolygon"; coordinates: Position[][][] };
type Geometry = Polygon | MultiPolygon;
type WorldFeature = {
  type: "Feature";
  id?: string | number;
  properties: Record<string, unknown> | null;
  geometry: Geometry;
};

export type WorldCountryEntry = {
  countryCode: string | null;
  countryName: string | null;
  humans: number;
  bots: number;
  total: number;
};

type Props = {
  rows: WorldCountryEntry[];
  totalIdentified: number;
  loading?: boolean;
};

const VIEW_W = 720;
const VIEW_H = 360;

// ISO 3166-1 numeric → alpha-2, covering every country present in
// world-atlas/countries-110m.json. Used to match topology features to the
// alpha-2 codes returned by /api/clicks/top-countries.
const NUMERIC_TO_ALPHA2: Record<string, string> = {
  "004": "AF", "008": "AL", "010": "AQ", "012": "DZ", "024": "AO",
  "031": "AZ", "032": "AR", "036": "AU", "040": "AT", "044": "BS",
  "050": "BD", "051": "AM", "056": "BE", "064": "BT", "068": "BO",
  "070": "BA", "072": "BW", "076": "BR", "084": "BZ", "090": "SB",
  "096": "BN", "100": "BG", "104": "MM", "108": "BI", "112": "BY",
  "116": "KH", "120": "CM", "124": "CA", "140": "CF", "144": "LK",
  "148": "TD", "152": "CL", "156": "CN", "158": "TW", "170": "CO",
  "178": "CG", "180": "CD", "188": "CR", "191": "HR", "192": "CU",
  "196": "CY", "203": "CZ", "204": "BJ", "208": "DK", "214": "DO",
  "218": "EC", "222": "SV", "226": "GQ", "231": "ET", "232": "ER",
  "233": "EE", "238": "FK", "242": "FJ", "246": "FI", "250": "FR",
  "260": "TF", "262": "DJ", "266": "GA", "268": "GE", "270": "GM",
  "275": "PS", "276": "DE", "288": "GH", "300": "GR", "304": "GL",
  "320": "GT", "324": "GN", "328": "GY", "332": "HT", "340": "HN",
  "348": "HU", "352": "IS", "356": "IN", "360": "ID", "364": "IR",
  "368": "IQ", "372": "IE", "376": "IL", "380": "IT", "384": "CI",
  "388": "JM", "392": "JP", "398": "KZ", "400": "JO", "404": "KE",
  "408": "KP", "410": "KR", "414": "KW", "417": "KG", "418": "LA",
  "422": "LB", "426": "LS", "428": "LV", "430": "LR", "434": "LY",
  "440": "LT", "442": "LU", "450": "MG", "454": "MW", "458": "MY",
  "466": "ML", "478": "MR", "484": "MX", "496": "MN", "498": "MD",
  "499": "ME", "504": "MA", "508": "MZ", "512": "OM", "516": "NA",
  "524": "NP", "528": "NL", "540": "NC", "548": "VU", "554": "NZ",
  "558": "NI", "562": "NE", "566": "NG", "578": "NO", "586": "PK",
  "591": "PA", "598": "PG", "600": "PY", "604": "PE", "608": "PH",
  "616": "PL", "620": "PT", "624": "GW", "626": "TL", "630": "PR",
  "634": "QA", "642": "RO", "643": "RU", "646": "RW", "682": "SA",
  "686": "SN", "688": "RS", "694": "SL", "703": "SK", "704": "VN",
  "705": "SI", "706": "SO", "710": "ZA", "716": "ZW", "724": "ES",
  "728": "SS", "729": "SD", "732": "EH", "740": "SR", "748": "SZ",
  "752": "SE", "756": "CH", "760": "SY", "762": "TJ", "764": "TH",
  "768": "TG", "780": "TT", "784": "AE", "788": "TN", "792": "TR",
  "795": "TM", "800": "UG", "804": "UA", "807": "MK", "818": "EG",
  "826": "GB", "834": "TZ", "840": "US", "854": "BF", "858": "UY",
  "860": "UZ", "862": "VE", "887": "YE", "894": "ZM",
};

type CountryFeature = WorldFeature & {
  alpha2: string | null;
  displayName: string;
};

function project(lon: number, lat: number): [number, number] {
  // Equirectangular projection. Longitude 0 sits in the middle of the canvas.
  const x = ((lon + 180) / 360) * VIEW_W;
  const y = ((90 - lat) / 180) * VIEW_H;
  return [x, y];
}

function ringToPath(ring: Position[]): string {
  let d = "";
  for (let i = 0; i < ring.length; i++) {
    const pt = ring[i]!;
    const [x, y] = project(pt[0]!, pt[1]!);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }
  return `${d}Z`;
}

function geometryToPath(g: Geometry): string {
  if (g.type === "Polygon") {
    return g.coordinates.map(ringToPath).join(" ");
  }
  if (g.type === "MultiPolygon") {
    return g.coordinates
      .map((poly: Position[][]) => poly.map(ringToPath).join(" "))
      .join(" ");
  }
  return "";
}

function geometryCentroid(g: Geometry): [number, number] | null {
  // Cheap visual centroid: average of all polygon vertices. Good enough for
  // anchoring the hover tooltip near the hovered country.
  let sx = 0;
  let sy = 0;
  let n = 0;
  const accumulate = (rings: Position[][]) => {
    for (const ring of rings) {
      for (const pt of ring) {
        const [x, y] = project(pt[0]!, pt[1]!);
        sx += x;
        sy += y;
        n += 1;
      }
    }
  };
  if (g.type === "Polygon") accumulate(g.coordinates);
  else if (g.type === "MultiPolygon") {
    for (const poly of g.coordinates) accumulate(poly);
  } else return null;
  if (n === 0) return null;
  return [sx / n, sy / n];
}

const countryFeatures: CountryFeature[] = (() => {
  const topology = worldTopo as unknown as Topology;
  const collection = topology.objects["countries"] as GeometryCollection;
  const fc = feature(topology, collection) as unknown as {
    features: WorldFeature[];
  };
  return fc.features.map((f) => {
    const id = typeof f.id === "string" || typeof f.id === "number"
      ? String(f.id).padStart(3, "0")
      : null;
    const alpha2 = id ? NUMERIC_TO_ALPHA2[id] ?? null : null;
    const name = (f.properties && typeof f.properties["name"] === "string"
      ? (f.properties["name"] as string)
      : "") || alpha2 || "Desconhecido";
    return { ...f, alpha2, displayName: name };
  });
})();

function colorForCount(count: number, max: number): string {
  if (count <= 0 || max <= 0) return "#F2F4F8";
  // Logarithmic ramp so a few high-volume countries don't drown out everyone
  // else. Light blue → brand blue (#0040FF).
  const t = Math.log10(count + 1) / Math.log10(max + 1);
  const eased = Math.max(0.06, Math.min(1, t));
  const r = Math.round(238 + (0 - 238) * eased);
  const g = Math.round(242 + (64 - 242) * eased);
  const b = Math.round(255 + (255 - 255) * eased);
  return `rgb(${r}, ${g}, ${b})`;
}

function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "";
  const cc = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "";
  const base = 0x1f1e6;
  const A = 0x41;
  return String.fromCodePoint(base + cc.charCodeAt(0) - A, base + cc.charCodeAt(1) - A);
}

export default function WorldClicksMap({ rows, totalIdentified, loading }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  const { byCode, max } = useMemo(() => {
    const m = new Map<string, WorldCountryEntry>();
    let mx = 0;
    for (const r of rows) {
      if (!r.countryCode) continue;
      const code = r.countryCode.toUpperCase();
      m.set(code, r);
      if (r.total > mx) mx = r.total;
    }
    return { byCode: m, max: mx };
  }, [rows]);

  // When the hovered country leaves the visible feature list (e.g. the data
  // refreshes), drop the tooltip so we don't render stale info.
  useEffect(() => {
    if (!hoveredCode) return;
    const stillExists = countryFeatures.some((f) => f.alpha2 === hoveredCode);
    if (!stillExists) {
      setHoveredCode(null);
      setHoverPos(null);
    }
  }, [hoveredCode]);

  const hoveredFeature = hoveredCode
    ? countryFeatures.find((f) => f.alpha2 === hoveredCode) ?? null
    : null;
  const hoveredEntry = hoveredCode ? byCode.get(hoveredCode) ?? null : null;
  const hoveredTotal = hoveredEntry?.total ?? 0;
  const hoveredHumans = hoveredEntry?.humans ?? 0;
  const hoveredBots = hoveredEntry?.bots ?? 0;
  const hoveredPct = totalIdentified > 0 && hoveredTotal > 0
    ? (hoveredTotal / totalIdentified) * 100
    : 0;

  const handleMove = (e: React.MouseEvent<SVGPathElement>, code: string | null) => {
    if (!code) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHoveredCode(code);
    setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      className="rounded-xl border border-[#E0E3EB] px-4 py-3 mb-4"
      data-testid="world-clicks-map"
    >
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-2">
        <div className="text-xs font-semibold text-[#7A7F8C] uppercase tracking-wide">
          Mapa mundial de origens
        </div>
        <div className="text-[11px] text-[#7A7F8C]">
          {totalIdentified.toLocaleString("pt-BR")} cliques identificados ·{" "}
          {byCode.size.toLocaleString("pt-BR")} países
        </div>
      </div>
      <div
        ref={containerRef}
        className="relative bg-[#F8FAFC] rounded-lg overflow-hidden"
        onMouseLeave={() => {
          setHoveredCode(null);
          setHoverPos(null);
        }}
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          width="100%"
          height="auto"
          role="img"
          aria-label="Mapa-múndi com volume de cliques por país"
          style={{ display: "block" }}
        >
          <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="#F8FAFC" />
          {countryFeatures.map((f) => {
            const code = f.alpha2;
            const entry = code ? byCode.get(code) : undefined;
            const fill = colorForCount(entry?.total ?? 0, max);
            const isHovered = !!code && code === hoveredCode;
            const path = geometryToPath(f.geometry);
            if (!path) return null;
            return (
              <path
                key={`${f.id ?? f.displayName}`}
                d={path}
                fill={fill}
                stroke={isHovered ? "#0D0D0D" : "#D4D7DE"}
                strokeWidth={isHovered ? 1 : 0.4}
                style={{ cursor: code && entry ? "pointer" : "default" }}
                onMouseEnter={(e) => handleMove(e, code)}
                onMouseMove={(e) => handleMove(e, code)}
              >
                <title>
                  {entry
                    ? `${f.displayName}: ${entry.total.toLocaleString("pt-BR")} cliques`
                    : f.displayName}
                </title>
              </path>
            );
          })}
        </svg>
        {hoveredFeature && hoverPos && (() => {
          const centroid = geometryCentroid(hoveredFeature.geometry);
          // Anchor the tooltip near the country's centroid (translated to the
          // container's pixel coordinates) but fall back to the cursor if the
          // centroid sits offscreen — useful for tiny island nations.
          const containerWidth = containerRef.current?.clientWidth ?? VIEW_W;
          const containerHeight = containerRef.current?.clientHeight ?? VIEW_H;
          const scaleX = containerWidth / VIEW_W;
          const scaleY = containerHeight / VIEW_H;
          let tx = hoverPos.x + 12;
          let ty = hoverPos.y + 12;
          if (centroid) {
            tx = centroid[0] * scaleX + 12;
            ty = centroid[1] * scaleY + 12;
          }
          const ttWidth = 220;
          const ttHeight = 92;
          if (tx + ttWidth > containerWidth) tx = containerWidth - ttWidth - 6;
          if (ty + ttHeight > containerHeight) ty = containerHeight - ttHeight - 6;
          if (tx < 6) tx = 6;
          if (ty < 6) ty = 6;
          return (
            <div
              className="pointer-events-none absolute z-10 bg-white border border-[#E0E3EB] rounded-lg shadow-lg px-3 py-2 text-xs"
              style={{ left: tx, top: ty, width: ttWidth }}
              data-testid="world-map-tooltip"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base leading-none" aria-hidden="true">
                  {countryFlag(hoveredFeature.alpha2) || "🏳️"}
                </span>
                <span className="font-bold text-[#0D0D0D] truncate">
                  {hoveredEntry?.countryName ?? hoveredFeature.displayName}
                </span>
              </div>
              {hoveredEntry ? (
                <>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[#7A7F8C]">Total</span>
                    <span className="font-bold tabular-nums text-[#2A2D38]">
                      {hoveredTotal.toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[#7A7F8C]">Humanos · Robôs</span>
                    <span className="tabular-nums text-[#2A2D38]">
                      <span className="font-semibold">{hoveredHumans.toLocaleString("pt-BR")}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{hoveredBots.toLocaleString("pt-BR")}</span>
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[#7A7F8C]">% identificados</span>
                    <span className="font-semibold tabular-nums text-[#2A2D38]">
                      {hoveredPct >= 10
                        ? `${hoveredPct.toFixed(0)}%`
                        : `${hoveredPct.toFixed(1)}%`}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-[#7A7F8C] italic">Sem cliques no período.</div>
              )}
            </div>
          );
        })()}
        {loading && (
          <div className="absolute top-2 right-2 bg-white/90 border border-[#E0E3EB] rounded-md px-2 py-0.5 text-[10px] text-[#7A7F8C]">
            atualizando…
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 mt-2 text-[10px] text-[#7A7F8C]">
        <span>Menos cliques</span>
        <div
          className="flex-1 h-2 rounded"
          style={{
            background:
              "linear-gradient(to right, #EEF2FF, #BFCBFF, #6E86FF, #2855FF, #0040FF)",
          }}
        />
        <span>Mais cliques</span>
      </div>
    </div>
  );
}
