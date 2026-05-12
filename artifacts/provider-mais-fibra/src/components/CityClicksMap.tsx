import { useEffect, useMemo, useRef, useState } from "react";

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

type StatRow = {
  planSpeed: string;
  planPrice: string;
  source: string;
  total: number;
};

type RangeId = "today" | "7d" | "30d" | "90d" | "all" | "custom";

type Props =
  | { adminKey: string; baseUrl: string; clicks?: undefined }
  | { clicks: CityClickEntry[]; adminKey?: undefined; baseUrl?: undefined };

const VIEW_W = 720;
const VIEW_H = 460;
const PAD = 60;

const RANGE_OPTIONS: { id: RangeId; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "90d", label: "90 dias" },
  { id: "all", label: "Tudo" },
  { id: "custom", label: "Personalizado" },
];

type Window = { since?: string; until?: string };

function rangeToWindow(range: RangeId, customFrom: string, customTo: string): Window | null {
  if (range === "all") return {};
  if (range === "custom") {
    if (!customFrom || !customTo) return null;
    const since = new Date(`${customFrom}T00:00:00`);
    const until = new Date(`${customTo}T00:00:00`);
    until.setDate(until.getDate() + 1);
    if (Number.isNaN(since.getTime()) || Number.isNaN(until.getTime()) || until <= since) {
      return null;
    }
    return { since: since.toISOString(), until: until.toISOString() };
  }
  const now = new Date();
  const since = new Date(now);
  if (range === "today") {
    since.setHours(0, 0, 0, 0);
  } else if (range === "7d") {
    since.setDate(since.getDate() - 7);
  } else if (range === "30d") {
    since.setDate(since.getDate() - 30);
  } else if (range === "90d") {
    since.setDate(since.getDate() - 90);
  }
  return { since: since.toISOString(), until: now.toISOString() };
}

function previousWindow(current: Window): Window | null {
  if (!current.since || !current.until) return null;
  const since = new Date(current.since);
  const until = new Date(current.until);
  if (Number.isNaN(since.getTime()) || Number.isNaN(until.getTime())) return null;
  const span = until.getTime() - since.getTime();
  if (span <= 0) return null;
  const prevUntil = new Date(since.getTime());
  const prevSince = new Date(since.getTime() - span);
  return { since: prevSince.toISOString(), until: prevUntil.toISOString() };
}

