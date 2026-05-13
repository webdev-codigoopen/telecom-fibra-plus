import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { colorForSource } from "../lib/sourceColors";

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

export type CityClickEntry = { name: string; total: number; interests?: number };

type StatRow = {
  planSpeed: string;
  planPrice: string;
  source: string;
  total: number;
};

type RangeId = "today" | "7d" | "30d" | "90d" | "all" | "custom";

type Props =
  | {
      adminKey: string;
      baseUrl: string;
      clicks?: undefined;
      selectedCity?: string | null;
      onSelectCity?: (city: string | null) => void;
    }
  | {
      clicks: CityClickEntry[];
      adminKey?: undefined;
      baseUrl?: undefined;
      selectedCity?: undefined;
      onSelectCity?: undefined;
    };

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

type CityTotals = { total: number; interests: number };

async function fetchCityTotals(baseUrl: string, adminKey: string, win: Window): Promise<Map<string, CityTotals>> {
  const params = new URLSearchParams();
  if (win.since) params.set("since", win.since);
  if (win.until) params.set("until", win.until);
  const qs = params.toString();
  const url = `${baseUrl}/api/clicks/stats${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, { headers: { "X-Admin-Key": adminKey } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: StatRow[] = await res.json();
  const totals = new Map<string, CityTotals>();
  for (const row of data) {
    if (row.planSpeed !== "city") continue;
    const cur = totals.get(row.planPrice) ?? { total: 0, interests: 0 };
    cur.total += row.total;
    if (row.source === "interest") cur.interests += row.total;
    totals.set(row.planPrice, cur);
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

type ColorMode = "volume" | "growth" | "conversion";

type ConversionScale = { mode: "auto" } | { mode: "target"; targetPct: number };

const CONVERSION_SCALE_STORAGE_PREFIX = "pmf:mapConversionScale";
const DEFAULT_TARGET_PCT = 10;

function hashAdminKey(adminKey: string | undefined): string {
  if (!adminKey) return "anon";
  // Lightweight non-cryptographic hash — only used to scope the storage key
  // per admin identity so different admins on the same browser don't share
  // their preferred conversion scale. Not used for security.
  let h = 5381;
  for (let i = 0; i < adminKey.length; i++) {
    h = ((h << 5) + h + adminKey.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

function storageKeyFor(adminKey: string | undefined): string {
  return `${CONVERSION_SCALE_STORAGE_PREFIX}:${hashAdminKey(adminKey)}`;
}

function loadConversionScale(adminKey: string | undefined): ConversionScale {
  if (typeof window === "undefined") return { mode: "auto" };
  try {
    const raw = window.localStorage.getItem(storageKeyFor(adminKey));
    if (!raw) return { mode: "auto" };
    const parsed = JSON.parse(raw) as Partial<ConversionScale> & { targetPct?: unknown };
    if (parsed?.mode === "target") {
      const n = Number(parsed.targetPct);
      if (Number.isFinite(n) && n > 0 && n <= 100) {
        return { mode: "target", targetPct: n };
      }
      return { mode: "target", targetPct: DEFAULT_TARGET_PCT };
    }
    if (parsed?.mode === "auto") return { mode: "auto" };
  } catch {
    // ignore
  }
  return { mode: "auto" };
}

function saveConversionScale(adminKey: string | undefined, scale: ConversionScale) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKeyFor(adminKey), JSON.stringify(scale));
  } catch {
    // ignore
  }
}

function conversionColor(rate: number): string {
  // rate in [0, 1]. Red (low) -> Yellow (mid) -> Green (high).
  const clamped = Math.max(0, Math.min(1, rate));
  let r: number;
  let g: number;
  let b: number;
  if (clamped < 0.5) {
    const t = clamped / 0.5;
    r = 224 + (245 - 224) * t;
    g = 49 + (179 - 49) * t;
    b = 49 + (8 - 49) * t;
  } else {
    const t = (clamped - 0.5) / 0.5;
    r = 245 + (0 - 245) * t;
    g = 179 + (192 - 179) * t;
    b = 8 + (64 - 8) * t;
  }
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

export default function CityClicksMap(props: Props) {
  const isAdminMode = props.adminKey !== undefined;
  const adminKey = props.adminKey;
  const baseUrl = props.baseUrl;
  const externalClicks = props.clicks;
  const selectedCity = props.selectedCity ?? null;
  const onSelectCity = props.onSelectCity;

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
  const [conversionScale, setConversionScale] = useState<ConversionScale>(() => loadConversionScale(adminKey));
  const [targetInput, setTargetInput] = useState<string>(() => {
    const s = loadConversionScale(adminKey);
    return s.mode === "target" ? String(s.targetPct) : String(DEFAULT_TARGET_PCT);
  });
  const reqIdRef = useRef(0);

  useEffect(() => {
    // Reload preferences when the admin identity changes (e.g. different
    // admin signs in within the same browser).
    const next = loadConversionScale(adminKey);
    setConversionScale(next);
    setTargetInput(next.mode === "target" ? String(next.targetPct) : String(DEFAULT_TARGET_PCT));
  }, [adminKey]);

  useEffect(() => {
    saveConversionScale(adminKey, conversionScale);
  }, [adminKey, conversionScale]);

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
        setEntries(
          Array.from(currentTotals.entries()).map(([name, t]) => ({
            name,
            total: t.total,
            interests: t.interests,
          })),
        );
        setConversion(conversionMap);
        if (!prevResult.ok) {
          setPrevEntries(null);
          setPrevError(true);
          return;
        }
        if (prevResult.totals) {
          setPrevEntries(
            Array.from(prevResult.totals.entries()).map(([name, t]) => ({
              name,
              total: t.total,
              interests: t.interests,
            })),
          );
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

  const interestsMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of effectiveEntries) {
      if (c.interests && c.interests > 0) m.set(c.name, c.interests);
    }
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

  const knownCityNames = useMemo(() => new Set(CITY_COORDS.map((c) => c.name)), []);
  const extraEntries = useMemo(() => {
    return effectiveEntries
      .filter((e) => e.total > 0 && !knownCityNames.has(e.name))
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return a.name.localeCompare(b.name, "pt-BR");
      });
  }, [effectiveEntries, knownCityNames]);

  const maxClicks = Math.max(
    1,
    ...CITY_COORDS.map((c) => clickMap.get(c.name) ?? 0),
    ...extraEntries.map((e) => e.total),
  );
  const knownTotal = CITY_COORDS.reduce((sum, c) => sum + (clickMap.get(c.name) ?? 0), 0);
  const extraTotal = extraEntries.reduce((sum, e) => sum + e.total, 0);
  const totalClicks = knownTotal + extraTotal;

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

  const effectiveColorMode: ColorMode =
    colorMode === "growth" && !hasComparison ? "volume" : colorMode;

  const observedMaxRate = useMemo(() => {
    let max = 0;
    for (const c of conversion.values()) {
      if (c.previews > 0) {
        const r = c.signups / c.previews;
        if (r > max) max = r;
      }
    }
    return max;
  }, [conversion]);

  const scaleMaxRate = useMemo(() => {
    if (conversionScale.mode === "target") {
      return Math.max(0.0001, Math.min(1, conversionScale.targetPct / 100));
    }
    // auto: fit to highest observed rate; fall back to 1 if no data
    return observedMaxRate > 0 ? observedMaxRate : 1;
  }, [conversionScale, observedMaxRate]);

  const scaleMaxPct = scaleMaxRate * 100;
  const formatPct = (n: number) => (n >= 10 ? n.toFixed(0) : n.toFixed(1));

  const exportRangeLabel = useMemo(() => {
    if (!isAdminMode) return null;
    const win = rangeToWindow(range, customFrom, customTo);
    if (win === null) return null;
    if (!win.since && !win.until) return "tudo";
    const fmt = (iso: string, subtractDay = false) => {
      const d = new Date(iso);
      if (subtractDay) d.setDate(d.getDate() - 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    // Custom ranges are stored end-exclusive (until = next day at 00:00),
    // so the user-facing end date is one day earlier. Preset ranges use
    // `now` as until, which is already the correct end date.
    const untilIsExclusive = range === "custom";
    const since = win.since ? fmt(win.since) : null;
    const until = win.until ? fmt(win.until, untilIsExclusive) : null;
    if (since && until) return since === until ? since : `${since}_a_${until}`;
    return since ?? until ?? "periodo";
  }, [isAdminMode, range, customFrom, customTo]);

  const allCityNames = useMemo(() => {
    const set = new Set<string>();
    for (const e of effectiveEntries) if (e.name) set.add(e.name);
    if (prevEntries) for (const e of prevEntries) if (e.name) set.add(e.name);
    return Array.from(set);
  }, [effectiveEntries, prevEntries]);

  const canExportComparison =
    isAdminMode &&
    hasComparison &&
    exportRangeLabel != null &&
    allCityNames.some(
      (name) => (clickMap.get(name) ?? 0) > 0 || (prevClickMap.get(name) ?? 0) > 0,
    );

  function handleExportComparisonCsv() {
    if (!canExportComparison) return;
    const escape = (val: string) => {
      if (/[",\n;]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
      return val;
    };
    const header = ["city", "current_total", "previous_total", "change_abs", "change_pct"];
    const rows = allCityNames
      .map((name) => {
        const current = clickMap.get(name) ?? 0;
        const prev = hasComparison ? prevClickMap.get(name) ?? 0 : null;
        return { name, current, prev };
      })
      .filter((r) => r.current > 0 || (r.prev ?? 0) > 0)
      .sort((a, b) => {
        if (b.current !== a.current) return b.current - a.current;
        return a.name.localeCompare(b.name, "pt-BR");
      })
      .map((r) => {
        let prevStr = "";
        let absStr = "";
        let pctStr = "";
        if (r.prev !== null) {
          prevStr = String(r.prev);
          const abs = r.current - r.prev;
          absStr = String(abs);
          if (r.prev === 0) {
            pctStr = r.current === 0 ? "0.0" : "";
          } else {
            pctStr = ((abs / r.prev) * 100).toFixed(1);
          }
        }
        return [escape(r.name), String(r.current), prevStr, absStr, pctStr].join(",");
      });
    const csv = "\uFEFF" + [header.join(","), ...rows].join("\n") + "\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comparativo-cidades_${exportRangeLabel}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const hoveredCity = hovered
    ? CITY_COORDS.find((c) => c.name === hovered) ?? null
    : null;
  const hoveredTotal = hoveredCity ? clickMap.get(hoveredCity.name) ?? 0 : 0;
  const hoveredInterests = hoveredCity ? interestsMap.get(hoveredCity.name) ?? 0 : 0;
  const hoveredClicks = Math.max(0, hoveredTotal - hoveredInterests);
  const hoveredDelta = hoveredCity ? deltaFor(hoveredCity.name) : null;
  const hoveredConv = hoveredCity ? conversion.get(hoveredCity.name) ?? null : null;
  const tooltipHasBreakdown = hoveredInterests > 0;
  const hoveredPos = hoveredCity ? project(hoveredCity.lat, hoveredCity.lon) : null;
  const tooltipHeight =
    36 +
    (tooltipHasBreakdown ? 28 : 0) +
    (hoveredDelta ? 16 : 0) +
    (hoveredConv && (hoveredConv.previews > 0 || hoveredConv.signups > 0) ? 16 : 0);

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
          ) : effectiveColorMode === "conversion" ? (
            <>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block rounded-full" style={{ width: 12, height: 12, background: conversionColor(0), opacity: 0.85 }} />
                0%
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block rounded-full" style={{ width: 12, height: 12, background: conversionColor(0.5), opacity: 0.85 }} />
                {formatPct(scaleMaxPct / 2)}%
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block rounded-full" style={{ width: 12, height: 12, background: conversionColor(1), opacity: 0.85 }} />
                {formatPct(scaleMaxPct)}%
                {conversionScale.mode === "auto"
                  ? observedMaxRate > 0
                    ? " (máx. observado)"
                    : " (sem dados)"
                  : " (meta)"}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block rounded-full" style={{ width: 12, height: 12, background: "#B0B5C3", opacity: 0.6 }} />
                sem previews
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
          {interestsMap.size > 0 && (
            <span
              className="inline-flex items-center gap-1"
              title="Cidades com pessoas que cadastraram interesse em /demanda"
            >
              <span
                className="inline-block rounded-full"
                style={{
                  width: 14,
                  height: 14,
                  background: "transparent",
                  border: "2px dashed #95EB1D",
                }}
              />
              interesse cadastrado
            </span>
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
        <button
          type="button"
          onClick={handleExportComparisonCsv}
          disabled={!canExportComparison}
          data-testid="export-city-comparison-csv"
          className={`text-[11px] font-semibold rounded-md px-2.5 py-1 border transition-colors ${
            canExportComparison
              ? "border-[#0040FF] text-[#0040FF] hover:bg-[#0040FF] hover:text-white"
              : "border-[#E0E3EB] text-[#C5C9D3] cursor-not-allowed"
          }`}
          title={
            canExportComparison
              ? "Baixar comparativo de cidades (atual vs. anterior) em CSV"
              : !hasComparison
                ? "Selecione um período com janela anterior comparável (ex.: 7, 30 ou 90 dias)"
                : "Sem dados para exportar no período selecionado"
          }
        >
          Exportar CSV
        </button>
        <div className="inline-flex rounded-lg border border-[#E0E3EB] bg-white p-0.5" role="group" aria-label="Cor das bolhas">
          {(["volume", "growth", "conversion"] as ColorMode[]).map((mode) => {
            const active = effectiveColorMode === mode;
            const disabled = mode === "growth" && !hasComparison;
            const label =
              mode === "volume"
                ? "Cor por volume"
                : mode === "growth"
                  ? "Cor por crescimento"
                  : "Cor por conversão";
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
                {label}
              </button>
            );
          })}
        </div>
        {effectiveColorMode === "conversion" && (
          <div
            className="inline-flex items-center gap-2 rounded-lg border border-[#E0E3EB] bg-white px-2 py-1"
            data-testid="conversion-scale-controls"
          >
            <span className="text-[10px] font-semibold text-[#7A7F8C] uppercase tracking-wide">
              Escala
            </span>
            <div className="inline-flex rounded-md border border-[#E0E3EB] p-0.5" role="group" aria-label="Escala da conversão">
              {(["auto", "target"] as const).map((m) => {
                const active = conversionScale.mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      if (m === "auto") {
                        setConversionScale({ mode: "auto" });
                      } else {
                        const n = Number(targetInput);
                        const target =
                          Number.isFinite(n) && n > 0 && n <= 100 ? n : DEFAULT_TARGET_PCT;
                        setTargetInput(String(target));
                        setConversionScale({ mode: "target", targetPct: target });
                      }
                    }}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-colors ${
                      active
                        ? "bg-[#0040FF] text-white"
                        : "text-[#7A7F8C] hover:text-[#0D0D0D]"
                    }`}
                    aria-pressed={active}
                    data-testid={`conversion-scale-${m}`}
                  >
                    {m === "auto" ? "Auto" : "Meta"}
                  </button>
                );
              })}
            </div>
            <label className="inline-flex items-center gap-1 text-[11px] text-[#2A2D38]">
              <input
                type="number"
                min={0.1}
                max={100}
                step={0.5}
                value={targetInput}
                disabled={conversionScale.mode !== "target"}
                onChange={(e) => {
                  setTargetInput(e.target.value);
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n > 0 && n <= 100) {
                    setConversionScale({ mode: "target", targetPct: n });
                  }
                }}
                onBlur={() => {
                  const n = Number(targetInput);
                  if (!Number.isFinite(n) || n <= 0 || n > 100) {
                    setTargetInput(String(DEFAULT_TARGET_PCT));
                    if (conversionScale.mode === "target") {
                      setConversionScale({ mode: "target", targetPct: DEFAULT_TARGET_PCT });
                    }
                  }
                }}
                className={`w-14 border border-[#E0E3EB] rounded px-1.5 py-0.5 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30 ${
                  conversionScale.mode !== "target" ? "bg-[#F5F7FA] text-[#B0B5C3]" : "bg-white"
                }`}
                aria-label="Meta de conversão (%)"
                data-testid="conversion-scale-target-input"
              />
              <span className="text-[#7A7F8C]">%</span>
            </label>
            <span className="text-[10px] text-[#7A7F8C]">
              {conversionScale.mode === "auto"
                ? `máx. observado: ${formatPct(observedMaxRate * 100)}%`
                : "verde = meta atingida"}
            </span>
          </div>
        )}
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
            } else if (effectiveColorMode === "conversion") {
              const conv = conversion.get(city.name);
              if (!conv || conv.previews <= 0) {
                fill = "#B0B5C3";
                opacity = 0.4;
              } else {
                const rate = conv.signups / conv.previews;
                const normalized = scaleMaxRate > 0 ? rate / scaleMaxRate : 0;
                fill = conversionColor(normalized);
                opacity = 0.85;
              }
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
            const isSelected = selectedCity === city.name;
            const interestsCount = interestsMap.get(city.name) ?? 0;
            const hasInterests = interestsCount > 0;
            return (
              <g
                key={city.name}
                onMouseEnter={() => setHovered(city.name)}
                onMouseLeave={() => setHovered((cur) => (cur === city.name ? null : cur))}
                onClick={
                  onSelectCity
                    ? () => onSelectCity(isSelected ? null : city.name)
                    : undefined
                }
                style={{ cursor: onSelectCity ? "pointer" : "default" }}
              >
                {isSelected && (
                  <circle
                    cx={x}
                    cy={y}
                    r={r + 6}
                    fill="none"
                    stroke="#FFD600"
                    strokeWidth={3}
                  />
                )}
                {hasInterests && (
                  <circle
                    cx={x}
                    cy={y}
                    r={r + 3}
                    fill="none"
                    stroke="#95EB1D"
                    strokeWidth={2.5}
                    strokeDasharray="3 2"
                  />
                )}
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
                {hasInterests && (
                  <g pointerEvents="none">
                    <circle
                      cx={x + r * 0.75}
                      cy={y - r * 0.75}
                      r={9}
                      fill="#95EB1D"
                      stroke="#0A1995"
                      strokeWidth={1}
                    />
                    <text
                      x={x + r * 0.75}
                      y={y - r * 0.75 + 3}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="800"
                      fill="#0A1995"
                    >
                      {interestsCount > 99 ? "99+" : interestsCount}
                    </text>
                  </g>
                )}
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
                {hoveredTotal} {hoveredTotal === 1 ? "registro" : "registros"} no total
              </text>
              {tooltipHasBreakdown && (
                <>
                  <text
                    x={Math.min(VIEW_W - 200, Math.max(8, hoveredPos.x + 14)) + 10}
                    y={Math.max(8, hoveredPos.y - tooltipHeight - 4) + 44}
                    fill="#A8B0C0"
                    fontSize="10"
                  >
                    • {hoveredClicks} {hoveredClicks === 1 ? "clique" : "cliques"}
                  </text>
                  <text
                    x={Math.min(VIEW_W - 200, Math.max(8, hoveredPos.x + 14)) + 10}
                    y={Math.max(8, hoveredPos.y - tooltipHeight - 4) + 58}
                    fill="#95EB1D"
                    fontSize="10"
                    fontWeight="600"
                  >
                    • {hoveredInterests} {hoveredInterests === 1 ? "interesse cadastrado" : "interesses cadastrados"}
                  </text>
                </>
              )}
              {hoveredDelta && (
                <text
                  x={Math.min(VIEW_W - 200, Math.max(8, hoveredPos.x + 14)) + 10}
                  y={Math.max(8, hoveredPos.y - tooltipHeight - 4) + 45 + (tooltipHasBreakdown ? 28 : 0)}
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
                  y={Math.max(8, hoveredPos.y - tooltipHeight - 4) + (hoveredDelta ? 60 : 45) + (tooltipHasBreakdown ? 28 : 0)}
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
      {isAdminMode && selectedCity && adminKey && baseUrl && (
        <CityTrendPanel
          baseUrl={baseUrl}
          adminKey={adminKey}
          city={selectedCity}
          range={range}
          customFrom={customFrom}
          customTo={customTo}
          onClose={() => onSelectCity?.(null)}
        />
      )}
      {extraEntries.length > 0 && (
        <div
          className="mt-3 rounded-lg border border-[#FFD600]/50 bg-[#FFFBE6] px-3 py-2"
          data-testid="extra-cities-callout"
        >
          <p className="text-[11px] font-bold text-[#7A5C00] mb-1">
            Novas regiões cadastradas pelos visitantes
          </p>
          <div className="flex flex-wrap gap-1.5">
            {extraEntries.map((e) => (
              <span
                key={e.name}
                className="inline-flex items-center gap-1 rounded-full bg-white border border-[#E8D778] px-2 py-0.5 text-[11px] font-semibold text-[#5C4500]"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#FFD600]" />
                {e.name}
                <span className="text-[10px] font-bold text-[#7A5C00]">· {e.total}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      <TopCitiesList
        entries={[
          ...CITY_COORDS.map((c) => ({ name: c.name, total: clickMap.get(c.name) ?? 0 })),
          ...extraEntries,
        ]}
        totalClicks={totalClicks}
        deltas={
          hasComparison
            ? new Map(CITY_COORDS.map((c) => [c.name, deltaFor(c.name)]))
            : null
        }
        conversion={isAdminMode ? conversion : null}
        selectedCity={selectedCity}
        onSelectCity={onSelectCity}
        exportRangeLabel={exportRangeLabel}
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
  selectedCity,
  onSelectCity,
  exportRangeLabel,
}: {
  entries: CityClickEntry[];
  totalClicks: number;
  deltas: Map<string, DeltaInfo | null> | null;
  conversion: Map<string, CityConversion> | null;
  selectedCity?: string | null;
  onSelectCity?: (city: string | null) => void;
  exportRangeLabel?: string | null;
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

  const canExport = exportRangeLabel != null && sorted.some((e) => e.total > 0);

  function handleExportCsv() {
    if (!canExport) return;
    const escape = (val: string) => {
      if (/[",\n;]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
      return val;
    };
    const header = ["Cidade", "Cliques", "Participação (%)"];
    const rows = sorted
      .filter((e) => e.total > 0)
      .map((e) => {
        const share = totalClicks > 0 ? (e.total / totalClicks) * 100 : 0;
        return [escape(e.name), String(e.total), share.toFixed(1)].join(",");
      });
    const csv = "\uFEFF" + [header.map(escape).join(","), ...rows].join("\n") + "\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `top-cidades_${exportRangeLabel}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="mt-4 border-t border-[#E0E3EB] pt-3">
      <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
        <h4 className="font-bold text-xs text-[#0D0D0D]">Top cidades</h4>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#7A7F8C]">
            {totalClicks > 0 ? `${totalClicks} cliques no total` : "Sem cliques no período"}
          </span>
          {exportRangeLabel != null && (
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={!canExport}
              data-testid="export-top-cities-csv"
              className={`text-[10px] font-semibold rounded-md px-2 py-1 border transition-colors ${
                canExport
                  ? "border-[#0040FF] text-[#0040FF] hover:bg-[#0040FF] hover:text-white"
                  : "border-[#E0E3EB] text-[#C5C9D3] cursor-not-allowed"
              }`}
              title={canExport ? "Baixar ranking de cidades em CSV" : "Sem cliques para exportar"}
            >
              Exportar CSV
            </button>
          )}
        </div>
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
          const isSelected = selectedCity === entry.name;
          const rowClass = `flex items-center gap-2 text-xs w-full text-left rounded-md ${
            isZero && !d ? "opacity-40" : ""
          } ${
            onSelectCity
              ? `cursor-pointer transition-colors px-1 -mx-1 ${
                  isSelected
                    ? "bg-[#FFF8D6] ring-1 ring-[#FFD600]"
                    : "hover:bg-[#F5F7FA]"
                }`
              : ""
          }`;
          const inner = (
            <>
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
            </>
          );
          return (
            <li key={entry.name}>
              {onSelectCity ? (
                <button
                  type="button"
                  onClick={() => onSelectCity(isSelected ? null : entry.name)}
                  className={rowClass}
                  aria-pressed={isSelected}
                  aria-label={`Filtrar dashboard por ${entry.name}`}
                >
                  {inner}
                </button>
              ) : (
                <div className={rowClass}>{inner}</div>
              )}
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

type TrendRow = {
  bucket: string;
  planSpeed: string;
  planPrice: string;
  source: string;
  total: number;
};

type TrendPoint = {
  bucket: string;
  label: string;
  total: number;
  previous: number | null;
  bySource: Record<string, number>;
};

type TrendBuckets = {
  totals: Map<string, number>;
  bySource: Map<string, Map<string, number>>;
  sourceTotals: Map<string, number>;
};

async function fetchTrendBuckets(
  baseUrl: string,
  adminKey: string,
  city: string,
  win: Window,
  bucket: "hour" | "day",
): Promise<TrendBuckets> {
  const params = new URLSearchParams();
  if (win.since) params.set("since", win.since);
  if (win.until) params.set("until", win.until);
  params.set("planSpeed", "city");
  params.set("planPrice", city);
  params.set("bucket", bucket);
  const res = await fetch(`${baseUrl}/api/clicks/timeseries?${params.toString()}`, {
    headers: { "X-Admin-Key": adminKey },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = (await res.json()) as TrendRow[];
  const totals = new Map<string, number>();
  const bySource = new Map<string, Map<string, number>>();
  const sourceTotals = new Map<string, number>();
  for (const row of rows) {
    const src = row.source || "unknown";
    totals.set(row.bucket, (totals.get(row.bucket) ?? 0) + row.total);
    let perBucket = bySource.get(row.bucket);
    if (!perBucket) {
      perBucket = new Map();
      bySource.set(row.bucket, perBucket);
    }
    perBucket.set(src, (perBucket.get(src) ?? 0) + row.total);
    sourceTotals.set(src, (sourceTotals.get(src) ?? 0) + row.total);
  }
  return { totals, bySource, sourceTotals };
}

function CityTrendPanel({
  baseUrl,
  adminKey,
  city,
  range,
  customFrom,
  customTo,
  onClose,
}: {
  baseUrl: string;
  adminKey: string;
  city: string;
  range: RangeId;
  customFrom: string;
  customTo: string;
  onClose: () => void;
}) {
  const [points, setPoints] = useState<TrendPoint[] | null>(null);
  const [currentTotal, setCurrentTotal] = useState(0);
  const [previousTotal, setPreviousTotal] = useState<number | null>(null);
  const [sourceTotals, setSourceTotals] = useState<Map<string, number>>(new Map());
  const [prevError, setPrevError] = useState(false);
  const [showComparison, setShowComparison] = useState(true);
  const [viewMode, setViewMode] = useState<"total" | "source">("total");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqRef = useRef(0);

  const useHour = range === "today";

  useEffect(() => {
    const win = rangeToWindow(range, customFrom, customTo);
    if (win === null) {
      setPoints(null);
      setLoading(false);
      setError("Selecione um intervalo válido.");
      return;
    }
    const myReq = ++reqRef.current;
    setLoading(true);
    setError(null);
    setPrevError(false);

    const bucket: "hour" | "day" = useHour ? "hour" : "day";
    const prevWin = previousWindow(win);

    const currentPromise = fetchTrendBuckets(baseUrl, adminKey, city, win, bucket);
    const prevPromise = prevWin
      ? fetchTrendBuckets(baseUrl, adminKey, city, prevWin, bucket).then(
          (b) => ({ ok: true as const, buckets: b as TrendBuckets | null }),
          () => ({ ok: false as const, buckets: null }),
        )
      : Promise.resolve({ ok: true as const, buckets: null as TrendBuckets | null });

    Promise.all([currentPromise, prevPromise])
      .then(([currentBuckets, prevResult]) => {
        if (myReq !== reqRef.current) return;

        const currentMap = currentBuckets.totals;
        const currentBySource = currentBuckets.bySource;
        let prevMap: Map<string, number> | null = null;
        if (prevResult.ok && prevResult.buckets) {
          prevMap = prevResult.buckets.totals;
        } else if (!prevResult.ok) {
          setPrevError(true);
        }

        const bucketMs = bucket === "hour" ? 3_600_000 : 86_400_000;
        const normalize = (key: string) => new Date(key).toISOString();
        const currentByIso = new Map<string, number>();
        for (const [k, v] of currentMap) {
          currentByIso.set(normalize(k), (currentByIso.get(normalize(k)) ?? 0) + v);
        }
        const currentSourceByIso = new Map<string, Record<string, number>>();
        for (const [k, perSource] of currentBySource) {
          const iso = normalize(k);
          const existing = currentSourceByIso.get(iso) ?? {};
          for (const [src, count] of perSource) {
            existing[src] = (existing[src] ?? 0) + count;
          }
          currentSourceByIso.set(iso, existing);
        }
        const prevByIso = prevMap ? new Map<string, number>() : null;
        if (prevMap && prevByIso) {
          for (const [k, v] of prevMap) {
            prevByIso.set(normalize(k), (prevByIso.get(normalize(k)) ?? 0) + v);
          }
        }

        // Canonical zero-filled timeline aligned to UTC bucket boundaries,
        // so sparse buckets (days/hours with no clicks) still appear and
        // line up with the equivalent slot in the previous window.
        const buildTimeline = (since: string, until: string): number[] => {
          const sinceMs = new Date(since).getTime();
          const untilMs = new Date(until).getTime();
          if (
            !Number.isFinite(sinceMs) ||
            !Number.isFinite(untilMs) ||
            untilMs <= sinceMs
          ) {
            return [];
          }
          const start = Math.floor(sinceMs / bucketMs) * bucketMs;
          const out: number[] = [];
          for (let t = start; t < untilMs; t += bucketMs) out.push(t);
          return out;
        };

        // For bounded windows we walk a canonical timeline so sparse
        // buckets still appear. For unbounded windows (e.g. "Tudo"), no
        // previous period exists, so fall back to the returned bucket
        // keys directly to preserve the original chart behavior.
        const currentTimeline =
          win.since && win.until
            ? buildTimeline(win.since, win.until)
            : Array.from(currentByIso.keys())
                .map((iso) => new Date(iso).getTime())
                .filter((t) => Number.isFinite(t))
                .sort((a, b) => a - b);
        const prevTimeline =
          prevWin && prevWin.since && prevWin.until
            ? buildTimeline(prevWin.since, prevWin.until)
            : [];

        const length = Math.max(currentTimeline.length, prevTimeline.length);
        const result: TrendPoint[] = [];
        for (let i = 0; i < length; i++) {
          const curT = currentTimeline[i];
          const prevT = prevTimeline[i];
          const refT = curT ?? prevT;
          if (refT == null) continue;
          const date = new Date(refT);
          const label = useHour
            ? date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
            : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
          const total =
            curT != null ? currentByIso.get(new Date(curT).toISOString()) ?? 0 : 0;
          const bySource =
            curT != null
              ? currentSourceByIso.get(new Date(curT).toISOString()) ?? {}
              : {};
          let previous: number | null;
          if (prevByIso) {
            previous =
              prevT != null ? prevByIso.get(new Date(prevT).toISOString()) ?? 0 : 0;
          } else {
            previous = null;
          }
          result.push({
            bucket: new Date(refT).toISOString(),
            label,
            total,
            previous,
            bySource,
          });
        }

        setPoints(result);
        setCurrentTotal(Array.from(currentMap.values()).reduce((s, v) => s + v, 0));
        setPreviousTotal(
          prevMap ? Array.from(prevMap.values()).reduce((s, v) => s + v, 0) : null,
        );
        setSourceTotals(currentBuckets.sourceTotals);
      })
      .catch(() => {
        if (myReq !== reqRef.current) return;
        setError("Não foi possível carregar a tendência.");
      })
      .finally(() => {
        if (myReq !== reqRef.current) return;
        setLoading(false);
      });
  }, [baseUrl, adminKey, city, range, customFrom, customTo, useHour]);

  const total = currentTotal;
  const hasComparison = previousTotal !== null;
  const deltaAbs = hasComparison ? total - (previousTotal ?? 0) : 0;
  const deltaPct =
    hasComparison && (previousTotal ?? 0) > 0
      ? (deltaAbs / (previousTotal ?? 1)) * 100
      : null;
  let badgeBg = "#EEF1F7";
  let badgeFg = "#2A2D38";
  let badgeArrow = "•";
  if (hasComparison) {
    if (deltaAbs > 0) {
      badgeBg = "#E6F8EC";
      badgeFg = "#0A7B2C";
      badgeArrow = "▲";
    } else if (deltaAbs < 0) {
      badgeBg = "#FCE9E9";
      badgeFg = "#A11A1A";
      badgeArrow = "▼";
    }
  }
  let badgeLabel = "";
  if (hasComparison) {
    if (total === 0 && previousTotal === 0) {
      badgeLabel = "Sem cliques nos dois períodos";
    } else if (deltaPct === null) {
      badgeLabel = `${badgeArrow} ${deltaAbs > 0 ? "+" : ""}${deltaAbs} (novo)`;
    } else {
      badgeLabel = `${badgeArrow} ${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(0)}% vs. anterior`;
    }
  }

  const sortedSources = useMemo(
    () =>
      Array.from(sourceTotals.entries())
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([source, value]) => ({ source, value, color: colorForSource(source) })),
    [sourceTotals],
  );

  const sourceChartData = useMemo(() => {
    if (!points) return [];
    return points.map((p) => {
      const row: Record<string, string | number> = { label: p.label, bucket: p.bucket };
      for (const { source } of sortedSources) {
        row[source] = p.bySource[source] ?? 0;
      }
      return row;
    });
  }, [points, sortedSources]);

  const effectiveViewMode: "total" | "source" =
    viewMode === "source" && sortedSources.length === 0 ? "total" : viewMode;

  const { topGain, topLoss } = useMemo(() => {
    if (!points || !hasComparison) {
      return {
        topGain: null as { point: TrendPoint; delta: number } | null,
        topLoss: null as { point: TrendPoint; delta: number } | null,
      };
    }
    let gain: { point: TrendPoint; delta: number } | null = null;
    let loss: { point: TrendPoint; delta: number } | null = null;
    for (const p of points) {
      if (p.previous == null) continue;
      const d = p.total - p.previous;
      if (d > 0 && (!gain || d > gain.delta)) gain = { point: p, delta: d };
      if (d < 0 && (!loss || d < loss.delta)) loss = { point: p, delta: d };
    }
    return { topGain: gain, topLoss: loss };
  }, [points, hasComparison]);

  const showExtremes =
    effectiveViewMode === "total" && hasComparison && showComparison;

  const renderTotalDot = (dotProps: {
    cx?: number;
    cy?: number;
    payload?: TrendPoint;
  }) => {
    const { cx, cy, payload } = dotProps;
    if (cx == null || cy == null || !payload) return <g />;
    let fill = "#0040FF";
    let r = 3;
    let stroke = "none";
    let strokeWidth = 0;
    if (showExtremes && topGain && payload.bucket === topGain.point.bucket) {
      fill = "#0A7B2C";
      r = 6;
      stroke = "#FFFFFF";
      strokeWidth = 2;
    } else if (
      showExtremes &&
      topLoss &&
      payload.bucket === topLoss.point.bucket
    ) {
      fill = "#A11A1A";
      r = 6;
      stroke = "#FFFFFF";
      strokeWidth = 2;
    }
    return (
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  };

  const formatExtremeDelta = (d: number) =>
    `${d > 0 ? "+" : ""}${d} ${Math.abs(d) === 1 ? "clique" : "cliques"}`;

  return (
    <div
      className="mt-4 rounded-lg border border-[#FFD600] bg-[#FFFBE6] p-3"
      data-testid="city-trend-panel"
    >
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div>
          <h4 className="font-bold text-sm text-[#0D0D0D]">
            Tendência de cliques · {city}
          </h4>
          <p className="text-[11px] text-[#7A5C00]">
            {useHour ? "Por hora" : "Por dia"} no período selecionado
            {points && !loading && (
              <span className="ml-2 text-[#5C4500]">
                · {total} {total === 1 ? "clique" : "cliques"}
              </span>
            )}
            {hasComparison && !loading && (
              <span className="ml-2 text-[#5C4500]">
                · anterior: {previousTotal}
              </span>
            )}
            {loading && <span className="ml-2 text-[#0040FF]">Carregando...</span>}
            {error && <span className="ml-2 text-red-600">{error}</span>}
            {!error && prevError && (
              <span className="ml-2 text-amber-700">
                Comparação com período anterior indisponível.
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasComparison && !loading && (
            <span
              data-testid="city-trend-delta-badge"
              className="text-[11px] font-semibold rounded-full px-2 py-0.5"
              style={{ background: badgeBg, color: badgeFg }}
              title={`Atual: ${total} · Anterior: ${previousTotal}`}
            >
              {badgeLabel}
            </span>
          )}
          <div
            className="inline-flex rounded-md border border-[#E0CC78] bg-white p-0.5"
            role="group"
            aria-label="Visão da tendência"
            data-testid="city-trend-view-toggle"
          >
            {(["total", "source"] as const).map((mode) => {
              const active = effectiveViewMode === mode;
              const disabled = mode === "source" && sortedSources.length === 0;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  disabled={disabled}
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-colors ${
                    active
                      ? "bg-[#0040FF] text-white"
                      : "text-[#5C4500] hover:text-[#0D0D0D] disabled:text-[#B0B5C3] disabled:cursor-not-allowed"
                  }`}
                  aria-pressed={active}
                  data-testid={`city-trend-view-${mode}`}
                  title={
                    disabled
                      ? "Sem dados por origem no período"
                      : mode === "total"
                        ? "Mostrar total"
                        : "Mostrar por origem"
                  }
                >
                  {mode === "total" ? "Total" : "Por origem"}
                </button>
              );
            })}
          </div>
          {hasComparison && effectiveViewMode === "total" && (
            <label className="inline-flex items-center gap-1 text-[11px] text-[#5C4500] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showComparison}
                onChange={(e) => setShowComparison(e.target.checked)}
                className="accent-[#0040FF]"
                data-testid="city-trend-compare-toggle"
              />
              Comparar com período anterior
            </label>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] font-semibold rounded-md px-2 py-1 border border-[#0D0D0D]/20 text-[#2A2D38] hover:bg-white"
            aria-label="Fechar tendência"
          >
            Fechar ✕
          </button>
        </div>
      </div>
      <div className="bg-white rounded-md border border-[#E0E3EB] p-2" style={{ height: 220 }}>
        {!loading && !error && points && points.length === 0 && (
          <div className="flex items-center justify-center h-full text-xs text-[#7A7F8C]">
            Sem cliques nesta cidade no período.
          </div>
        )}
        {points && points.length > 0 && effectiveViewMode === "total" && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E3EB" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#7A7F8C" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#7A7F8C" }} width={28} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 6 }}
                formatter={(v: number, name: string) => [
                  v,
                  name === "previous" ? "Período anterior" : "Cliques",
                ]}
                labelStyle={{ fontWeight: 600 }}
              />
              {hasComparison && showComparison && (
                <Line
                  type="monotone"
                  dataKey="previous"
                  stroke="#7A7F8C"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  strokeOpacity={0.55}
                  dot={false}
                  activeDot={{ r: 4, fill: "#7A7F8C" }}
                  isAnimationActive={false}
                />
              )}
              <Line
                type="monotone"
                dataKey="total"
                stroke="#0040FF"
                strokeWidth={2}
                dot={renderTotalDot}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
        {points && points.length > 0 && effectiveViewMode === "source" && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sourceChartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E3EB" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#7A7F8C" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#7A7F8C" }} width={28} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 6 }}
                labelStyle={{ fontWeight: 600 }}
              />
              {sortedSources.map(({ source, color }) => (
                <Line
                  key={source}
                  type="monotone"
                  dataKey={source}
                  stroke={color}
                  strokeWidth={2}
                  dot={{ r: 2, fill: color }}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      {showExtremes && points && points.length > 0 && (topGain || topLoss) && (
        <p
          className="mt-2 text-[11px] text-[#5C4500]"
          data-testid="city-trend-extremes-caption"
        >
          {topGain && (
            <span data-testid="city-trend-extreme-gain">
              <span
                className="inline-block rounded-full mr-1 align-middle"
                style={{
                  width: 8,
                  height: 8,
                  background: "#0A7B2C",
                }}
              />
              Maior alta: <strong>{topGain.point.label}</strong>{" "}
              ({formatExtremeDelta(topGain.delta)} vs. anterior)
            </span>
          )}
          {topGain && topLoss && <span className="mx-2">·</span>}
          {topLoss && (
            <span data-testid="city-trend-extreme-loss">
              <span
                className="inline-block rounded-full mr-1 align-middle"
                style={{
                  width: 8,
                  height: 8,
                  background: "#A11A1A",
                }}
              />
              Maior queda: <strong>{topLoss.point.label}</strong>{" "}
              ({formatExtremeDelta(topLoss.delta)} vs. anterior)
            </span>
          )}
        </p>
      )}
      {effectiveViewMode === "source" && sortedSources.length > 0 && (
        <div
          className="mt-2 flex flex-wrap gap-x-3 gap-y-1"
          data-testid="city-trend-source-legend"
        >
          {sortedSources.map(({ source, value, color }) => (
            <span
              key={source}
              className="inline-flex items-center gap-1 text-[11px] text-[#5C4500]"
            >
              <span
                className="inline-block rounded-sm"
                style={{ width: 10, height: 10, background: color }}
              />
              <span className="font-semibold text-[#0D0D0D]">{source}</span>
              <span className="text-[#7A5C00]">· {value}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
