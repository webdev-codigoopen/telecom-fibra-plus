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
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { colorForSource } from "../lib/sourceColors";
import { adminFetch } from "../lib/adminFetch";

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
      periodOverride?: { since?: string; until?: string };
    }
  | {
      clicks: CityClickEntry[];
      adminKey?: undefined;
      baseUrl?: undefined;
      selectedCity?: undefined;
      onSelectCity?: undefined;
      periodOverride?: undefined;
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
  const res = await fetch(url, { headers: { Authorization: `Bearer ${adminKey}` } });
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
  const res = await fetch(url, { headers: { Authorization: `Bearer ${adminKey}` } });
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
const BELOW_TARGET_MIN_PREVIEWS = 5;

type PerCityTargets = Record<string, number>;

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

function sanitizeTargets(input: unknown): PerCityTargets {
  if (!input || typeof input !== "object") return {};
  const out: PerCityTargets = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const n = Number(v);
    if (typeof k === "string" && k && Number.isFinite(n) && n > 0 && n <= 100) {
      out[k] = n;
    }
  }
  return out;
}

async function fetchPerCityTargets(
  baseUrl: string,
  adminKey: string | undefined,
): Promise<PerCityTargets> {
  const res = await adminFetch(`${baseUrl}/api/admin/map-per-city-targets`, {
    headers: adminKey ? { Authorization: `Bearer ${adminKey}` } : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { targets?: unknown };
  return sanitizeTargets(data.targets);
}

async function persistPerCityTargets(
  baseUrl: string,
  adminKey: string | undefined,
  targets: PerCityTargets,
): Promise<PerCityTargets> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (adminKey) headers.Authorization = `Bearer ${adminKey}`;
  const res = await adminFetch(`${baseUrl}/api/admin/map-per-city-targets`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ targets }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { targets?: unknown };
  return sanitizeTargets(data.targets);
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
  const periodOverride = props.periodOverride;
  const hasPeriodOverride = periodOverride !== undefined;
  const overrideSince = periodOverride?.since;
  const overrideUntil = periodOverride?.until;
  const resolveWindow = (r: RangeId, cf: string, ct: string): Window | null => {
    if (hasPeriodOverride) {
      return {
        ...(overrideSince ? { since: overrideSince } : {}),
        ...(overrideUntil ? { until: overrideUntil } : {}),
      };
    }
    return rangeToWindow(r, cf, ct);
  };

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
  const [perCityTargets, setPerCityTargets] = useState<PerCityTargets>({});
  const [perCityTargetsError, setPerCityTargetsError] = useState<string | null>(null);
  const [showPerCityEditor, setShowPerCityEditor] = useState(false);
  const [perCityDrafts, setPerCityDrafts] = useState<Record<string, string>>({});
  const reqIdRef = useRef(0);
  const targetsReqIdRef = useRef(0);
  const targetsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetsSaveSeqRef = useRef(0);
  const targetsHydratedRef = useRef(false);

  useEffect(() => {
    // Reload preferences when the admin identity changes (e.g. different
    // admin signs in within the same browser).
    const next = loadConversionScale(adminKey);
    setConversionScale(next);
    setTargetInput(next.mode === "target" ? String(next.targetPct) : String(DEFAULT_TARGET_PCT));
    setPerCityDrafts({});
  }, [adminKey]);

  useEffect(() => {
    saveConversionScale(adminKey, conversionScale);
  }, [adminKey, conversionScale]);

  // Load per-city targets from the server. These are shared across all
  // admins, so changes made on one device show up everywhere.
  useEffect(() => {
    if (!isAdminMode || !baseUrl) return;
    const myReq = ++targetsReqIdRef.current;
    targetsHydratedRef.current = false;
    setPerCityTargetsError(null);
    fetchPerCityTargets(baseUrl, adminKey)
      .then((targets) => {
        if (myReq !== targetsReqIdRef.current) return;
        setPerCityTargets(targets);
        targetsHydratedRef.current = true;
      })
      .catch(() => {
        if (myReq !== targetsReqIdRef.current) return;
        setPerCityTargetsError("Não foi possível carregar as metas por cidade.");
        targetsHydratedRef.current = true;
      });
  }, [isAdminMode, baseUrl, adminKey]);

  // Persist per-city targets to the server (debounced, optimistic).
  // We only save after the initial load has hydrated state, so the empty
  // initial value doesn't overwrite real saved data.
  useEffect(() => {
    if (!isAdminMode || !baseUrl) return;
    if (!targetsHydratedRef.current) return;
    if (targetsSaveTimerRef.current) clearTimeout(targetsSaveTimerRef.current);
    const snapshot = perCityTargets;
    targetsSaveTimerRef.current = setTimeout(() => {
      const seq = ++targetsSaveSeqRef.current;
      persistPerCityTargets(baseUrl, adminKey, snapshot)
        .then(() => {
          if (seq !== targetsSaveSeqRef.current) return;
          setPerCityTargetsError(null);
        })
        .catch(() => {
          if (seq !== targetsSaveSeqRef.current) return;
          setPerCityTargetsError(
            "Falha ao salvar as metas por cidade. Tente novamente.",
          );
        });
    }, 400);
    return () => {
      if (targetsSaveTimerRef.current) {
        clearTimeout(targetsSaveTimerRef.current);
        targetsSaveTimerRef.current = null;
      }
    };
  }, [isAdminMode, baseUrl, perCityTargets]);

  function targetPctForCity(name: string): number | null {
    const override = perCityTargets[name];
    if (Number.isFinite(override) && override > 0 && override <= 100) return override;
    if (conversionScale.mode === "target") return conversionScale.targetPct;
    return null;
  }

  useEffect(() => {
    if (!isAdminMode || !adminKey || !baseUrl) return;
    const win = resolveWindow(range, customFrom, customTo);
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
  }, [isAdminMode, range, customFrom, customTo, adminKey, baseUrl, hasPeriodOverride, overrideSince, overrideUntil]);

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

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const [mapProjector, setMapProjector] = useState<
    ((lat: number, lon: number) => { x: number; y: number }) | null
  >(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    const lonPad = (lonMax - lonMin) * 0.18;
    const latPad = (latMax - latMin) * 0.18;
    const bounds = L.latLngBounds(
      [latMin - latPad, lonMin - lonPad],
      [latMax + latPad, lonMax + lonPad],
    );
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      fadeAnimation: false,
      zoomAnimation: false,
      inertia: false,
    });
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
      {
        maxZoom: 19,
        subdomains: "abcd",
        attribution: "© OpenStreetMap, © CARTO",
        crossOrigin: true,
      },
    ).addTo(map);
    map.fitBounds(bounds, { padding: [12, 12], animate: false });
    leafletMapRef.current = map;

    const updateProjector = () => {
      const size = map.getSize();
      if (size.x === 0 || size.y === 0) return;
      setMapProjector(() => (lat: number, lon: number) => {
        const pt = map.latLngToContainerPoint([lat, lon]);
        return {
          x: (pt.x / size.x) * VIEW_W,
          y: (pt.y / size.y) * VIEW_H,
        };
      });
    };
    updateProjector();
    map.on("resize", () => {
      map.fitBounds(bounds, { padding: [12, 12], animate: false });
      updateProjector();
    });

    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });
    ro.observe(mapContainerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      leafletMapRef.current = null;
      setMapProjector(null);
    };
  }, [lonMin, lonMax, latMin, latMax]);

  function project(lat: number, lon: number) {
    if (mapProjector) return mapProjector(lat, lon);
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

  type BelowTargetRow = {
    name: string;
    previews: number;
    signups: number;
    ratePct: number;
    targetPct: number;
    gapPct: number;
    isPerCityTarget: boolean;
  };

  const belowTargetRows = useMemo<BelowTargetRow[]>(() => {
    const rows: BelowTargetRow[] = [];
    for (const [name, conv] of conversion.entries()) {
      if (conv.previews < BELOW_TARGET_MIN_PREVIEWS) continue;
      const targetPct = targetPctForCity(name);
      if (targetPct == null) continue;
      const ratePct = (conv.signups / conv.previews) * 100;
      if (ratePct >= targetPct) continue;
      rows.push({
        name,
        previews: conv.previews,
        signups: conv.signups,
        ratePct,
        targetPct,
        gapPct: targetPct - ratePct,
        isPerCityTarget: perCityTargets[name] != null,
      });
    }
    rows.sort((a, b) => {
      if (b.gapPct !== a.gapPct) return b.gapPct - a.gapPct;
      return a.name.localeCompare(b.name, "pt-BR");
    });
    return rows;
    // targetPctForCity reads from conversionScale and perCityTargets, both in deps below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversion, conversionScale, perCityTargets]);

  const hasAnyTarget = useMemo(() => {
    if (conversionScale.mode === "target") return true;
    return Object.keys(perCityTargets).length > 0;
  }, [conversionScale, perCityTargets]);

  const hasAnyEligibleCity = useMemo(() => {
    for (const conv of conversion.values()) {
      if (conv.previews >= BELOW_TARGET_MIN_PREVIEWS) return true;
    }
    return false;
  }, [conversion]);

  const exportRangeLabel = useMemo(() => {
    if (!isAdminMode) return null;
    const win = resolveWindow(range, customFrom, customTo);
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
  }, [isAdminMode, range, customFrom, customTo, hasPeriodOverride, overrideSince, overrideUntil]);

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
      {isAdminMode && !hasPeriodOverride && (
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
            <button
              type="button"
              onClick={() => {
                setShowPerCityEditor((s) => !s);
                if (!showPerCityEditor) {
                  const drafts: Record<string, string> = {};
                  for (const [k, v] of Object.entries(perCityTargets)) drafts[k] = String(v);
                  setPerCityDrafts(drafts);
                }
              }}
              className="text-[11px] font-semibold rounded px-2 py-0.5 border border-[#0040FF] text-[#0040FF] hover:bg-[#0040FF] hover:text-white transition-colors"
              data-testid="toggle-per-city-targets"
              aria-expanded={showPerCityEditor}
            >
              Metas por cidade
              {Object.keys(perCityTargets).length > 0 && (
                <span className="ml-1 inline-block rounded-full bg-[#0040FF] text-white px-1.5 text-[10px]">
                  {Object.keys(perCityTargets).length}
                </span>
              )}
            </button>
          </div>
        )}
      </div>
      )}
      {isAdminMode && effectiveColorMode === "conversion" && showPerCityEditor && (
        <div
          className="mb-3 rounded-lg border border-[#E0E3EB] bg-[#F5F7FA] p-3"
          data-testid="per-city-targets-editor"
        >
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div>
              <h4 className="font-bold text-xs text-[#0D0D0D]">Metas por cidade</h4>
              <p className="text-[11px] text-[#7A7F8C]">
                Defina uma meta de conversão (%) para cada cidade. Cidades sem meta usam a escala global ({conversionScale.mode === "target" ? `meta ${formatPct(conversionScale.targetPct)}%` : "Auto"}).
              </p>
              <p className="text-[10px] text-[#7A7F8C] mt-0.5">
                As metas são compartilhadas entre todos os administradores e dispositivos.
              </p>
              {perCityTargetsError && (
                <p
                  className="text-[10px] text-[#C92020] mt-1"
                  data-testid="per-city-targets-error"
                >
                  {perCityTargetsError}
                </p>
              )}
            </div>
            {Object.keys(perCityTargets).length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setPerCityTargets({});
                  setPerCityDrafts({});
                }}
                className="text-[11px] font-semibold text-[#7A7F8C] hover:text-[#C92020] underline"
                data-testid="clear-per-city-targets"
              >
                Limpar todas
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
            {(() => {
              const names = new Set<string>(CITY_COORDS.map((c) => c.name));
              for (const name of Object.keys(perCityTargets)) names.add(name);
              for (const c of conversion.keys()) names.add(c);
              const list = Array.from(names).sort((a, b) => a.localeCompare(b, "pt-BR"));
              return list.map((name) => {
                const draft = perCityDrafts[name] ?? (perCityTargets[name] != null ? String(perCityTargets[name]) : "");
                const conv = conversion.get(name);
                const rate = conv && conv.previews > 0 ? (conv.signups / conv.previews) * 100 : null;
                const hasOverride = perCityTargets[name] != null;
                return (
                  <div
                    key={name}
                    className={`flex items-center gap-2 bg-white border rounded px-2 py-1 ${hasOverride ? "border-[#0040FF]" : "border-[#E0E3EB]"}`}
                  >
                    <span className="flex-1 min-w-0 text-[11px] font-semibold text-[#2A2D38] truncate" title={name}>
                      {name}
                    </span>
                    {rate !== null && (
                      <span className="text-[10px] text-[#7A7F8C] tabular-nums shrink-0" title="Taxa atual">
                        {rate.toFixed(0)}%
                      </span>
                    )}
                    <input
                      type="number"
                      min={0.1}
                      max={100}
                      step={0.5}
                      value={draft}
                      placeholder="—"
                      onChange={(e) => {
                        const v = e.target.value;
                        setPerCityDrafts((d) => ({ ...d, [name]: v }));
                        if (v === "") {
                          setPerCityTargets((t) => {
                            if (!(name in t)) return t;
                            const next = { ...t };
                            delete next[name];
                            return next;
                          });
                          return;
                        }
                        const n = Number(v);
                        if (Number.isFinite(n) && n > 0 && n <= 100) {
                          setPerCityTargets((t) => ({ ...t, [name]: n }));
                        }
                      }}
                      onBlur={() => {
                        const v = perCityDrafts[name] ?? "";
                        if (v === "") return;
                        const n = Number(v);
                        if (!Number.isFinite(n) || n <= 0 || n > 100) {
                          setPerCityDrafts((d) => {
                            const next = { ...d };
                            if (perCityTargets[name] != null) {
                              next[name] = String(perCityTargets[name]);
                            } else {
                              delete next[name];
                            }
                            return next;
                          });
                        }
                      }}
                      className="w-14 border border-[#E0E3EB] rounded px-1.5 py-0.5 text-right tabular-nums text-[11px] focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
                      aria-label={`Meta de conversão para ${name}`}
                      data-testid={`per-city-target-input-${name}`}
                    />
                    <span className="text-[10px] text-[#7A7F8C]">%</span>
                    {hasOverride && (
                      <button
                        type="button"
                        onClick={() => {
                          setPerCityTargets((t) => {
                            const next = { ...t };
                            delete next[name];
                            return next;
                          });
                          setPerCityDrafts((d) => {
                            const next = { ...d };
                            delete next[name];
                            return next;
                          });
                        }}
                        className="text-[#7A7F8C] hover:text-[#C92020] text-[14px] leading-none px-1"
                        aria-label={`Remover meta de ${name}`}
                        title="Remover meta desta cidade"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}
      <div
        className="relative w-full overflow-hidden rounded-lg"
        style={{ background: "#F5F7FA", aspectRatio: `${VIEW_W} / ${VIEW_H}` }}
      >
        <div
          ref={mapContainerRef}
          className="absolute inset-0"
          style={{
            zIndex: 0,
            opacity: 0.6,
          }}
          aria-hidden
        />
        <div
          className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-semibold text-[#2A2D38]"
          style={{ zIndex: 2, background: "rgba(255,255,255,0.75)" }}
          aria-hidden
        >
          © OpenStreetMap, © CARTO
        </div>
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="absolute inset-0 w-full h-full"
          role="img"
          aria-label="Mapa de cliques por cidade no Oeste da Bahia"
          style={{ zIndex: 1 }}
        >
          <defs>
            <filter id="bubbleShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0.5" stdDeviation="0.8" floodOpacity="0.45" />
            </filter>
          </defs>
          <text
            x={PAD}
            y={28}
            fill="#0D0D0D"
            fontSize="11"
            fontWeight="700"
            stroke="#fff"
            strokeWidth="3"
            paintOrder="stroke"
          >
            Oeste da Bahia
          </text>
          <text
            x={VIEW_W - PAD}
            y={VIEW_H - 16}
            fill="#0D0D0D"
            fontSize="10"
            textAnchor="end"
            stroke="#fff"
            strokeWidth="3"
            paintOrder="stroke"
          >
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
                const cityTargetPct = targetPctForCity(city.name);
                const denom =
                  cityTargetPct != null
                    ? Math.max(0.0001, Math.min(1, cityTargetPct / 100))
                    : scaleMaxRate;
                const normalized = denom > 0 ? rate / denom : 0;
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
                <circle
                  cx={x}
                  cy={y}
                  r={r}
                  fill={fill}
                  opacity={opacity}
                  stroke="#fff"
                  strokeWidth={1.25}
                  filter="url(#bubbleShadow)"
                />
                <circle cx={x} cy={y} r={3} fill="#0D0D0D" stroke="#fff" strokeWidth={0.6} />
                <text
                  x={x}
                  y={y - r - 6}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill="#0D0D0D"
                  stroke="#fff"
                  strokeWidth={3}
                  paintOrder="stroke"
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
                    const cityTargetPct = hoveredCity ? targetPctForCity(hoveredCity.name) : null;
                    const targetSuffix =
                      cityTargetPct != null
                        ? ` · meta ${formatPct(cityTargetPct)}%${
                            hoveredCity && perCityTargets[hoveredCity.name] != null
                              ? " (cidade)"
                              : ""
                          }`
                        : " · meta auto";
                    return `Preview ${previews} → Assina ${signups}${pct !== null ? ` (${pct}%)` : ""}${targetSuffix}`;
                  })()}
                </text>
              )}
            </g>
          )}
        </svg>
      </div>
      {effectiveColorMode === "conversion" && (
        <div
          className="mt-3 rounded-lg border border-[#E0E3EB] bg-white px-3 py-2"
          data-testid="below-target-panel"
        >
          <div className="flex items-baseline justify-between gap-2 mb-2 flex-wrap">
            <h4 className="font-bold text-xs text-[#0D0D0D]">
              Abaixo da meta
              <span className="ml-1 font-normal text-[10px] text-[#7A7F8C]">
                (taxa de conversão &lt; meta · mín. {BELOW_TARGET_MIN_PREVIEWS} previews)
              </span>
            </h4>
            {belowTargetRows.length > 0 && (
              <span className="text-[10px] text-[#7A7F8C] tabular-nums">
                {belowTargetRows.length}{" "}
                {belowTargetRows.length === 1 ? "cidade" : "cidades"}
              </span>
            )}
          </div>
          {belowTargetRows.length === 0 ? (
            <p className="text-[11px] text-[#7A7F8C] italic">
              {!hasAnyTarget
                ? "Defina uma meta de conversão para ver as cidades que estão abaixo dela."
                : !hasAnyEligibleCity
                  ? `Nenhuma cidade tem ao menos ${BELOW_TARGET_MIN_PREVIEWS} previews neste período.`
                  : "Todas as cidades elegíveis estão atingindo a meta."}
            </p>
          ) : (
            <ol className="flex flex-col gap-1.5">
              {belowTargetRows.map((r, idx) => (
                <li
                  key={r.name}
                  className="flex items-center gap-2 text-xs"
                  data-testid="below-target-row"
                >
                  <span className="w-5 text-right font-semibold text-[#7A7F8C] tabular-nums">
                    {idx + 1}.
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold text-[#2A2D38]">
                        {r.name}
                      </span>
                      <span className="tabular-nums text-[#7A7F8C] text-[11px] shrink-0 flex items-center gap-2">
                        <span>
                          {r.previews} prev · {r.signups} assin
                        </span>
                        <span className="font-semibold text-[#C92020]">
                          {formatPct(r.ratePct)}%
                        </span>
                        <span className="text-[#7A7F8C]">
                          / meta {formatPct(r.targetPct)}%
                          {r.isPerCityTarget ? " (cidade)" : ""}
                        </span>
                        <span className="font-semibold text-[#C92020]">
                          ▼ {formatPct(r.gapPct)} pp
                        </span>
                      </span>
                    </span>
                    <span className="block mt-1 h-1.5 rounded-full bg-[#F0F2F7] overflow-hidden">
                      <span
                        className="block h-full rounded-full bg-[#E03131]"
                        style={{
                          width: `${Math.min(100, Math.max(0, r.targetPct > 0 ? (r.ratePct / r.targetPct) * 100 : 0))}%`,
                        }}
                      />
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
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
        targetPctForCity={isAdminMode ? targetPctForCity : null}
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
  targetPctForCity,
  selectedCity,
  onSelectCity,
  exportRangeLabel,
}: {
  entries: CityClickEntry[];
  totalClicks: number;
  deltas: Map<string, DeltaInfo | null> | null;
  conversion: Map<string, CityConversion> | null;
  targetPctForCity: ((name: string) => number | null) | null;
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
      .map(([name, c]) => {
        const rate = c.previews > 0 ? (c.signups / c.previews) * 100 : null;
        const targetPct = targetPctForCity ? targetPctForCity(name) : null;
        let status: "below" | "above" | "ineligible" | "no-target" = "no-target";
        if (targetPct == null) status = "no-target";
        else if (rate === null || c.previews < BELOW_TARGET_MIN_PREVIEWS) status = "ineligible";
        else if (rate < targetPct) status = "below";
        else status = "above";
        return {
          name,
          previews: c.previews,
          signups: c.signups,
          rate,
          targetPct,
          status,
        };
      })
      .filter((r) => r.previews > 0 || r.signups > 0)
      .sort((a, b) => {
        if (b.previews !== a.previews) return b.previews - a.previews;
        return a.name.localeCompare(b.name, "pt-BR");
      });
  }, [conversion, targetPctForCity]);

  const totalPreviews = conversionRows.reduce((s, r) => s + r.previews, 0);
  const totalSignups = conversionRows.reduce((s, r) => s + r.signups, 0);
  const overallRate = totalPreviews > 0 ? (totalSignups / totalPreviews) * 100 : null;
  const belowCount = conversionRows.filter((r) => r.status === "below").length;
  const eligibleCount = conversionRows.filter(
    (r) => r.status === "below" || r.status === "above",
  ).length;
  const showTargetSummary = targetPctForCity != null && eligibleCount > 0;

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
          {showTargetSummary && (
            <div
              className={`mb-2 text-[11px] rounded-md px-2 py-1.5 border ${
                belowCount > 0
                  ? "bg-[#FFF1F1] border-[#F5C2C2] text-[#7A1F1F]"
                  : "bg-[#EDFAF1] border-[#BFE6CB] text-[#1F5A33]"
              }`}
              data-testid="below-target-summary"
            >
              {belowCount > 0 ? (
                <>
                  <span className="font-semibold">{belowCount}</span>
                  {" "}
                  {belowCount === 1
                    ? "cidade está abaixo da meta"
                    : "cidades estão abaixo da meta"}
                  {" "}
                  <span className="text-[#7A7F8C]">
                    (de {eligibleCount} com dados suficientes)
                  </span>
                </>
              ) : (
                <>Todas as {eligibleCount} cidades com dados suficientes estão na meta ou acima.</>
              )}
            </div>
          )}
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
                const isBelow = r.status === "below";
                const isAbove = r.status === "above";
                const rowBg = isBelow
                  ? "bg-[#FFF6F6] ring-1 ring-[#F5C2C2] px-1.5 -mx-1.5 py-0.5 rounded-md"
                  : "";
                let badge: React.ReactNode = null;
                if (isBelow && r.targetPct != null && rate !== null) {
                  const gap = r.targetPct - rate;
                  badge = (
                    <span
                      className="inline-flex items-center gap-0.5 text-[10px] font-semibold rounded px-1.5 py-0.5 bg-[#FDE2E2] text-[#C92020]"
                      title={`Meta: ${r.targetPct.toFixed(0)}% — faltam ${gap.toFixed(1)} pontos`}
                      data-testid="below-target-badge"
                    >
                      ▼ abaixo da meta
                    </span>
                  );
                } else if (isAbove && r.targetPct != null) {
                  badge = (
                    <span
                      className="inline-flex items-center gap-0.5 text-[10px] font-semibold rounded px-1.5 py-0.5 bg-[#E2F5E9] text-[#00863A]"
                      title={`Meta: ${r.targetPct.toFixed(0)}%`}
                      data-testid="above-target-badge"
                    >
                      ▲ acima da meta
                    </span>
                  );
                }
                return (
                  <li
                    key={r.name}
                    className={`flex items-center gap-2 text-xs ${rowBg}`}
                  >
                    <span className="w-5 text-right font-semibold text-[#7A7F8C] tabular-nums">
                      {idx + 1}.
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold text-[#2A2D38] flex items-center gap-1.5 min-w-0">
                          <span className="truncate">{r.name}</span>
                          {badge}
                        </span>
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
    headers: { Authorization: `Bearer ${adminKey}` },
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
  const [prevSourceTotals, setPrevSourceTotals] = useState<Map<string, number> | null>(null);
  const [prevError, setPrevError] = useState(false);
  const [showComparison, setShowComparison] = useState(true);
  const [viewMode, setViewMode] = useState<"total" | "source">("total");
  const [hiddenSources, setHiddenSources] = useState<Set<string>>(new Set());
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
        let prevSourceMap: Map<string, number> | null = null;
        if (prevResult.ok && prevResult.buckets) {
          prevMap = prevResult.buckets.totals;
          prevSourceMap = prevResult.buckets.sourceTotals;
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
        setPrevSourceTotals(prevSourceMap);
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
        .map(([source, value]) => {
          const prev = prevSourceTotals ? prevSourceTotals.get(source) ?? 0 : null;
          let delta: { abs: number; pct: number | null } | null = null;
          if (prev !== null) {
            const abs = value - prev;
            const pct = prev === 0 ? null : (abs / prev) * 100;
            delta = { abs, pct };
          }
          return { source, value, color: colorForSource(source), prev, delta };
        }),
    [sourceTotals, prevSourceTotals],
  );

  useEffect(() => {
    setHiddenSources((prev) => {
      if (prev.size === 0) return prev;
      const valid = new Set(sortedSources.map((s) => s.source));
      let changed = false;
      const next = new Set<string>();
      for (const src of prev) {
        if (valid.has(src)) next.add(src);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [sortedSources]);

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

  const visibleSources = useMemo(
    () => sortedSources.filter(({ source }) => !hiddenSources.has(source)),
    [sortedSources, hiddenSources],
  );

  const sourceSpike = useMemo(() => {
    if (effectiveViewMode !== "source" || visibleSources.length === 0) return null;
    if (!points || points.length === 0) return null;
    let best: { bucket: string; label: string; source: string; value: number; color: string } | null = null;
    for (const p of points) {
      for (const { source, color } of visibleSources) {
        const v = p.bySource[source] ?? 0;
        if (v <= 0) continue;
        if (!best || v > best.value) {
          best = { bucket: p.bucket, label: p.label, source, value: v, color };
        }
      }
    }
    return best;
  }, [effectiveViewMode, visibleSources, points]);

  const renderSourceDot = (source: string, color: string) => (dotProps: {
    cx?: number;
    cy?: number;
    payload?: { bucket?: string };
  }) => {
    const { cx, cy, payload } = dotProps;
    if (cx == null || cy == null || !payload) return <g />;
    const isSpike =
      sourceSpike != null &&
      sourceSpike.source === source &&
      payload.bucket === sourceSpike.bucket;
    if (isSpike) {
      return (
        <circle
          cx={cx}
          cy={cy}
          r={6}
          fill={color}
          stroke="#FFFFFF"
          strokeWidth={2}
        />
      );
    }
    return <circle cx={cx} cy={cy} r={2} fill={color} />;
  };

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

  const slugifyCity = (name: string) =>
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const periodForFilename = () => {
    if (range === "custom") {
      return customFrom && customTo ? `${customFrom}_${customTo}` : "personalizado";
    }
    if (range === "today") return "hoje";
    if (range === "all") return "tudo";
    return range;
  };

  const handleExportTrendCsv = () => {
    if (!points || points.length === 0) return;
    const escape = (v: string) => {
      let s = v;
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const header = ["bucket", "label", "current_total", "previous_total"];
    const rows = points.map((p) => [
      escape(p.bucket),
      escape(p.label),
      String(p.total),
      hasComparison && p.previous !== null ? String(p.previous) : "",
    ]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\r\n") + "\r\n";

    const filename = `tendencia_${slugifyCity(city)}_${periodForFilename()}.csv`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const handleExportSourcesCsv = () => {
    const escape = (v: string) => {
      let s = v;
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const header = ["source", "current_total", "previous_total", "change_abs", "change_pct"];
    const rows = sortedSources.map(({ source, value, prev, delta }) => {
      const prevStr = prev === null ? "" : String(prev);
      const absStr = delta ? String(delta.abs) : "";
      let pctStr = "";
      if (delta) {
        if (delta.pct === null) pctStr = "";
        else pctStr = delta.pct.toFixed(2);
      }
      return [escape(source), String(value), prevStr, absStr, pctStr];
    });
    const csv = [header, ...rows].map((r) => r.join(",")).join("\r\n") + "\r\n";

    const filename = `tendencia-origens_${slugifyCity(city)}_${periodForFilename()}.csv`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

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
          {effectiveViewMode === "source" && sortedSources.length > 0 && (
            <button
              type="button"
              onClick={handleExportSourcesCsv}
              className="text-[11px] font-semibold rounded-md px-2 py-1 border border-[#0D0D0D]/20 text-[#2A2D38] hover:bg-white"
              data-testid="city-trend-source-export-csv"
              title="Baixar CSV com totais por origem"
            >
              Exportar CSV
            </button>
          )}
          {effectiveViewMode === "total" && points && points.length > 0 && (
            <button
              type="button"
              onClick={handleExportTrendCsv}
              className="text-[11px] font-semibold rounded-md px-2 py-1 border border-[#0D0D0D]/20 text-[#2A2D38] hover:bg-white"
              data-testid="city-trend-total-export-csv"
              title="Baixar CSV com a série temporal"
            >
              Exportar CSV
            </button>
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
              {visibleSources.map(({ source, color }) => (
                <Line
                  key={source}
                  type="monotone"
                  dataKey={source}
                  stroke={color}
                  strokeWidth={2}
                  dot={renderSourceDot(source, color)}
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
      {effectiveViewMode === "source" && sourceSpike && (
        <p
          className="mt-2 text-[11px] text-[#5C4500]"
          data-testid="city-trend-source-spike-caption"
        >
          <span
            className="inline-block rounded-full mr-1 align-middle"
            style={{ width: 8, height: 8, background: sourceSpike.color }}
          />
          Pico: <strong>{sourceSpike.label}</strong> · {sourceSpike.source} ({sourceSpike.value}{" "}
          {sourceSpike.value === 1 ? "clique" : "cliques"})
        </p>
      )}
      {effectiveViewMode === "source" && sortedSources.length > 0 && (
        <div
          className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1"
          data-testid="city-trend-source-legend"
        >
          {sortedSources.map(({ source, value, color, delta }) => {
            const hidden = hiddenSources.has(source);
            const isSoloed =
              !hidden && hiddenSources.size === sortedSources.length - 1;
            const handleClick = () => {
              setHiddenSources((prev) => {
                if (isSoloed) {
                  return new Set();
                }
                if (hidden) {
                  const next = new Set(prev);
                  next.delete(source);
                  return next;
                }
                const next = new Set<string>();
                for (const { source: s } of sortedSources) {
                  if (s !== source) next.add(s);
                }
                return next;
              });
            };
            let title: string;
            if (isSoloed) {
              title = "Mostrar todas as origens";
            } else if (hidden) {
              title = `Mostrar ${source}`;
            } else {
              title = `Isolar ${source} (clique de novo para mostrar todas)`;
            }
            return (
              <button
                key={source}
                type="button"
                onClick={handleClick}
                className={`inline-flex items-center gap-1 text-[11px] rounded px-1 -mx-1 transition-opacity hover:bg-white ${
                  hidden ? "opacity-40" : "opacity-100"
                }`}
                aria-pressed={!hidden}
                title={title}
                data-testid={`city-trend-source-legend-item-${source}`}
              >
                <span
                  className="inline-block rounded-sm"
                  style={{ width: 10, height: 10, background: color }}
                />
                <span
                  className={`font-semibold ${hidden ? "text-[#7A7F8C] line-through" : "text-[#0D0D0D]"}`}
                >
                  {source}
                </span>
                <span className="text-[#7A5C00]">· {value}</span>
                {delta && (() => {
                  if (value === 0 && (delta.abs === 0)) return null;
                  let arrow = "•";
                  let cls = "text-[#7A7F8C]";
                  if (delta.abs > 0) {
                    arrow = "▲";
                    cls = "text-[#0A7B2C]";
                  } else if (delta.abs < 0) {
                    arrow = "▼";
                    cls = "text-[#A11A1A]";
                  }
                  const absStr = `${delta.abs > 0 ? "+" : ""}${delta.abs}`;
                  const pctStr =
                    delta.pct === null
                      ? "novo"
                      : `${delta.pct > 0 ? "+" : ""}${delta.pct.toFixed(0)}%`;
                  return (
                    <span
                      className={`ml-1 ${cls}`}
                      title={`Atual: ${value} · Anterior: ${value - delta.abs}`}
                      data-testid={`city-trend-source-legend-delta-${source}`}
                    >
                      {arrow} {absStr} ({pctStr})
                    </span>
                  );
                })()}
              </button>
            );
          })}
          {hiddenSources.size > 0 && (
            <button
              type="button"
              onClick={() => setHiddenSources(new Set())}
              className="text-[11px] font-semibold rounded-md px-2 py-0.5 border border-[#0D0D0D]/20 text-[#2A2D38] hover:bg-white"
              data-testid="city-trend-source-reset"
            >
              Mostrar todas
            </button>
          )}
        </div>
      )}
    </div>
  );
}