async function fetchCityTotals(baseUrl: string, adminKey: string, win: Window): Promise<Map<string, number>> {
  const params = new URLSearchParams();
  if (win.since) params.set("since", win.since);
  if (win.until) params.set("until", win.until);
  const qs = params.toString();
  const url = `${baseUrl}/api/clicks/stats${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, { headers: { "X-Admin-Key": adminKey } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: StatRow[] = await res.json();
  const totals = new Map<string, number>();
  for (const row of data) {
    if (row.planSpeed !== "city") continue;
    totals.set(row.planPrice, (totals.get(row.planPrice) ?? 0) + row.total);
  }
  return totals;
}

export type CityConversion = { previews: number; signups: number };

async function fetchCityConversion(
  baseUrl: string,
  adminKey: string,
  win: Window,
): Promise<Map<string, CityConversion>> {
  const params = new URLSearchParams();
  if (win.since) params.set("since", win.since);
  if (win.until) params.set("until", win.until);
  const qs = params.toString();
  const url = `${baseUrl}/api/clicks/cities-conversion${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, { headers: { "X-Admin-Key": adminKey } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: { city: string; previews: number; signups: number }[] = await res.json();
  const map = new Map<string, CityConversion>();
  for (const row of data) {
    if (!row.city) continue;
    const prev = map.get(row.city) ?? { previews: 0, signups: 0 };
    prev.previews += row.previews ?? 0;
    prev.signups += row.signups ?? 0;
    map.set(row.city, prev);
  }
  return map;
}

type ColorMode = "volume" | "growth";

export default function CityClicksMap(props: Props) {
  const isAdminMode = props.adminKey !== undefined;
  const adminKey = props.adminKey;
  const baseUrl = props.baseUrl;
  const externalClicks = props.clicks;

  const [hovered, setHovered] = useState<string | null>(null);
  const [range, setRange] = useState<RangeId>("all");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [entries, setEntries] = useState<CityClickEntry[]>([]);
  const [prevEntries, setPrevEntries] = useState<CityClickEntry[] | null>(null);
  const [conversion, setConversion] = useState<Map<string, CityConversion>>(new Map());
  const [prevError, setPrevError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [colorMode, setColorMode] = useState<ColorMode>("volume");
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (!isAdminMode || !adminKey || !baseUrl) return;
    const win = rangeToWindow(range, customFrom, customTo);
    if (win === null) {
      // Custom range incomplete or invalid — don't fetch, keep current data.
      return;
    }
    const myReqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);

    const prevWin = previousWindow(win);
    setPrevError(false);

    const currentPromise = fetchCityTotals(baseUrl, adminKey, win);
    const prevPromise = prevWin
      ? fetchCityTotals(baseUrl, adminKey, prevWin).then(
          (r) => ({ ok: true as const, totals: r }),
          () => ({ ok: false as const }),
        )
      : Promise.resolve({ ok: true as const, totals: null });
    const conversionPromise = fetchCityConversion(baseUrl, adminKey, win).then(
      (r) => r,
      () => new Map<string, CityConversion>(),
    );

    Promise.all([currentPromise, prevPromise, conversionPromise])
      .then(([currentTotals, prevResult, conversionMap]) => {
        if (myReqId !== reqIdRef.current) return;
        setEntries(Array.from(currentTotals.entries()).map(([name, total]) => ({ name, total })));
        setConversion(conversionMap);
        if (!prevResult.ok) {
          setPrevEntries(null);
          setPrevError(true);
          return;
        }
        if (prevResult.totals) {
          setPrevEntries(Array.from(prevResult.totals.entries()).map(([name, total]) => ({ name, total })));
        } else {
          setPrevEntries(null);
        }
      })
      .catch(() => {
        if (myReqId !== reqIdRef.current) return;
        setError("Não foi possível carregar o mapa.");
      })
      .finally(() => {
        if (myReqId !== reqIdRef.current) return;
        setLoading(false);
      });
  }, [isAdminMode, range, customFrom, customTo, adminKey, baseUrl]);

  const effectiveEntries = isAdminMode ? entries : externalClicks ?? [];

  const clickMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of effectiveEntries) m.set(c.name, c.total);
    return m;
  }, [effectiveEntries]);

  const prevClickMap = useMemo(() => {
    const m = new Map<string, number>();
    if (prevEntries) {
      for (const c of prevEntries) m.set(c.name, c.total);
    }
    return m;
  }, [prevEntries]);

  const hasComparison = isAdminMode && prevEntries !== null;

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

  function deltaFor(name: string): { current: number; prev: number; abs: number; pct: number | null } | null {
    if (!hasComparison) return null;
    const current = clickMap.get(name) ?? 0;
    const prev = prevClickMap.get(name) ?? 0;
    const abs = current - prev;
    const pct = prev === 0 ? (current === 0 ? 0 : null) : (abs / prev) * 100;
    return { current, prev, abs, pct };
  }

  function growthColor(name: string): string {
    const d = deltaFor(name);
    if (!d) return "#B0B5C3";
    if (d.current === 0 && d.prev === 0) return "#B0B5C3";
    if (d.abs > 0) return "#00C040";
    if (d.abs < 0) return "#E03131";
    return "#7A7F8C";
  }

  const effectiveColorMode: ColorMode = hasComparison ? colorMode : "volume";

  const hoveredCity = hovered
    ? CITY_COORDS.find((c) => c.name === hovered) ?? null
    : null;
  const hoveredTotal = hoveredCity ? clickMap.get(hoveredCity.name) ?? 0 : 0;
  const hoveredDelta = hoveredCity ? deltaFor(hoveredCity.name) : null;
  const hoveredConv = hoveredCity ? conversion.get(hoveredCity.name) ?? null : null;
  const hoveredPos = hoveredCity ? project(hoveredCity.lat, hoveredCity.lon) : null;
  const tooltipHeight =
    36 + (hoveredDelta ? 16 : 0) + (hoveredConv && (hoveredConv.previews > 0 || hoveredConv.signups > 0) ? 16 : 0);

  function formatDelta(d: { abs: number; pct: number | null; prev: number; current: number }): string {
    if (d.current === 0 && d.prev === 0) return "Sem cliques nos dois períodos";
    const arrow = d.abs > 0 ? "▲" : d.abs < 0 ? "▼" : "•";
    const absStr = `${d.abs > 0 ? "+" : ""}${d.abs}`;
    if (d.pct === null) return `${arrow} ${absStr} (novo)`;
    const pctStr = `${d.pct > 0 ? "+" : ""}${d.pct.toFixed(0)}%`;
    return `${arrow} ${absStr} (${pctStr}) vs. anterior`;
  }

  return (
    <div className="bg-white rounded-xl border border-[#E0E3EB] p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="font-bold text-sm text-[#0D0D0D]">Mapa de cliques por cidade</h3>
          <p className="text-xs text-[#7A7F8C]">
            Bolhas maiores = mais cliques no CTA da cidade. Total: {totalClicks}.
            {loading && <span className="ml-2 text-[#0040FF]">Atualizando...</span>}
            {error && <span className="ml-2 text-red-500">{error}</span>}
            {!error && prevError && (
              <span className="ml-2 text-amber-600">Comparação com período anterior indisponível.</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[#7A7F8C]">
          {effectiveColorMode === "growth" ? (
            <>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block rounded-full" style={{ width: 12, height: 12, background: "#00C040", opacity: 0.8 }} />
                crescendo
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block rounded-full" style={{ width: 12, height: 12, background: "#E03131", opacity: 0.8 }} />
                caindo
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block rounded-full" style={{ width: 12, height: 12, background: "#B0B5C3", opacity: 0.8 }} />
                sem mudança
              </span>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
      {isAdminMode && (
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="inline-flex rounded-lg border border-[#E0E3EB] bg-white p-0.5" role="group" aria-label="Período do mapa">
          {RANGE_OPTIONS.map((opt) => {
            const active = range === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRange(opt.id)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                  active
                    ? "bg-[#0040FF] text-white"
                    : "text-[#7A7F8C] hover:text-[#0D0D0D]"
                }`}
                aria-pressed={active}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {range === "custom" && (
          <div className="inline-flex items-center gap-2 text-xs text-[#2A2D38]">
            <label className="flex items-center gap-1">
              <span className="text-[#7A7F8C]">De</span>
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="border border-[#E0E3EB] rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
                aria-label="Data inicial do mapa"
              />
            </label>
            <label className="flex items-center gap-1">
              <span className="text-[#7A7F8C]">até</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                className="border border-[#E0E3EB] rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
                aria-label="Data final do mapa"
              />
            </label>
          </div>
        )}
        <div className="inline-flex rounded-lg border border-[#E0E3EB] bg-white p-0.5" role="group" aria-label="Cor das bolhas">
          {(["volume", "growth"] as ColorMode[]).map((mode) => {
            const active = effectiveColorMode === mode;
            const disabled = mode === "growth" && !hasComparison;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => !disabled && setColorMode(mode)}
                disabled={disabled}
                title={disabled ? "Selecione um período com janela anterior comparável" : undefined}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                  active
                    ? "bg-[#0040FF] text-white"
                    : disabled
                      ? "text-[#C5C9D3] cursor-not-allowed"
                      : "text-[#7A7F8C] hover:text-[#0D0D0D]"
                }`}
                aria-pressed={active}
              >
                {mode === "volume" ? "Cor por volume" : "Cor por crescimento"}
              </button>
            );
          })}
        </div>
      </div>
      )}
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
            let fill: string;
            let opacity: number;
            if (effectiveColorMode === "growth") {
              fill = growthColor(city.name);
              opacity = total === 0 && (prevClickMap.get(city.name) ?? 0) === 0 ? 0.35 : 0.8;
            } else {
              fill = total === 0 ? "#B0B5C3" : isMax ? "#00C040" : "#0040FF";
              opacity = total === 0 ? 0.35 : 0.7;
            }
            const d = deltaFor(city.name);
            const showBadge =
              effectiveColorMode === "growth" &&
              d !== null &&
              d.abs !== 0 &&
              (total > 0 || d.prev > 0);
            const badgeText = d
              ? d.abs > 0
                ? `▲${d.abs}`
                : d.abs < 0
                  ? `▼${Math.abs(d.abs)}`
                  : ""
              : "";
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
                {showBadge && (
                  <text
                    x={x}
                    y={y + r + 11}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill={d!.abs > 0 ? "#00863A" : "#C92020"}
                    pointerEvents="none"
                  >
                    {badgeText}
                  </text>
                )}
              </g>
            );
          })}
          {hoveredCity && hoveredPos && (
            <g pointerEvents="none">
              <rect
                x={Math.min(VIEW_W - 200, Math.max(8, hoveredPos.x + 14))}
                y={Math.max(8, hoveredPos.y - tooltipHeight - 4)}
                width={190}
                height={tooltipHeight}
                rx={6}
                fill="#0D0D0D"
                opacity={0.92}
              />
              <text
                x={Math.min(VIEW_W - 200, Math.max(8, hoveredPos.x + 14)) + 10}
                y={Math.max(8, hoveredPos.y - tooltipHeight - 4) + 15}
                fill="white"
                fontSize="11"
                fontWeight="700"
              >
                {hoveredCity.name}
              </text>
              <text
                x={Math.min(VIEW_W - 200, Math.max(8, hoveredPos.x + 14)) + 10}
                y={Math.max(8, hoveredPos.y - tooltipHeight - 4) + 30}
                fill="#A8B0C0"
                fontSize="10"
              >
                {hoveredTotal} {hoveredTotal === 1 ? "clique" : "cliques"}
              </text>
              {hoveredDelta && (
                <text
                  x={Math.min(VIEW_W - 200, Math.max(8, hoveredPos.x + 14)) + 10}
                  y={Math.max(8, hoveredPos.y - tooltipHeight - 4) + 45}
                  fill={
                    hoveredDelta.abs > 0
                      ? "#7CE0A0"
                      : hoveredDelta.abs < 0
                        ? "#FF8A8A"
                        : "#A8B0C0"
                  }
                  fontSize="10"
                  fontWeight="600"
                >
                  {formatDelta(hoveredDelta)}
                </text>
              )}
              {hoveredConv && (hoveredConv.previews > 0 || hoveredConv.signups > 0) && (
                <text
                  x={Math.min(VIEW_W - 200, Math.max(8, hoveredPos.x + 14)) + 10}
                  y={Math.max(8, hoveredPos.y - tooltipHeight - 4) + (hoveredDelta ? 60 : 45)}
                  fill="#FFD66B"
                  fontSize="10"
                  fontWeight="600"
                >
                  {(() => {
                    const { previews, signups } = hoveredConv;
                    const pct = previews > 0 ? Math.round((signups / previews) * 100) : null;
                    return `Preview ${previews} → Assina ${signups}${pct !== null ? ` (${pct}%)` : ""}`;
                  })()}
                </text>
              )}
            </g>
          )}
        </svg>
      </div>
      <TopCitiesList
        entries={CITY_COORDS.map((c) => ({ name: c.name, total: clickMap.get(c.name) ?? 0 }))}
        totalClicks={totalClicks}
        deltas={
          hasComparison
            ? new Map(CITY_COORDS.map((c) => [c.name, deltaFor(c.name)]))
            : null
        }
        conversion={isAdminMode ? conversion : null}
      />
    </div>
  );
}

type DeltaInfo = { current: number; prev: number; abs: number; pct: number | null };

function TopCitiesList({
  entries,
  totalClicks,
  deltas,
  conversion,
}: {
  entries: CityClickEntry[];
  totalClicks: number;
  deltas: Map<string, DeltaInfo | null> | null;
  conversion: Map<string, CityConversion> | null;
}) {
  const sorted = useMemo(() => {
    return [...entries].sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [entries]);

  const conversionRows = useMemo(() => {
    if (!conversion) return [];
    return Array.from(conversion.entries())
      .map(([name, c]) => ({
        name,
        previews: c.previews,
        signups: c.signups,
        rate: c.previews > 0 ? (c.signups / c.previews) * 100 : null,
      }))
      .filter((r) => r.previews > 0 || r.signups > 0)
      .sort((a, b) => {
        if (b.previews !== a.previews) return b.previews - a.previews;
        return a.name.localeCompare(b.name, "pt-BR");
      });
  }, [conversion]);

  const totalPreviews = conversionRows.reduce((s, r) => s + r.previews, 0);
  const totalSignups = conversionRows.reduce((s, r) => s + r.signups, 0);
  const overallRate = totalPreviews > 0 ? (totalSignups / totalPreviews) * 100 : null;

  return (
    <div className="mt-4 border-t border-[#E0E3EB] pt-3">
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="font-bold text-xs text-[#0D0D0D]">Top cidades</h4>
        <span className="text-[10px] text-[#7A7F8C]">
          {totalClicks > 0 ? `${totalClicks} cliques no total` : "Sem cliques no período"}
        </span>
      </div>
      <ol className="flex flex-col gap-1.5">
        {sorted.map((entry, idx) => {
          const isZero = entry.total === 0;
          const share = totalClicks > 0 ? (entry.total / totalClicks) * 100 : 0;
          const barWidth = share;
          const d = deltas?.get(entry.name) ?? null;
          let deltaNode: React.ReactNode = null;
          if (d && (d.current !== 0 || d.prev !== 0)) {
            if (d.abs === 0) {
              deltaNode = <span className="text-[#7A7F8C]">• 0</span>;
            } else {
              const isUp = d.abs > 0;
              const color = isUp ? "text-[#00863A]" : "text-[#C92020]";
              const pctStr =
                d.pct === null ? "novo" : `${d.pct > 0 ? "+" : ""}${d.pct.toFixed(0)}%`;
              deltaNode = (
                <span className={`${color} font-semibold tabular-nums`}>
                  {isUp ? "▲" : "▼"} {Math.abs(d.abs)} ({pctStr})
                </span>
              );
            }
          }
          return (
            <li
              key={entry.name}
              className={`flex items-center gap-2 text-xs ${isZero && !d ? "opacity-40" : ""}`}
            >
              <span className="w-5 text-right font-semibold text-[#7A7F8C] tabular-nums">
                {idx + 1}.
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold text-[#2A2D38]">{entry.name}</span>
                  <span className="tabular-nums text-[#7A7F8C] text-[11px] shrink-0 flex items-center gap-2">
                    {deltaNode}
                    <span>
                      {entry.total} {totalClicks > 0 && `· ${share.toFixed(1)}%`}
                    </span>
                  </span>
                </span>
                <span className="block mt-1 h-1.5 rounded-full bg-[#F0F2F7] overflow-hidden">
                  <span
                    className="block h-full rounded-full bg-[#0040FF]"
                    style={{ width: `${barWidth}%` }}
                  />
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      {conversion && (
        <div className="mt-5 pt-3 border-t border-[#E0E3EB]">
          <div className="flex items-baseline justify-between mb-2">
            <h4 className="font-bold text-xs text-[#0D0D0D]">
              Conversão por cidade
              <span className="ml-1 font-normal text-[10px] text-[#7A7F8C]">
                (preview WhatsApp → assinatura)
              </span>
            </h4>
            <span className="text-[10px] text-[#7A7F8C] tabular-nums">
              {totalPreviews > 0
                ? `${totalPreviews} previews · ${totalSignups} assinaturas${
                    overallRate !== null ? ` · ${overallRate.toFixed(0)}%` : ""
                  }`
                : "Sem previews no período"}
            </span>
          </div>
          {conversionRows.length === 0 ? (
            <p className="text-[11px] text-[#7A7F8C] italic">
              Nenhum preview do WhatsApp foi aberto a partir de uma página de cidade neste período.
            </p>
          ) : (
            <ol className="flex flex-col gap-1.5">
              {conversionRows.map((r, idx) => {
                const rate = r.rate;
                const rateColor =
                  rate === null
                    ? "text-[#7A7F8C]"
                    : rate >= 50
                      ? "text-[#00863A]"
                      : rate >= 20
                        ? "text-[#0040FF]"
                        : "text-[#C92020]";
                const barPct = rate === null ? 0 : Math.min(100, Math.max(0, rate));
                const barColor =
                  rate === null
                    ? "#B0B5C3"
                    : rate >= 50
                      ? "#00C040"
                      : rate >= 20
                        ? "#0040FF"
                        : "#E03131";
                return (
                  <li key={r.name} className="flex items-center gap-2 text-xs">
                    <span className="w-5 text-right font-semibold text-[#7A7F8C] tabular-nums">
                      {idx + 1}.
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold text-[#2A2D38]">{r.name}</span>
                        <span className="tabular-nums text-[#7A7F8C] text-[11px] shrink-0 flex items-center gap-2">
                          <span>
                            {r.previews} prev · {r.signups} assin
                          </span>
                          <span className={`font-semibold ${rateColor}`}>
                            {rate === null ? "—" : `${rate.toFixed(0)}%`}
                          </span>
                        </span>
                      </span>
                      <span className="block mt-1 h-1.5 rounded-full bg-[#F0F2F7] overflow-hidden">
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${barPct}%`, background: barColor }}
                        />
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
