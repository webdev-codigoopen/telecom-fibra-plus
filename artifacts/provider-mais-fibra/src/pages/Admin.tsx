import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { type ApiPlan } from "../hooks/usePlans";
import ImageCropper from "../components/ImageCropper";
import PlanCard from "../components/PlanCard";
import MobilePlansPreview from "../components/MobilePlansPreview";
import { type Plan } from "../lib/plans";
import CityClicksMap from "../components/CityClicksMap";
import { colorForSource } from "../lib/sourceColors";
import {
  type StreamingBrand,
  refreshStreamingBrands,
} from "../hooks/useStreamingBrands";
import {
  type AppSettings,
  DEFAULT_SETTINGS,
  refreshAppSettings,
} from "../hooks/useAppSettings";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

function apiPlanToPlan(p: ApiPlan): Plan {
  return {
    id: p.id,
    speed: p.speed,
    wifi: p.wifi,
    price: p.price,
    inclusions: p.inclusions,
    streamingBrands: p.streamingBrands ?? [],
    featured: p.featured,
    badge: p.badge ?? undefined,
    bonus: p.bonus ?? undefined,
    imageUrl: p.imageUrl ?? undefined,
  };
}

const PLAN_IMAGE_ASPECT = 16 / 9;
const PLAN_IMAGE_MAX_WIDTH = 1200;

type ClickStat = {
  planSpeed: string;
  planPrice: string;
  source: string;
  total: number;
  lastClickedAt: string;
};

type SourceStat = {
  source: string;
  total: number;
};

type TimeseriesRow = {
  bucket: string;
  planSpeed: string;
  planPrice: string;
  source: string;
  total: number;
};

type ChartPoint = {
  bucket: string;
  label: string;
  total: number;
  byPlan: { planSpeed: string; planPrice: string; total: number }[];
  bySource: Record<string, number>;
};

const STORAGE_KEY = "pmf_admin_key";
const FILTERS_STORAGE_KEY = "pmf_admin_stats_filters";
const UI_STORAGE_KEY = "pmf_admin_ui_state";

type ChartView = "total" | "source";
type PreviewMode = "desktop" | "tablet" | "mobile";

type StoredUiState = {
  chartView: ChartView;
  previewOpen: boolean;
  previewMode: PreviewMode;
};

function loadStoredUiState(): StoredUiState {
  const fallback: StoredUiState = {
    chartView: "total",
    previewOpen: true,
    previewMode: "desktop",
  };
  try {
    const raw = localStorage.getItem(UI_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<StoredUiState>;
    return {
      chartView: parsed.chartView === "source" || parsed.chartView === "total" ? parsed.chartView : fallback.chartView,
      previewOpen: typeof parsed.previewOpen === "boolean" ? parsed.previewOpen : fallback.previewOpen,
      previewMode:
        parsed.previewMode === "desktop" || parsed.previewMode === "tablet" || parsed.previewMode === "mobile"
          ? parsed.previewMode
          : fallback.previewMode,
    };
  } catch {
    return fallback;
  }
}

type StatsRange = "today" | "week" | "all" | "custom";

type StoredFilters = {
  range: StatsRange;
  source: string;
  customFrom: string;
  customTo: string;
  city: string | null;
};

function loadStoredFilters(): StoredFilters {
  const fallback: StoredFilters = { range: "all", source: "", customFrom: "", customTo: "", city: null };
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<StoredFilters>;
    const range: StatsRange =
      parsed.range === "today" || parsed.range === "week" || parsed.range === "all" || parsed.range === "custom"
        ? parsed.range
        : "all";
    return {
      range,
      source: typeof parsed.source === "string" ? parsed.source : "",
      customFrom: typeof parsed.customFrom === "string" ? parsed.customFrom : "",
      customTo: typeof parsed.customTo === "string" ? parsed.customTo : "",
      city: typeof parsed.city === "string" && parsed.city.length > 0 ? parsed.city : null,
    };
  } catch {
    return fallback;
  }
}

const BASE_INCLUSIONS = [
  "Instalação Grátis",
  "Roteador Wi-Fi",
  "Roteador Wi-Fi 6",
  "100 Canais",
];

function emptyPlan(): Omit<ApiPlan, "id"> {
  return {
    speed: "",
    wifi: "",
    price: "",
    inclusions: [],
    streamingBrands: [],
    featured: false,
    badge: null,
    bonus: null,
    sortOrder: 0,
    imageUrl: null,
    shareHeadline: null,
    shareSubcopy: null,
    shareCtaText: null,
    whatsappNumber: null,
  };
}

export default function Admin() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem(STORAGE_KEY) ?? "");
  const [keyInput, setKeyInput] = useState("");
  const [authed, setAuthed] = useState(false);
  const [plans, setPlans] = useState<ApiPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<ApiPlan | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [clickStats, setClickStats] = useState<ClickStat[]>([]);
  const [previousStats, setPreviousStats] = useState<ClickStat[]>([]);
  const [clickStatsLoading, setClickStatsLoading] = useState(false);
  const [statsRange, setStatsRange] = useState<StatsRange>(() => loadStoredFilters().range);
  const [customFrom, setCustomFrom] = useState<string>(() => loadStoredFilters().customFrom);
  const [customTo, setCustomTo] = useState<string>(() => loadStoredFilters().customTo);
  const [sourceStats, setSourceStats] = useState<SourceStat[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string>(() => loadStoredFilters().source);
  const [cityFilter, setCityFilter] = useState<string | null>(() => loadStoredFilters().city);
  const [timeseries, setTimeseries] = useState<TimeseriesRow[]>([]);
  const [chartView, setChartView] = useState<ChartView>(() => loadStoredUiState().chartView);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);
  const [previewOpen, setPreviewOpen] = useState<boolean>(() => loadStoredUiState().previewOpen);
  const [previewMode, setPreviewMode] = useState<PreviewMode>(() => loadStoredUiState().previewMode);
  const [streamingBrands, setStreamingBrands] = useState<StreamingBrand[]>([]);
  const [activeTab, setActiveTab] = useState<"planos" | "ctas" | "interesses" | "emails">("planos");
  const [appSettings, setAppSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [previewHealth, setPreviewHealth] = useState<{
    humanPreviews24h: number;
    botPreviews24h: number;
    lastHumanPreviewAt: string | null;
    lastBotFetchAt: string | null;
  } | null>(null);
  const [previewHealthDismissed, setPreviewHealthDismissed] = useState(false);

  const baseUrl = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  const fetchAppSettingsAdmin = useCallback(async () => {
    try {
      const res = await fetch(`${baseUrl}/api/settings/admin`, {
        headers: { "X-Admin-Key": adminKey },
      });
      if (!res.ok) return;
      const data = (await res.json()) as Partial<AppSettings>;
      const merged: AppSettings = { ...DEFAULT_SETTINGS, ...data };
      setAppSettingsState(merged);
      await refreshAppSettings();
    } catch {
      /* ignore */
    }
  }, [baseUrl, adminKey]);

  const fetchStreamingBrands = useCallback(async () => {
    try {
      const res = await fetch(`${baseUrl}/api/streaming-brands`);
      if (!res.ok) return;
      const data: StreamingBrand[] = await res.json();
      setStreamingBrands(data);
      await refreshStreamingBrands();
    } catch {
      // ignore
    }
  }, [baseUrl]);

  const allInclusions = useMemo(
    () => [...BASE_INCLUSIONS, ...streamingBrands.map((b) => b.name)],
    [streamingBrands],
  );

  const chartData: ChartPoint[] = useMemo(() => {
    if (timeseries.length === 0) return [];
    const map = new Map<string, ChartPoint>();
    const useHour = statsRange === "today";
    for (const row of timeseries) {
      const date = new Date(row.bucket);
      const label = useHour
        ? date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      let entry = map.get(row.bucket);
      if (!entry) {
        entry = {
          bucket: row.bucket,
          label,
          total: 0,
          byPlan: [],
          bySource: {},
        };
        map.set(row.bucket, entry);
      }
      entry.total += row.total;
      const existingPlan = entry.byPlan.find(
        (p) => p.planSpeed === row.planSpeed && p.planPrice === row.planPrice,
      );
      if (existingPlan) {
        existingPlan.total += row.total;
      } else {
        entry.byPlan.push({ planSpeed: row.planSpeed, planPrice: row.planPrice, total: row.total });
      }
      entry.bySource[row.source] = (entry.bySource[row.source] ?? 0) + row.total;
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.bucket).getTime() - new Date(b.bucket).getTime(),
    );
  }, [timeseries, statsRange]);

  const chartSources = useMemo(() => {
    const totals = new Map<string, number>();
    for (const point of chartData) {
      for (const [src, count] of Object.entries(point.bySource)) {
        totals.set(src, (totals.get(src) ?? 0) + count);
      }
    }
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([source]) => ({ source, color: colorForSource(source) }));
  }, [chartData]);

  const crawlerPreviews = useMemo(() => {
    let bots = 0;
    let humans = 0;
    for (const s of clickStats) {
      if (s.planSpeed === "city") continue;
      if (s.source.startsWith("whatsapp-share-bot")) {
        bots += s.total;
      } else if (s.source === "whatsapp-share" || s.source.startsWith("whatsapp-share:")) {
        humans += s.total;
      }
    }
    return { bots, humans };
  }, [clickStats]);

  const conversionByPlan = useMemo(() => {
    const byPlan = new Map<
      string,
      { planSpeed: string; planPrice: string; previews: number; signups: number }
    >();
    for (const s of clickStats) {
      if (s.planSpeed === "city") continue;
      const key = `${s.planSpeed}|${s.planPrice}`;
      let entry = byPlan.get(key);
      if (!entry) {
        entry = { planSpeed: s.planSpeed, planPrice: s.planPrice, previews: 0, signups: 0 };
        byPlan.set(key, entry);
      }
      if (s.source.startsWith("whatsapp-share-bot")) continue;
      if (s.source === "whatsapp-share" || s.source.startsWith("whatsapp-share:")) {
        entry.previews += s.total;
      } else {
        entry.signups += s.total;
      }
    }
    return Array.from(byPlan.values())
      .filter((e) => e.previews > 0 || e.signups > 0)
      .sort((a, b) => {
        if (b.previews !== a.previews) return b.previews - a.previews;
        return b.signups - a.signups;
      });
  }, [clickStats]);

  const conversionBySource = useMemo(() => {
    const bySource = new Map<
      string,
      { source: string; previews: number; signups: number }
    >();
    const ensure = (src: string) => {
      let entry = bySource.get(src);
      if (!entry) {
        entry = { source: src, previews: 0, signups: 0 };
        bySource.set(src, entry);
      }
      return entry;
    };
    for (const s of clickStats) {
      if (s.planSpeed === "city") continue;
      if (s.source.startsWith("whatsapp-share-bot")) continue;
      if (s.source === "whatsapp-share") {
        ensure("(sem origem)").previews += s.total;
      } else if (s.source.startsWith("whatsapp-share:")) {
        const entrySource = s.source.slice("whatsapp-share:".length) || "(sem origem)";
        ensure(entrySource).previews += s.total;
      } else {
        ensure(s.source).signups += s.total;
      }
    }
    return Array.from(bySource.values())
      .filter((e) => e.previews > 0 || e.signups > 0)
      .sort((a, b) => {
        if (b.previews !== a.previews) return b.previews - a.previews;
        return b.signups - a.signups;
      });
  }, [clickStats]);

  const WEAKEST_SOURCE_MIN_PREVIEWS = 10;
  const weakestSource = useMemo(() => {
    const eligible = conversionBySource.filter(
      (c) => c.previews >= WEAKEST_SOURCE_MIN_PREVIEWS,
    );
    if (eligible.length === 0) return null;
    let worst = eligible[0]!;
    let worstRate = worst.signups / worst.previews;
    for (const c of eligible) {
      const rate = c.signups / c.previews;
      if (rate < worstRate) {
        worst = c;
        worstRate = rate;
      }
    }
    return { ...worst, rate: worstRate * 100 };
  }, [conversionBySource]);

  const sourceLabels: Record<string, string> = {
    "home-hero": "Home — Hero",
    "hero": "Home — Hero",
    "home-sticky": "Home — Botão flutuante",
    "admin-preview": "Admin (preview)",
    "onde-estamos-sticky": "Onde Estamos — Botão flutuante",
    "contato-sticky": "Contato — Botão flutuante",
    "quem-somos-sticky": "Quem Somos — Botão flutuante",
    "demanda-cidades-sticky": "Demanda Cidades — Botão flutuante",
    "(sem origem)": "Sem origem",
  };
  function formatSourceLabel(src: string): string {
    if (sourceLabels[src]) return sourceLabels[src]!;
    if (src.startsWith("city:")) return `Cidade — ${src.slice(5)}`;
    if (src.startsWith("city-sticky:")) return `Cidade ${src.slice(12)} — Botão flutuante`;
    if (src.startsWith("city-cta-hero:")) return `Cidade ${src.slice(14)} — CTA Hero`;
    return src;
  }

  const stackedChartData = useMemo(() => {
    if (chartView !== "source") return [];
    return chartData.map((point) => {
      const row: Record<string, string | number> = {
        bucket: point.bucket,
        label: point.label,
        total: point.total,
      };
      for (const { source } of chartSources) {
        row[source] = point.bySource[source] ?? 0;
      }
      return row;
    });
  }, [chartData, chartSources, chartView]);

  const fetchClickStats = useCallback(async (
    key: string,
    range: "today" | "week" | "all" | "custom" = "all",
    source: string = "",
    customFromStr: string = "",
    customToStr: string = "",
    city: string | null = null,
  ) => {
    setClickStatsLoading(true);
    try {
      const params = new URLSearchParams();
      const prevParams = new URLSearchParams();
      let hasPrevious = false;
      if (range === "custom") {
        if (!customFromStr || !customToStr) {
          setClickStatsLoading(false);
          return;
        }
        const since = new Date(`${customFromStr}T00:00:00`);
        const until = new Date(`${customToStr}T00:00:00`);
        until.setDate(until.getDate() + 1);
        if (Number.isNaN(since.getTime()) || Number.isNaN(until.getTime()) || until <= since) {
          setClickStatsLoading(false);
          return;
        }
        params.set("since", since.toISOString());
        params.set("until", until.toISOString());
        const spanMs = until.getTime() - since.getTime();
        const prevSince = new Date(since.getTime() - spanMs);
        prevParams.set("since", prevSince.toISOString());
        prevParams.set("until", since.toISOString());
        hasPrevious = true;
      } else if (range !== "all") {
        const now = new Date();
        const since = new Date(now);
        const prevSince = new Date(now);
        const prevUntil = new Date(now);
        if (range === "today") {
          since.setHours(0, 0, 0, 0);
          prevUntil.setHours(0, 0, 0, 0);
          prevSince.setHours(0, 0, 0, 0);
          prevSince.setDate(prevSince.getDate() - 1);
        } else {
          since.setDate(since.getDate() - 7);
          prevUntil.setDate(prevUntil.getDate() - 7);
          prevSince.setDate(prevSince.getDate() - 14);
        }
        params.set("since", since.toISOString());
        prevParams.set("since", prevSince.toISOString());
        prevParams.set("until", prevUntil.toISOString());
        hasPrevious = true;
      }
      if (source) {
        params.set("source", source);
        prevParams.set("source", source);
      }
      if (city) {
        params.set("city", city);
        prevParams.set("city", city);
      }
      const qs = params.toString();
      const url = `${baseUrl}/api/clicks/stats${qs ? `?${qs}` : ""}`;
      const prevUrl = `${baseUrl}/api/clicks/stats?${prevParams.toString()}`;

      const tsParams = new URLSearchParams(params);
      tsParams.set("bucket", range === "today" ? "hour" : "day");
      const tsUrl = `${baseUrl}/api/clicks/timeseries?${tsParams.toString()}`;

      const [statsRes, sourcesRes, prevRes, tsRes, healthRes] = await Promise.all([
        fetch(url, { headers: { "X-Admin-Key": key } }),
        fetch(`${baseUrl}/api/clicks/sources`, { headers: { "X-Admin-Key": key } }),
        hasPrevious
          ? fetch(prevUrl, { headers: { "X-Admin-Key": key } })
          : Promise.resolve(null),
        fetch(tsUrl, { headers: { "X-Admin-Key": key } }),
        fetch(`${baseUrl}/api/clicks/preview-health`, { headers: { "X-Admin-Key": key } }),
      ]);
      if (statsRes.ok) {
        const data: ClickStat[] = await statsRes.json();
        setClickStats(data);
      }
      if (sourcesRes.ok) {
        const data: SourceStat[] = await sourcesRes.json();
        setSourceStats(data);
      }
      if (prevRes && prevRes.ok) {
        const data: ClickStat[] = await prevRes.json();
        setPreviousStats(data);
      } else {
        setPreviousStats([]);
      }
      if (tsRes.ok) {
        const data: TimeseriesRow[] = await tsRes.json();
        setTimeseries(data);
      }
      if (healthRes.ok) {
        const data = (await healthRes.json()) as {
          humanPreviews24h: number;
          botPreviews24h: number;
          lastHumanPreviewAt: string | null;
          lastBotFetchAt: string | null;
        };
        setPreviewHealth((prev) => {
          const wasWarning =
            prev != null && prev.humanPreviews24h > 0 && prev.botPreviews24h === 0;
          const isWarning = data.humanPreviews24h > 0 && data.botPreviews24h === 0;
          if (isWarning && !wasWarning) {
            setPreviewHealthDismissed(false);
          }
          return data;
        });
      }
    } catch {
    } finally {
      setClickStatsLoading(false);
    }
  }, [baseUrl]);

  const fetchPlans = useCallback(async (key: string) => {
    setLoading(true);
    setError(null);
    try {
      const verify = await fetch(`${baseUrl}/api/plans/admin/verify`, {
        headers: { "X-Admin-Key": key },
      });
      if (verify.status === 401) {
        setAuthed(false);
        setError("Senha incorreta.");
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      if (!verify.ok) throw new Error(`HTTP ${verify.status}`);

      const stored = loadStoredFilters();
      const [plansRes] = await Promise.all([
        fetch(`${baseUrl}/api/plans`, { headers: { "X-Admin-Key": key } }),
        fetchClickStats(key, stored.range, stored.source, stored.customFrom, stored.customTo, stored.city),
        fetchStreamingBrands(),
        fetchAppSettingsAdmin(),
      ]);
      if (!plansRes.ok) throw new Error(`HTTP ${plansRes.status}`);
      const data: ApiPlan[] = await plansRes.json();
      setPlans(data);
      setAuthed(true);
    } catch (err) {
      setError("Não foi possível carregar os planos.");
    } finally {
      setLoading(false);
    }
  }, [baseUrl, fetchClickStats, fetchStreamingBrands, fetchAppSettingsAdmin]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    localStorage.setItem(STORAGE_KEY, keyInput);
    setAdminKey(keyInput);
    fetchPlans(keyInput);
  }

  useEffect(() => {
    if (adminKey) fetchPlans(adminKey);
    else setLoading(false);
  }, [adminKey, fetchPlans]);

  useEffect(() => {
    try {
      localStorage.setItem(
        FILTERS_STORAGE_KEY,
        JSON.stringify({ range: statsRange, source: sourceFilter, customFrom, customTo, city: cityFilter }),
      );
    } catch {
      // ignore quota errors
    }
  }, [statsRange, sourceFilter, customFrom, customTo, cityFilter]);

  useEffect(() => {
    try {
      localStorage.setItem(
        UI_STORAGE_KEY,
        JSON.stringify({ chartView, previewOpen, previewMode }),
      );
    } catch {
      // ignore quota errors
    }
  }, [chartView, previewOpen, previewMode]);

  async function savePlan(plan: ApiPlan | Omit<ApiPlan, "id">) {
    setSaving(true);
    setSaveError(null);
    try {
      const isCreating = !("id" in plan);
      const url = isCreating
        ? `${baseUrl}/api/plans`
        : `${baseUrl}/api/plans/${(plan as ApiPlan).id}`;
      const method = isCreating ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey,
        },
        body: JSON.stringify(plan),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      await fetchPlans(adminKey);
      setEditingPlan(null);
      setIsNew(false);
    } catch (err) {
      setSaveError(String(err));
    } finally {
      setSaving(false);
    }
  }

  async function deletePlan(id: number) {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`${baseUrl}/api/plans/${id}`, {
        method: "DELETE",
        headers: { "X-Admin-Key": adminKey },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchPlans(adminKey);
      setDeleteConfirm(null);
    } catch (err) {
      setSaveError(String(err));
    } finally {
      setSaving(false);
    }
  }

  async function persistOrder(newPlans: ApiPlan[]) {
    const previous = plans;
    setPlans(newPlans);
    setReordering(true);
    setSaveError(null);
    try {
      const res = await fetch(`${baseUrl}/api/plans/reorder`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey,
        },
        body: JSON.stringify({ order: newPlans.map((p) => p.id) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const updated: ApiPlan[] = await res.json();
      setPlans(updated);
    } catch (err) {
      setPlans(previous);
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setReordering(false);
    }
  }

  function handleDrop(targetId: number) {
    const sourceId = dragId;
    setDragId(null);
    setDragOverId(null);
    if (sourceId == null || sourceId === targetId) return;
    const sourceIdx = plans.findIndex((p) => p.id === sourceId);
    const targetIdx = plans.findIndex((p) => p.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;
    const next = [...plans];
    const [moved] = next.splice(sourceIdx, 1);
    next.splice(targetIdx, 0, moved!);
    void persistOrder(next);
  }

  function startEdit(plan: ApiPlan) {
    setEditingPlan({ ...plan });
    setIsNew(false);
    setSaveError(null);
  }

  function startNew() {
    setEditingPlan({ id: -1, ...emptyPlan() });
    setIsNew(true);
    setSaveError(null);
  }

  function cancelEdit() {
    setEditingPlan(null);
    setIsNew(false);
    setSaveError(null);
  }

  if (!authed && !loading) {
    return (
      <main id="main-content" tabIndex={-1} className="min-h-screen flex items-center justify-center focus:outline-none" style={{ background: "#F5F7FA" }}>
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#0040FF" }}>
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-lg text-[#0D0D0D]">Painel Admin</h1>
              <p className="text-xs text-[#7A7F8C]">Provider Mais Fibra</p>
            </div>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#2A2D38] mb-1">Senha de acesso</label>
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                className="w-full border border-[#E0E3EB] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
                placeholder="Digite a senha"
                required
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              className="w-full py-2.5 rounded-lg font-bold text-sm text-white transition-all duration-200 hover:opacity-90"
              style={{ background: "#0040FF" }}
            >
              Entrar
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#F5F7FA" }}>
      <header className="bg-white border-b border-[#E0E3EB] px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <a href="/" className="text-[#7A7F8C] hover:text-[#0040FF] transition-colors">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </a>
          <h1 className="font-bold text-[#0D0D0D]">Gerenciar Planos</h1>
        </div>
        <button
          onClick={() => {
            localStorage.removeItem(STORAGE_KEY);
            setAdminKey("");
            setAuthed(false);
            setKeyInput("");
          }}
          className="text-sm text-[#7A7F8C] hover:text-[#0D0D0D] transition-colors"
        >
          Sair
        </button>
      </header>

      <main id="main-content" tabIndex={-1} className="max-w-5xl mx-auto px-4 sm:px-6 py-8 focus:outline-none">
        <div className="mb-6 inline-flex rounded-lg border border-[#E0E3EB] bg-white p-0.5" role="tablist" aria-label="Seções do painel">
          {([
            { id: "planos", label: "Planos" },
            { id: "ctas", label: "Configuração de CTAs" },
            { id: "interesses", label: "Interesses (Demanda)" },
            { id: "emails", label: "Relatórios por email" },
          ] as const).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                  active
                    ? "bg-[#122AD5] text-white"
                    : "text-[#7A7F8C] hover:text-[#0D0D0D]"
                }`}
                data-testid={`admin-tab-${tab.id}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {loading && (
          <div className="text-center text-[#7A7F8C] py-12">Carregando...</div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-6 text-sm">
            {error}
          </div>
        )}

        {!loading && activeTab === "ctas" && (
          <CtaSettingsManager
            settings={appSettings}
            adminKey={adminKey}
            baseUrl={baseUrl}
            onChange={fetchAppSettingsAdmin}
          />
        )}

        {!loading && activeTab === "interesses" && (
          <div className="space-y-6">
            <InterestNotificationSettings
              settings={appSettings}
              adminKey={adminKey}
              baseUrl={baseUrl}
              onChange={fetchAppSettingsAdmin}
            />
            <DemandInterestsManager adminKey={adminKey} baseUrl={baseUrl} />
          </div>
        )}

        {!loading && activeTab === "emails" && (
          <EmailReportSubscriptionsManager adminKey={adminKey} baseUrl={baseUrl} />
        )}

        {!loading && activeTab === "planos" && (
          <>
            {/* Click stats */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold text-[#0D0D0D] text-base">Cliques por Plano</h2>
                  {cityFilter && (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF8D6] border border-[#FFD600] pl-2.5 pr-1 py-0.5 text-xs font-semibold text-[#5C4500]"
                      data-testid="city-filter-chip"
                    >
                      <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 22s-8-7.5-8-13a8 8 0 1 1 16 0c0 5.5-8 13-8 13z" />
                        <circle cx="12" cy="9" r="3" />
                      </svg>
                      Cidade: {cityFilter}
                      <button
                        type="button"
                        onClick={() => {
                          setCityFilter(null);
                          void fetchClickStats(
                            adminKey,
                            statsRange,
                            sourceFilter,
                            customFrom,
                            customTo,
                            null,
                          );
                        }}
                        className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-white text-[#5C4500] hover:bg-[#5C4500] hover:text-white transition-colors"
                        aria-label="Remover filtro de cidade"
                        title="Remover filtro de cidade"
                      >
                        <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="inline-flex rounded-lg border border-[#E0E3EB] bg-white p-0.5" role="group" aria-label="Período">
                    {([
                      { id: "today", label: "Hoje" },
                      { id: "week", label: "Esta semana" },
                      { id: "all", label: "Tudo" },
                      { id: "custom", label: "Personalizado" },
                    ] as const).map((opt) => {
                      const active = statsRange === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setStatsRange(opt.id);
                            if (opt.id === "custom") {
                              void fetchClickStats(adminKey, opt.id, sourceFilter, customFrom, customTo, cityFilter);
                            } else {
                              void fetchClickStats(adminKey, opt.id, sourceFilter, "", "", cityFilter);
                            }
                          }}
                          disabled={clickStatsLoading && active}
                          className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
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
                  {statsRange === "custom" && (
                    <div className="inline-flex flex-wrap items-center gap-2 text-xs text-[#2A2D38]">
                      <label className="flex items-center gap-1">
                        <span className="text-[#7A7F8C]">De</span>
                        <input
                          type="date"
                          value={customFrom}
                          max={customTo || undefined}
                          onChange={(e) => {
                            const v = e.target.value;
                            setCustomFrom(v);
                            if (v && customTo) {
                              void fetchClickStats(adminKey, "custom", sourceFilter, v, customTo, cityFilter);
                            }
                          }}
                          className="border border-[#E0E3EB] rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
                          aria-label="Data inicial"
                        />
                      </label>
                      <label className="flex items-center gap-1">
                        <span className="text-[#7A7F8C]">até</span>
                        <input
                          type="date"
                          value={customTo}
                          min={customFrom || undefined}
                          onChange={(e) => {
                            const v = e.target.value;
                            setCustomTo(v);
                            if (customFrom && v) {
                              void fetchClickStats(adminKey, "custom", sourceFilter, customFrom, v, cityFilter);
                            }
                          }}
                          className="border border-[#E0E3EB] rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
                          aria-label="Data final"
                        />
                      </label>
                      <div className="inline-flex flex-wrap items-center gap-1" role="group" aria-label="Atalhos de período">
                        {([
                          { id: "last7", label: "Últimos 7 dias" },
                          { id: "last30", label: "Últimos 30 dias" },
                          { id: "thisMonth", label: "Este mês" },
                          { id: "lastMonth", label: "Mês passado" },
                        ] as const).map((sc) => {
                          const fmt = (d: Date) => {
                            const y = d.getFullYear();
                            const m = String(d.getMonth() + 1).padStart(2, "0");
                            const day = String(d.getDate()).padStart(2, "0");
                            return `${y}-${m}-${day}`;
                          };
                          const computeRange = (id: typeof sc.id): { from: string; to: string } => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            if (id === "last7") {
                              const from = new Date(today);
                              from.setDate(from.getDate() - 6);
                              return { from: fmt(from), to: fmt(today) };
                            }
                            if (id === "last30") {
                              const from = new Date(today);
                              from.setDate(from.getDate() - 29);
                              return { from: fmt(from), to: fmt(today) };
                            }
                            if (id === "thisMonth") {
                              const from = new Date(today.getFullYear(), today.getMonth(), 1);
                              return { from: fmt(from), to: fmt(today) };
                            }
                            const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                            const to = new Date(today.getFullYear(), today.getMonth(), 0);
                            return { from: fmt(from), to: fmt(to) };
                          };
                          const current = computeRange(sc.id);
                          const active = customFrom === current.from && customTo === current.to;
                          return (
                            <button
                              key={sc.id}
                              type="button"
                              onClick={() => {
                                const { from, to } = computeRange(sc.id);
                                setCustomFrom(from);
                                setCustomTo(to);
                                void fetchClickStats(adminKey, "custom", sourceFilter, from, to, cityFilter);
                              }}
                              className={`px-2 py-1 rounded-md border transition-colors ${
                                active
                                  ? "bg-[#0040FF] text-white border-[#0040FF]"
                                  : "bg-white text-[#2A2D38] border-[#E0E3EB] hover:border-[#0040FF]/50"
                              }`}
                              aria-pressed={active}
                            >
                              {sc.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <select
                    value={sourceFilter}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSourceFilter(v);
                      void fetchClickStats(adminKey, statsRange, v, customFrom, customTo, cityFilter);
                    }}
                    className="text-xs font-semibold border border-[#E0E3EB] rounded-md px-2 py-1 bg-white text-[#2A2D38] focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
                    aria-label="Filtrar por origem"
                  >
                    <option value="">Todas as origens</option>
                    {sourceStats.map((s) => (
                      <option key={s.source} value={s.source}>
                        {s.source} ({s.total})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => fetchClickStats(adminKey, statsRange, sourceFilter, customFrom, customTo, cityFilter)}
                    disabled={clickStatsLoading}
                    className="text-xs text-[#0040FF] hover:underline disabled:opacity-50"
                  >
                    {clickStatsLoading ? "Atualizando..." : "Atualizar"}
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const params = new URLSearchParams();
                        let filename: string;
                        const stamp = new Date().toISOString().slice(0, 10);
                        if (statsRange === "custom") {
                          if (!customFrom || !customTo) {
                            setSaveError("Selecione as datas inicial e final.");
                            return;
                          }
                          const since = new Date(`${customFrom}T00:00:00`);
                          const until = new Date(`${customTo}T00:00:00`);
                          until.setDate(until.getDate() + 1);
                          if (Number.isNaN(since.getTime()) || Number.isNaN(until.getTime()) || until <= since) {
                            setSaveError("Intervalo de datas inválido.");
                            return;
                          }
                          params.set("since", since.toISOString());
                          params.set("until", until.toISOString());
                          filename = `clicks-${customFrom}_to_${customTo}.csv`;
                        } else if (statsRange !== "all") {
                          const since = new Date();
                          if (statsRange === "today") {
                            since.setHours(0, 0, 0, 0);
                          } else {
                            since.setDate(since.getDate() - 7);
                          }
                          params.set("since", since.toISOString());
                          const rangeSlug = statsRange === "today" ? "today" : "week";
                          filename = `clicks-${rangeSlug}-${stamp}.csv`;
                        } else {
                          filename = `clicks-all-${stamp}.csv`;
                        }
                        if (cityFilter) {
                          params.set("city", cityFilter);
                          const citySlug = cityFilter
                            .toLowerCase()
                            .normalize("NFD")
                            .replace(/[\u0300-\u036f]/g, "")
                            .replace(/[^a-z0-9]+/g, "-")
                            .replace(/^-+|-+$/g, "")
                            .slice(0, 60) || "city";
                          filename = filename.replace(/^clicks-/, `clicks-${citySlug}-`);
                        }
                        const qs = params.toString();
                        const res = await fetch(
                          `${baseUrl}/api/clicks/export${qs ? `?${qs}` : ""}`,
                          { headers: { "X-Admin-Key": adminKey } },
                        );
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      } catch {
                        setSaveError("Não foi possível exportar o CSV.");
                      }
                    }}
                    className="text-xs font-semibold px-3 py-1 rounded-md border border-[#0040FF]/20 text-[#0040FF] hover:bg-[#0040FF]/5 transition-colors"
                  >
                    Exportar CSV
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`${baseUrl}/api/clicks/export/raw`, {
                          headers: { "X-Admin-Key": adminKey },
                        });
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        const stamp = new Date().toISOString().slice(0, 10);
                        a.download = `clicks-raw-${stamp}.csv`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      } catch {
                        setSaveError("Não foi possível exportar o CSV bruto.");
                      }
                    }}
                    className="text-xs font-semibold px-3 py-1 rounded-md border border-[#0040FF]/20 text-[#0040FF] hover:bg-[#0040FF]/5 transition-colors"
                    title="Uma linha por clique individual"
                  >
                    Exportar CSV (bruto)
                  </button>
                </div>
              </div>
              {chartData.length > 0 && (
                <div className="bg-white rounded-xl border border-[#E0E3EB] px-4 py-4 mb-3">
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <h3 className="text-sm font-semibold text-[#2A2D38]">
                      Cliques {statsRange === "today" ? "por hora" : "por dia"}
                      {chartView === "source" ? " — por origem" : ""}
                    </h3>
                    <div className="flex items-center gap-3">
                      <div className="inline-flex rounded-lg border border-[#E0E3EB] bg-white p-0.5" role="group" aria-label="Modo do gráfico">
                        {([
                          { id: "total", label: "Total" },
                          { id: "source", label: "Por origem" },
                        ] as const).map((opt) => {
                          const active = chartView === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setChartView(opt.id)}
                              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
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
                      <span className="text-xs text-[#7A7F8C]">
                        Total: {chartData.reduce((acc, p) => acc + p.total, 0)}
                      </span>
                    </div>
                  </div>
                  <div style={{ width: "100%", height: chartView === "source" ? 220 : 180 }}>
                    <ResponsiveContainer>
                      {chartView === "source" ? (
                        <BarChart data={stackedChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F5" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#7A7F8C" }} tickLine={false} axisLine={{ stroke: "#E0E3EB" }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#7A7F8C" }} tickLine={false} axisLine={false} />
                          <Tooltip
                            cursor={{ fill: "rgba(0,64,255,0.06)" }}
                            content={({ active, payload, label }) => {
                              if (!active || !payload || payload.length === 0) return null;
                              const ordered = [...payload]
                                .filter((p) => typeof p.value === "number" && (p.value as number) > 0)
                                .sort((a, b) => (b.value as number) - (a.value as number));
                              const totalForBucket = ordered.reduce(
                                (acc, p) => acc + (p.value as number),
                                0,
                              );
                              return (
                                <div className="bg-white border border-[#E0E3EB] rounded-lg px-3 py-2 shadow-sm text-xs">
                                  <div className="font-semibold text-[#0D0D0D] mb-1">{label}</div>
                                  <div className="text-[#0040FF] font-bold mb-1.5">
                                    {totalForBucket} {totalForBucket === 1 ? "clique" : "cliques"}
                                  </div>
                                  <div className="space-y-0.5 max-h-40 overflow-y-auto">
                                    {ordered.map((p) => (
                                      <div key={String(p.dataKey)} className="flex items-center justify-between gap-3 text-[#2A2D38]">
                                        <span className="flex items-center gap-1.5 truncate">
                                          <span
                                            className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                            style={{ background: p.color }}
                                          />
                                          <span className="truncate">{String(p.dataKey)}</span>
                                        </span>
                                        <span className="font-semibold tabular-nums">{p.value as number}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            }}
                          />
                          <Legend
                            verticalAlign="bottom"
                            height={28}
                            iconSize={10}
                            wrapperStyle={{ fontSize: 11, color: "#2A2D38" }}
                          />
                          {chartSources.map(({ source, color }, i) => (
                            <Bar
                              key={source}
                              dataKey={source}
                              stackId="src"
                              fill={color}
                              maxBarSize={48}
                              radius={i === chartSources.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                            />
                          ))}
                        </BarChart>
                      ) : (
                        <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F5" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#7A7F8C" }} tickLine={false} axisLine={{ stroke: "#E0E3EB" }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#7A7F8C" }} tickLine={false} axisLine={false} />
                          <Tooltip
                            cursor={{ fill: "rgba(0,64,255,0.06)" }}
                            contentStyle={{
                              background: "#fff",
                              border: "1px solid #E0E3EB",
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                            content={({ active, payload }) => {
                              if (!active || !payload || payload.length === 0) return null;
                              const point = payload[0]?.payload as ChartPoint | undefined;
                              if (!point) return null;
                              const sortedPlans = [...point.byPlan].sort((a, b) => b.total - a.total);
                              return (
                                <div className="bg-white border border-[#E0E3EB] rounded-lg px-3 py-2 shadow-sm text-xs">
                                  <div className="font-semibold text-[#0D0D0D] mb-1">{point.label}</div>
                                  <div className="text-[#0040FF] font-bold mb-1.5">
                                    {point.total} {point.total === 1 ? "clique" : "cliques"}
                                  </div>
                                  <div className="space-y-0.5 max-h-40 overflow-y-auto">
                                    {sortedPlans.map((p, i) => {
                                      const isCity = p.planSpeed === "city";
                                      return (
                                        <div key={`${p.planSpeed}-${p.planPrice}-${i}`} className="flex items-center justify-between gap-3 text-[#2A2D38]">
                                          <span className="truncate">
                                            {isCity ? p.planPrice : `${p.planSpeed} Mega`}
                                          </span>
                                          <span className="font-semibold tabular-nums">{p.total}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            }}
                          />
                          <Bar dataKey="total" fill="#0040FF" radius={[4, 4, 0, 0]} maxBarSize={48} />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              {previewHealth &&
                !previewHealthDismissed &&
                previewHealth.humanPreviews24h > 0 &&
                previewHealth.botPreviews24h === 0 && (
                  <div
                    className="rounded-xl border px-4 py-3 mb-3 flex items-start gap-3 flex-wrap"
                    style={{ background: "#FFF4E5", borderColor: "#F0B070" }}
                    role="alert"
                  >
                    <div
                      className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0"
                      style={{ background: "#C77700" }}
                      aria-hidden="true"
                    >
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm font-bold text-[#7A4A00]">
                          A pré-visualização do WhatsApp pode estar quebrada
                        </span>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: "#F0B070", color: "#5A3500" }}
                        >
                          Últimas 24h
                        </span>
                      </div>
                      <p className="text-[12px] text-[#5A3500] mt-1 leading-relaxed">
                        Houve{" "}
                        <strong>
                          {previewHealth.humanPreviews24h.toLocaleString("pt-BR")}{" "}
                          {previewHealth.humanPreviews24h === 1
                            ? "abertura humana"
                            : "aberturas humanas"}
                        </strong>{" "}
                        da página de compartilhamento, mas{" "}
                        <strong>nenhuma busca de robô</strong> (WhatsApp/Facebook) foi
                        registrada. Isso normalmente significa que a prévia rica não está
                        sendo gerada — verifique as meta tags, a imagem de compartilhamento
                        e se o crawler não está bloqueado.
                        {previewHealth.lastBotFetchAt && (
                          <>
                            {" "}Última busca de robô:{" "}
                            <strong>
                              {new Date(previewHealth.lastBotFetchAt).toLocaleString("pt-BR")}
                            </strong>
                            .
                          </>
                        )}
                        {!previewHealth.lastBotFetchAt && (
                          <> Nenhuma busca de robô já foi registrada.</>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewHealthDismissed(true)}
                      className="text-[11px] font-semibold text-[#7A4A00] underline hover:no-underline self-start"
                    >
                      Dispensar
                    </button>
                  </div>
                )}
              {(crawlerPreviews.humans > 0 || crawlerPreviews.bots > 0) && (
                <div
                  className="rounded-xl border px-4 py-3 mb-3 flex items-center gap-3 flex-wrap"
                  style={{ background: "#F5F7FA", borderColor: "#E0E3EB", borderStyle: "dashed" }}
                >
                  <div
                    className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0"
                    style={{ background: "#A1A6B0" }}
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="8" width="18" height="12" rx="2" />
                      <path d="M12 8V4" />
                      <circle cx="12" cy="3" r="1" />
                      <path d="M8 13h.01M16 13h.01" />
                      <path d="M9 17h6" />
                    </svg>
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-2xl font-black tabular-nums text-[#2A2D38]">
                        {crawlerPreviews.humans.toLocaleString("pt-BR")}
                      </span>
                      <span className="text-sm font-semibold text-[#2A2D38]">
                        {crawlerPreviews.humans === 1 ? "pré-visualização" : "pré-visualizações"}
                      </span>
                      <span className="text-sm text-[#7A7F8C]" aria-hidden="true">·</span>
                      <span className="text-sm font-semibold tabular-nums text-[#2A2D38]">
                        {crawlerPreviews.bots.toLocaleString("pt-BR")}
                      </span>
                      <span
                        className="text-sm text-[#2A2D38] inline-flex items-center gap-1"
                        title="Detecção de robôs: ao vivo pelo User-Agent na página de compartilhamento e, retroativamente, pelo backfill que reclassifica rajadas de acessos como bot."
                      >
                        {crawlerPreviews.bots === 1 ? "robô filtrado" : "robôs filtrados"}
                        <svg
                          viewBox="0 0 24 24"
                          className="w-3.5 h-3.5 text-[#7A7F8C]"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 16v-4" />
                          <path d="M12 8h.01" />
                        </svg>
                      </span>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "#EEF0F5", color: "#7A7F8C" }}
                      >
                        WhatsApp / Facebook
                      </span>
                    </div>
                    <p className="text-[11px] text-[#7A7F8C] mt-0.5">
                      Pré-visualizações reais (humanas) já descontam os acessos do WhatsApp/Facebook que apenas geram a prévia rica.{" "}
                      <span className="italic">Robôs filtrados</span> são identificados ao vivo pelo User-Agent e, em registros antigos, por um backfill que reclassifica rajadas suspeitas como <code className="text-[10px]">whatsapp-share-bot</code>.
                    </p>
                  </div>
                </div>
              )}
              {conversionByPlan.length > 0 && (
                <div className="bg-white rounded-xl border border-[#E0E3EB] px-4 py-4 mb-3">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-[#2A2D38]">
                        Conversão WhatsApp — Pré-visualização → Assinatura
                      </h3>
                      <p className="text-[11px] text-[#7A7F8C] mt-0.5">
                        % das pré-visualizações compartilhadas que resultaram em clique em "ASSINE JÁ".
                      </p>
                    </div>
                    {sourceFilter && (
                      <span className="text-[11px] text-[#7A7F8C] italic">
                        Filtro de origem ativo — números refletem apenas "{sourceFilter}".
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {conversionByPlan.map((c) => {
                      const rate = c.previews > 0 ? (c.signups / c.previews) * 100 : null;
                      const ratePct = rate == null ? null : Math.min(100, Math.round(rate));
                      const tone =
                        rate == null
                          ? { color: "#7A7F8C", background: "#EEF0F5" }
                          : rate >= 30
                          ? { color: "#00A030", background: "#E6F8EC" }
                          : rate >= 10
                          ? { color: "#A06B00", background: "#FFF4D6" }
                          : { color: "#C42B2B", background: "#FBE7E7" };
                      const barWidth = rate == null ? 0 : Math.min(100, rate);
                      return (
                        <div
                          key={`${c.planSpeed}-${c.planPrice}`}
                          className="rounded-lg border border-[#E0E3EB] px-3 py-3 flex flex-col gap-2"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <div className="flex items-baseline gap-1 min-w-0">
                              <span className="font-black text-xl text-[#0040FF]">{c.planSpeed}</span>
                              <span className="text-xs font-semibold text-[#2A2D38]">Mega</span>
                              <span className="text-[11px] text-[#7A7F8C] truncate">
                                · R$ {c.planPrice}
                              </span>
                            </div>
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                              style={tone}
                              title={
                                rate == null
                                  ? "Nenhuma pré-visualização registrada"
                                  : `${c.signups} de ${c.previews} pré-visualizações`
                              }
                            >
                              {ratePct == null ? "—" : `${ratePct}%`}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-[#2A2D38]">
                            <span>
                              Pré-visualizações:{" "}
                              <span className="font-semibold tabular-nums">{c.previews}</span>
                            </span>
                            <span>
                              Assinaturas:{" "}
                              <span className="font-semibold tabular-nums">{c.signups}</span>
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[#EEF0F5] overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${barWidth}%`,
                                background: rate == null ? "#E0E3EB" : tone.color,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {conversionBySource.length > 0 && (
                <div className="bg-white rounded-xl border border-[#E0E3EB] px-4 py-4 mb-3">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-[#2A2D38]">
                        Conversão WhatsApp — por origem
                      </h3>
                      <p className="text-[11px] text-[#7A7F8C] mt-0.5">
                        Onde nasceram as pré-visualizações (Home, FAQ, páginas de cidade, etc.) e quanto cada origem converte em "ASSINE JÁ".
                      </p>
                    </div>
                  </div>
                  {weakestSource && (
                    <div className="mb-3 rounded-lg border border-[#F5C2C2] bg-[#FBE7E7] px-3 py-2.5 flex items-start gap-2.5">
                      <span
                        aria-hidden
                        className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#C42B2B] text-white text-[11px] font-bold flex-shrink-0"
                      >
                        !
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-[#C42B2B]">
                          Origem com pior conversão
                        </div>
                        <div className="mt-0.5 text-sm text-[#2A2D38]">
                          <span className="font-semibold text-[#0D0D0D]">
                            {formatSourceLabel(weakestSource.source)}
                          </span>{" "}
                          converteu{" "}
                          <span className="font-semibold tabular-nums">
                            {Math.round(weakestSource.rate)}%
                          </span>{" "}
                          ({weakestSource.signups} de {weakestSource.previews} pré-visualizações).
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {conversionBySource.map((c) => {
                      const rate = c.previews > 0 ? (c.signups / c.previews) * 100 : null;
                      const ratePct = rate == null ? null : Math.min(100, Math.round(rate));
                      const tone =
                        rate == null
                          ? { color: "#7A7F8C", background: "#EEF0F5" }
                          : rate >= 30
                          ? { color: "#00A030", background: "#E6F8EC" }
                          : rate >= 10
                          ? { color: "#A06B00", background: "#FFF4D6" }
                          : { color: "#C42B2B", background: "#FBE7E7" };
                      const barWidth = rate == null ? 0 : Math.min(100, rate);
                      return (
                        <div
                          key={c.source}
                          className="rounded-lg border border-[#E0E3EB] px-3 py-3 flex flex-col gap-2"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span
                              className="font-semibold text-sm text-[#0D0D0D] truncate min-w-0"
                              title={c.source}
                            >
                              {formatSourceLabel(c.source)}
                            </span>
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                              style={tone}
                              title={
                                rate == null
                                  ? "Nenhuma pré-visualização registrada"
                                  : `${c.signups} de ${c.previews} pré-visualizações`
                              }
                            >
                              {ratePct == null ? "—" : `${ratePct}%`}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-[#2A2D38]">
                            <span>
                              Pré-visualizações:{" "}
                              <span className="font-semibold tabular-nums">{c.previews}</span>
                            </span>
                            <span>
                              Assinaturas:{" "}
                              <span className="font-semibold tabular-nums">{c.signups}</span>
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[#EEF0F5] overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${barWidth}%`,
                                background: rate == null ? "#E0E3EB" : tone.color,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {clickStats.length === 0 && !clickStatsLoading ? (
                <div className="bg-white rounded-xl border border-[#E0E3EB] px-5 py-6 text-center text-sm text-[#7A7F8C]">
                  {statsRange === "today"
                    ? "Nenhum clique hoje."
                    : statsRange === "week"
                    ? "Nenhum clique nesta semana."
                    : "Nenhum clique registrado ainda."}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {clickStats.map((stat) => {
                    const maxClicks = Math.max(...clickStats.map((s) => s.total), 1);
                    const pct = Math.round((stat.total / maxClicks) * 100);
                    const isCity = stat.planSpeed === "city";
                    const prev = previousStats.find(
                      (p) =>
                        p.planSpeed === stat.planSpeed &&
                        p.planPrice === stat.planPrice &&
                        p.source === stat.source,
                    );
                    const prevTotal = prev?.total ?? 0;
                    const showDelta = statsRange !== "all";
                    let deltaLabel: string | null = null;
                    let deltaTone: "up" | "down" | "flat" = "flat";
                    if (showDelta) {
                      const diff = stat.total - prevTotal;
                      if (prevTotal === 0 && stat.total === 0) {
                        deltaLabel = "0% vs período anterior";
                        deltaTone = "flat";
                      } else if (prevTotal === 0) {
                        deltaLabel = `+${stat.total} vs período anterior`;
                        deltaTone = "up";
                      } else {
                        const pctChange = Math.round((diff / prevTotal) * 100);
                        const sign = pctChange > 0 ? "+" : "";
                        deltaLabel = `${sign}${pctChange}% vs período anterior`;
                        deltaTone = pctChange > 0 ? "up" : pctChange < 0 ? "down" : "flat";
                      }
                    }
                    const deltaColor =
                      deltaTone === "up"
                        ? { color: "#00A030", background: "#E6F8EC" }
                        : deltaTone === "down"
                        ? { color: "#C42B2B", background: "#FBE7E7" }
                        : { color: "#7A7F8C", background: "#EEF0F5" };
                    return (
                      <div
                        key={`${stat.planSpeed}-${stat.planPrice}-${stat.source}`}
                        className="bg-white rounded-xl border border-[#E0E3EB] px-4 py-4 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-2xl text-[#0040FF] truncate">
                            {isCity ? stat.planPrice : stat.planSpeed}
                          </span>
                          <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "#00C040" }}>
                            {stat.total} {stat.total === 1 ? "clique" : "cliques"}
                          </span>
                        </div>
                        <p className="text-xs text-[#7A7F8C]">
                          {isCity ? "CTA da cidade" : `R$ ${stat.planPrice}/mês`}
                        </p>
                        {deltaLabel && (
                          <span
                            className="self-start inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={deltaColor}
                            title={`Período anterior: ${prevTotal} ${prevTotal === 1 ? "clique" : "cliques"}`}
                          >
                            {deltaTone === "up" ? "▲" : deltaTone === "down" ? "▼" : "■"} {deltaLabel}
                          </span>
                        )}
                        <span
                          className="self-start text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EEF0F5] text-[#2A2D38] truncate max-w-full"
                          title={`Origem: ${stat.source}`}
                        >
                          Origem: {stat.source}
                        </span>
                        <div className="h-1.5 rounded-full bg-[#EEF0F5] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: pct === 100 ? "#00C040" : "#0040FF" }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mb-8">
              <CityClicksMap
                adminKey={adminKey}
                baseUrl={baseUrl}
                selectedCity={cityFilter}
                onSelectCity={(city) => {
                  setCityFilter(city);
                  void fetchClickStats(
                    adminKey,
                    statsRange,
                    sourceFilter,
                    customFrom,
                    customTo,
                    city,
                  );
                }}
              />
            </div>

            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-[#7A7F8C]">
                {plans.length} plano(s) cadastrado(s){" "}
                {reordering ? <span className="ml-2 text-[#0040FF]">Salvando ordem...</span> : <span className="hidden sm:inline">· arraste para reordenar</span>}
              </p>
              <button
                onClick={startNew}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition-all hover:opacity-90"
                style={{ background: "#0040FF" }}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Novo Plano
              </button>
            </div>

            {saveError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
                {saveError}
              </div>
            )}

            {(editingPlan !== null) && (
              <PlanForm
                plan={editingPlan}
                isNew={isNew}
                saving={saving}
                adminKey={adminKey}
                allInclusions={allInclusions}
                streamingBrands={streamingBrands}
                onSave={savePlan}
                onCancel={cancelEdit}
              />
            )}

            <StreamingBrandsManager
              brands={streamingBrands}
              adminKey={adminKey}
              baseUrl={baseUrl}
              onChange={fetchStreamingBrands}
            />

            {plans.length > 0 && (
              <div className="mb-6 bg-white rounded-xl border border-[#E0E3EB] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setPreviewOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-[#F5F7FA] transition-colors"
                  aria-expanded={previewOpen}
                  aria-controls="admin-home-preview"
                >
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#0040FF]" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                    <span className="font-bold text-sm text-[#0D0D0D]">Pré-visualização</span>
                    <span className="text-xs text-[#7A7F8C]">como aparece na home</span>
                  </div>
                  <svg
                    viewBox="0 0 24 24"
                    className={`w-4 h-4 text-[#7A7F8C] transition-transform ${previewOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>
                {previewOpen && (
                  <div
                    id="admin-home-preview"
                    className="border-t border-[#E0E3EB]"
                  >
                    <div className="px-5 pt-4 pb-3 flex items-center justify-center bg-white border-b border-[#E0E3EB]">
                      <div
                        className="inline-flex rounded-lg border border-[#E0E3EB] bg-white p-0.5"
                        role="group"
                        aria-label="Modo de pré-visualização"
                      >
                        {([
                          { id: "desktop", label: "Desktop" },
                          { id: "tablet", label: "Tablet" },
                          { id: "mobile", label: "Mobile" },
                        ] as const).map((opt) => {
                          const active = previewMode === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setPreviewMode(opt.id)}
                              aria-pressed={active}
                              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                                active
                                  ? "bg-[#0040FF] text-white"
                                  : "text-[#7A7F8C] hover:text-[#0D0D0D]"
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div
                      className="px-5 py-6"
                      style={{ background: previewMode === "desktop" ? "#0A1F8C" : "#F5F7FA" }}
                    >
                      {previewMode === "desktop" ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          {plans.map((plan, i) => (
                            <PlanCard
                              key={plan.id}
                              plan={apiPlanToPlan(plan)}
                              index={i}
                              idSuffix={`-preview-${plan.id}`}
                              source="admin-preview"
                            />
                          ))}
                        </div>
                      ) : previewMode === "tablet" ? (
                        <div className="flex justify-center">
                          <div
                            className="rounded-[24px] border-[10px] border-[#0D0D0D] bg-[#0A1F8C] overflow-hidden shadow-xl"
                            style={{ width: 768 }}
                          >
                            <div
                              className="grid grid-cols-2 justify-items-center px-6 py-6"
                              style={{ gap: 20 }}
                            >
                              {plans.map((plan, i) => (
                                <PlanCard
                                  key={plan.id}
                                  plan={apiPlanToPlan(plan)}
                                  index={i}
                                  idSuffix={`-preview-tablet-${plan.id}`}
                                  source="admin-preview"
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <MobilePlansPreview
                          plans={plans.map((p) => ({ id: p.id, plan: apiPlanToPlan(p) }))}
                          source="admin-preview"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  draggable={!editingPlan && !reordering}
                  onDragStart={(e) => {
                    setDragId(plan.id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", String(plan.id));
                  }}
                  onDragOver={(e) => {
                    if (dragId == null) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverId !== plan.id) setDragOverId(plan.id);
                  }}
                  onDragLeave={() => {
                    if (dragOverId === plan.id) setDragOverId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDrop(plan.id);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setDragOverId(null);
                  }}
                  className={`bg-white rounded-xl border border-[#E0E3EB] px-5 py-4 flex items-center gap-4 transition-all ${
                    dragId === plan.id ? "opacity-40" : ""
                  } ${dragOverId === plan.id && dragId !== plan.id ? "border-[#0040FF] ring-2 ring-[#0040FF]/20" : ""}`}
                  style={plan.featured && !(dragOverId === plan.id && dragId !== plan.id) ? { borderColor: "#00C040" } : {}}
                >
                  <div
                    className="flex-shrink-0 cursor-grab active:cursor-grabbing text-[#7A7F8C] hover:text-[#0040FF] transition-colors"
                    title="Arraste para reordenar"
                    aria-label="Arraste para reordenar"
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                      <circle cx="9" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/>
                      <circle cx="15" cy="6" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
                    </svg>
                  </div>
                  {plan.imageUrl && (
                    <img
                      src={plan.imageUrl}
                      alt=""
                      className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-[#E0E3EB]"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-2xl text-[#0040FF]">{plan.speed}</span>
                      <span className="text-sm font-semibold text-[#2A2D38]">Mega</span>
                      {plan.featured && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: "#00C040" }}>
                          {plan.badge ?? "Destaque"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-[#7A7F8C]">
                      <span>R$ {plan.price}/mês</span>
                      <span>·</span>
                      <span>{plan.wifi}</span>
                      {plan.bonus && (
                        <>
                          <span>·</span>
                          <span className="truncate">{plan.bonus}</span>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {plan.inclusions.map((inc) => (
                        <span key={inc} className="text-[11px] px-1.5 py-0.5 rounded bg-[#EEF0F5] text-[#2A2D38]">{inc}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => startEdit(plan)}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium text-[#0040FF] border border-[#0040FF]/20 hover:bg-[#0040FF]/5 transition-colors"
                    >
                      Editar
                    </button>
                    {deleteConfirm === plan.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => deletePlan(plan.id)}
                          disabled={saving}
                          className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-3 py-1.5 rounded-lg text-sm font-medium text-[#7A7F8C] hover:text-[#0D0D0D] transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(plan.id)}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium text-red-500 border border-red-200 hover:bg-red-50 transition-colors"
                      >
                        Excluir
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {plans.length === 0 && !editingPlan && (
                <div className="text-center text-[#7A7F8C] py-12 bg-white rounded-xl border border-[#E0E3EB]">
                  Nenhum plano cadastrado. Clique em "Novo Plano" para começar.
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

type PlanFormProps = {
  plan: ApiPlan;
  isNew: boolean;
  saving: boolean;
  adminKey: string;
  allInclusions: string[];
  streamingBrands: StreamingBrand[];
  onSave: (plan: ApiPlan | Omit<ApiPlan, "id">) => void;
  onCancel: () => void;
};

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

function PlanForm({ plan, isNew, saving, adminKey, allInclusions, streamingBrands, onSave, onCancel }: PlanFormProps) {
  // Text-only inclusions (e.g. "Instalação Grátis", "Roteador Wi-Fi 6"). Brand
  // names are no longer mixed in here — those come from `streamingBrandIds`,
  // selected by id and labelled via the brand registry below.
  const TEXT_INCLUSIONS = useMemo(
    () => allInclusions.filter((item) => !streamingBrands.some((b) => b.name === item)),
    [allInclusions, streamingBrands],
  );
  const brandById = useMemo(() => {
    const m = new Map<number, StreamingBrand>();
    for (const b of streamingBrands) m.set(b.id, b);
    return m;
  }, [streamingBrands]);
  const brandIdByName = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of streamingBrands) m.set(b.name, b.id);
    return m;
  }, [streamingBrands]);

  // Derive the initial form state: keep text-only items in `inclusions` and
  // FK-linked brands as ordered IDs in `streamingBrandIds`. If the incoming
  // plan still has any legacy brand-name strings inside `inclusions` (e.g.
  // before the backfill ran), promote them to brand IDs so the form is
  // immediately ID-driven for the rest of the editing session.
  const initialState = useMemo(() => {
    const textItems: string[] = [];
    const brandIds: number[] = [];
    for (const item of plan.inclusions ?? []) {
      const id = brandIdByName.get(item);
      if (id != null) {
        if (!brandIds.includes(id)) brandIds.push(id);
      } else {
        textItems.push(item);
      }
    }
    const sortedFkBrands = (plan.streamingBrands ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    for (const b of sortedFkBrands) {
      if (!brandIds.includes(b.id)) brandIds.push(b.id);
    }
    return { textItems, brandIds };
    // Only seed once per plan reference; later edits flow through setState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  const [form, setForm] = useState<ApiPlan>({
    ...plan,
    inclusions: initialState.textItems,
  });
  const [streamingBrandIds, setStreamingBrandIds] = useState<number[]>(
    initialState.brandIds,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState<string>("");
  const [cropFileType, setCropFileType] = useState<string>("");
  const [incDragItem, setIncDragItem] = useState<string | null>(null);
  const [incDragOver, setIncDragOver] = useState<string | null>(null);
  const [brandDragId, setBrandDragId] = useState<number | null>(null);
  const [brandDragOverId, setBrandDragOverId] = useState<number | null>(null);

  function reorderInclusion(source: string, target: string) {
    setForm((prev) => {
      const list = [...prev.inclusions];
      const from = list.indexOf(source);
      const to = list.indexOf(target);
      if (from === -1 || to === -1 || from === to) return prev;
      list.splice(from, 1);
      list.splice(to, 0, source);
      return { ...prev, inclusions: list };
    });
  }

  function reorderBrand(sourceId: number, targetId: number) {
    setStreamingBrandIds((prev) => {
      const from = prev.indexOf(sourceId);
      const to = prev.indexOf(targetId);
      if (from === -1 || to === -1 || from === to) return prev;
      const next = [...prev];
      next.splice(from, 1);
      next.splice(to, 0, sourceId);
      return next;
    });
  }

  function toggleBrand(id: number) {
    setStreamingBrandIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const baseUrl = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  useEffect(() => {
    return () => {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
    };
  }, [cropSrc]);

  async function uploadBlob(blob: Blob, name: string, contentType: string) {
    setUploading(true);
    try {
      const reqRes = await fetch(`${baseUrl}/api/storage/uploads/request-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey,
        },
        body: JSON.stringify({
          name,
          size: blob.size,
          contentType,
        }),
      });
      if (!reqRes.ok) throw new Error("Falha ao obter URL de upload.");
      const { uploadURL, objectPath } = await reqRes.json();
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": contentType || "application/octet-stream" },
      });
      if (!putRes.ok) throw new Error("Falha ao enviar a imagem.");
      const servingUrl = `${baseUrl}/api/storage${objectPath}`;
      setForm((p) => ({ ...p, imageUrl: servingUrl }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    const fileType = (file.type || "").toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(fileType)) {
      setUploadError("Formato não suportado. Use PNG, JPG, WEBP, GIF ou SVG.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError("Imagem muito grande. Tamanho máximo: 5 MB.");
      e.target.value = "";
      return;
    }
    // SVGs are vector and shouldn't be rasterized; upload directly without cropping.
    if (fileType === "image/svg+xml") {
      void uploadBlob(file, file.name, file.type);
      e.target.value = "";
      return;
    }
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    setCropFileName(file.name);
    setCropFileType(fileType === "image/png" ? "image/png" : "image/jpeg");
    e.target.value = "";
  }

  function closeCropper() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  async function handleCropConfirm(blob: Blob) {
    const ext = cropFileType === "image/png" ? "png" : "jpg";
    const baseName = cropFileName.replace(/\.[^.]+$/, "") || "plano";
    closeCropper();
    await uploadBlob(blob, `${baseName}-cropped.${ext}`, cropFileType);
  }

  function toggleInclusion(item: string) {
    setForm((prev) => ({
      ...prev,
      inclusions: prev.inclusions.includes(item)
        ? prev.inclusions.filter((i) => i !== item)
        : [...prev.inclusions, item],
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validBrandIds = streamingBrandIds.filter((id) => brandById.has(id));
    const streamingBrandsPayload = validBrandIds.map((id, idx) => {
      const b = brandById.get(id)!;
      return { id, name: b.name, logoUrl: b.logoUrl, sortOrder: idx };
    });
    const payload = {
      ...form,
      streamingBrands: streamingBrandsPayload,
      streamingBrandIds: validBrandIds,
    } as ApiPlan & { streamingBrandIds: number[] };
    if (isNew) {
      const { id: _id, ...rest } = payload;
      onSave(rest);
    } else {
      onSave(payload);
    }
  }

  return (
    <div className="bg-white rounded-xl border-2 border-[#0040FF]/30 px-6 py-5 mb-6">
      <h2 className="font-bold text-[#0D0D0D] mb-4">{isNew ? "Novo Plano" : "Editar Plano"}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#7A7F8C] uppercase tracking-wide mb-1">Velocidade (Mega)</label>
            <input
              type="text"
              value={form.speed}
              onChange={(e) => setForm((p) => ({ ...p, speed: e.target.value }))}
              className="w-full border border-[#E0E3EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
              placeholder="Ex: 600"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#7A7F8C] uppercase tracking-wide mb-1">Preço (R$)</label>
            <input
              type="text"
              value={form.price}
              onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
              className="w-full border border-[#E0E3EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
              placeholder="Ex: 99,90"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#7A7F8C] uppercase tracking-wide mb-1">Wi-Fi</label>
            <input
              type="text"
              value={form.wifi}
              onChange={(e) => setForm((p) => ({ ...p, wifi: e.target.value }))}
              className="w-full border border-[#E0E3EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
              placeholder="Ex: Wi-Fi 6 incluso"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#7A7F8C] uppercase tracking-wide mb-1">Ordem</label>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))}
              className="w-full border border-[#E0E3EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#7A7F8C] uppercase tracking-wide mb-2">Inclusos</label>
          {form.inclusions.length > 0 && (
            <div className="mb-2">
              <p className="text-[11px] text-[#7A7F8C] mb-1.5">Arraste para reordenar — esta é a ordem que aparece no card.</p>
              <div className="flex flex-wrap gap-2">
                {form.inclusions.map((item) => {
                  const isDragging = incDragItem === item;
                  const isOver = incDragOver === item && incDragItem !== item;
                  return (
                    <div
                      key={item}
                      draggable
                      onDragStart={(e) => {
                        setIncDragItem(item);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", item);
                      }}
                      onDragOver={(e) => {
                        if (!incDragItem) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (incDragOver !== item) setIncDragOver(item);
                      }}
                      onDragLeave={() => {
                        if (incDragOver === item) setIncDragOver(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const src = incDragItem;
                        setIncDragItem(null);
                        setIncDragOver(null);
                        if (src) reorderInclusion(src, item);
                      }}
                      onDragEnd={() => {
                        setIncDragItem(null);
                        setIncDragOver(null);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border cursor-grab active:cursor-grabbing transition-all ${
                        isDragging ? "opacity-40" : ""
                      } ${isOver ? "ring-2 ring-[#0040FF]/40" : ""}`}
                      style={{ background: "#00C040", color: "white", borderColor: "#00C040" }}
                      title="Arraste para reordenar"
                      aria-label={`Reordenar ${item}`}
                    >
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 opacity-80" fill="currentColor">
                        <circle cx="9" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/>
                        <circle cx="15" cy="6" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="15" cy="18" r="1.3"/>
                      </svg>
                      <span>{item}</span>
                      <button
                        type="button"
                        onClick={() => toggleInclusion(item)}
                        className="ml-1 -mr-1 w-4 h-4 inline-flex items-center justify-center rounded-full hover:bg-white/20"
                        aria-label={`Remover ${item}`}
                        title="Remover"
                      >
                        <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3">
                          <line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/>
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {TEXT_INCLUSIONS.some((item) => !form.inclusions.includes(item)) && (
            <div>
              <p className="text-[11px] text-[#7A7F8C] mb-1.5">Disponíveis</p>
              <div className="flex flex-wrap gap-2">
                {TEXT_INCLUSIONS.filter((item) => !form.inclusions.includes(item)).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleInclusion(item)}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all border"
                    style={{ background: "white", color: "#2A2D38", borderColor: "#E0E3EB" }}
                  >
                    + {item}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#7A7F8C] uppercase tracking-wide mb-2">Marcas de streaming</label>
          {streamingBrandIds.length > 0 && (
            <div className="mb-2">
              <p className="text-[11px] text-[#7A7F8C] mb-1.5">Arraste para reordenar — esta é a ordem que aparece no card.</p>
              <div className="flex flex-wrap gap-2">
                {streamingBrandIds.map((id) => {
                  const brand = brandById.get(id);
                  if (!brand) return null;
                  const isDragging = brandDragId === id;
                  const isOver = brandDragOverId === id && brandDragId !== id;
                  return (
                    <div
                      key={id}
                      draggable
                      onDragStart={(e) => {
                        setBrandDragId(id);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", String(id));
                      }}
                      onDragOver={(e) => {
                        if (brandDragId == null) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (brandDragOverId !== id) setBrandDragOverId(id);
                      }}
                      onDragLeave={() => {
                        if (brandDragOverId === id) setBrandDragOverId(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const src = brandDragId;
                        setBrandDragId(null);
                        setBrandDragOverId(null);
                        if (src != null) reorderBrand(src, id);
                      }}
                      onDragEnd={() => {
                        setBrandDragId(null);
                        setBrandDragOverId(null);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border cursor-grab active:cursor-grabbing transition-all ${
                        isDragging ? "opacity-40" : ""
                      } ${isOver ? "ring-2 ring-[#0040FF]/40" : ""}`}
                      style={{ background: "#0040FF", color: "white", borderColor: "#0040FF" }}
                      title="Arraste para reordenar"
                      aria-label={`Reordenar ${brand.name}`}
                    >
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 opacity-80" fill="currentColor">
                        <circle cx="9" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/>
                        <circle cx="15" cy="6" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="15" cy="18" r="1.3"/>
                      </svg>
                      <span>{brand.name}</span>
                      <button
                        type="button"
                        onClick={() => toggleBrand(id)}
                        className="ml-1 -mr-1 w-4 h-4 inline-flex items-center justify-center rounded-full hover:bg-white/20"
                        aria-label={`Remover ${brand.name}`}
                        title="Remover"
                      >
                        <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3">
                          <line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/>
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {streamingBrands.some((b) => !streamingBrandIds.includes(b.id)) && (
            <div>
              <p className="text-[11px] text-[#7A7F8C] mb-1.5">Disponíveis</p>
              <div className="flex flex-wrap gap-2">
                {streamingBrands
                  .filter((b) => !streamingBrandIds.includes(b.id))
                  .map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => toggleBrand(b.id)}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all border"
                      style={{ background: "white", color: "#2A2D38", borderColor: "#E0E3EB" }}
                    >
                      + {b.name}
                    </button>
                  ))}
              </div>
            </div>
          )}
          {streamingBrands.length === 0 && (
            <p className="text-[11px] text-[#7A7F8C]">Nenhuma marca cadastrada. Cadastre marcas em "Marcas de streaming".</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#7A7F8C] uppercase tracking-wide mb-2">
            Imagem do plano (opcional)
          </label>
          <div className="flex flex-col sm:flex-row gap-3 items-start">
            {form.imageUrl && (
              <div className="flex-shrink-0">
                <div
                  className="w-48 rounded-lg overflow-hidden border border-[#E0E3EB] bg-[#EEF0F5]"
                  style={{ aspectRatio: "16 / 9" }}
                  title="Pré-visualização (16:9, igual ao card da home)"
                >
                  <img
                    src={form.imageUrl}
                    alt="Pré-visualização"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}
            <div className="flex-1 w-full space-y-2">
              <input
                type="text"
                value={form.imageUrl ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, imageUrl: e.target.value || null }))}
                className="w-full border border-[#E0E3EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
                placeholder="Cole uma URL de imagem ou envie um arquivo"
              />
              <div className="flex items-center gap-3 flex-wrap">
                <label
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer border transition-colors ${
                    uploading
                      ? "opacity-60 cursor-not-allowed border-[#E0E3EB] text-[#7A7F8C]"
                      : "border-[#0040FF]/30 text-[#0040FF] hover:bg-[#0040FF]/5"
                  }`}
                >
                  {uploading ? "Enviando..." : "Enviar imagem"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
                {form.imageUrl && (
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, imageUrl: null }))}
                    className="text-sm text-red-500 hover:text-red-600 transition-colors"
                  >
                    Remover
                  </button>
                )}
              </div>
              {uploadError && <p className="text-red-500 text-xs">{uploadError}</p>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#7A7F8C] uppercase tracking-wide mb-1">Bônus (opcional)</label>
            <input
              type="text"
              value={form.bonus ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, bonus: e.target.value || null }))}
              className="w-full border border-[#E0E3EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
              placeholder="Ex: Assinatura Inclusa — Watch"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#7A7F8C] uppercase tracking-wide mb-1">Badge (opcional)</label>
            <input
              type="text"
              value={form.badge ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, badge: e.target.value || null }))}
              className="w-full border border-[#E0E3EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
              placeholder="Ex: Mais Vendido"
            />
          </div>
        </div>

        <div className="border-t border-[#E0E3EB] pt-4">
          <h3 className="text-sm font-bold text-[#0D0D0D] mb-1">Página de compartilhamento (WhatsApp)</h3>
          <p className="text-[11px] text-[#7A7F8C] mb-3">
            Personalize o texto e o destino do link compartilhado deste plano. Deixe em branco para usar os padrões.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#7A7F8C] uppercase tracking-wide mb-1">Título (acima do plano)</label>
              <input
                type="text"
                value={form.shareHeadline ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, shareHeadline: e.target.value || null }))}
                className="w-full border border-[#E0E3EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
                placeholder="Padrão: Internet 100% Fibra"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#7A7F8C] uppercase tracking-wide mb-1">Texto do botão (CTA)</label>
              <input
                type="text"
                value={form.shareCtaText ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, shareCtaText: e.target.value || null }))}
                className="w-full border border-[#E0E3EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
                placeholder="Padrão: Assinar pelo WhatsApp"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#7A7F8C] uppercase tracking-wide mb-1">Sub-texto (descrição extra)</label>
              <textarea
                value={form.shareSubcopy ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, shareSubcopy: e.target.value || null }))}
                className="w-full border border-[#E0E3EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
                placeholder="Ex: Promoção válida por tempo limitado em Vitória da Conquista."
                rows={2}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#7A7F8C] uppercase tracking-wide mb-1">Número de WhatsApp do destino</label>
              <input
                type="text"
                value={form.whatsappNumber ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, whatsappNumber: e.target.value || null }))}
                className="w-full border border-[#E0E3EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
                placeholder="Ex: 5577998444757 (com DDI + DDD). Em branco usa o padrão."
              />
              <p className="text-[11px] text-[#7A7F8C] mt-1">Apenas números. Formato internacional, sem espaços ou símbolos.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => setForm((p) => ({ ...p, featured: e.target.checked }))}
              className="w-4 h-4 rounded accent-green-500"
            />
            <span className="text-sm font-medium text-[#2A2D38]">Plano em destaque (borda verde)</span>
          </label>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-[#E0E3EB]">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-lg text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: "#0040FF" }}
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 rounded-lg text-sm font-medium text-[#7A7F8C] hover:text-[#0D0D0D] transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
      {cropSrc && (
        <ImageCropper
          src={cropSrc}
          aspect={PLAN_IMAGE_ASPECT}
          maxOutputWidth={PLAN_IMAGE_MAX_WIDTH}
          outputType={cropFileType || "image/jpeg"}
          onCancel={closeCropper}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  );
}

type StreamingBrandsManagerProps = {
  brands: StreamingBrand[];
  adminKey: string;
  baseUrl: string;
  onChange: () => Promise<void> | void;
};

type AffectedPlan = { id: number; speed: string; price: string };

function StreamingBrandsManager({ brands, adminKey, baseUrl, onChange }: StreamingBrandsManagerProps) {
  const [editing, setEditing] = useState<StreamingBrand | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const [orderedBrands, setOrderedBrands] = useState<StreamingBrand[]>(brands);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);
  const [affectedPlans, setAffectedPlans] = useState<AffectedPlan[]>([]);
  const [affectedLoading, setAffectedLoading] = useState(false);
  const usagesAbortRef = useRef<AbortController | null>(null);
  const [renameSummary, setRenameSummary] = useState<
    { oldName: string; newName: string; plans: AffectedPlan[] } | null
  >(null);
  const [deleteUsages, setDeleteUsages] = useState<AffectedPlan[]>([]);
  const [deleteUsagesLoading, setDeleteUsagesLoading] = useState(false);
  const [deleteUsagesError, setDeleteUsagesError] = useState<string | null>(null);
  const deleteUsagesAbortRef = useRef<AbortController | null>(null);
  const [deleteSummary, setDeleteSummary] = useState<
    { brandName: string; plans: AffectedPlan[] } | null
  >(null);

  useEffect(() => {
    setOrderedBrands(brands);
  }, [brands]);

  async function persistOrder(next: StreamingBrand[]) {
    const previous = orderedBrands;
    setOrderedBrands(next);
    setReordering(true);
    setErr(null);
    try {
      const res = await fetch(`${baseUrl}/api/streaming-brands/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Admin-Key": adminKey },
        body: JSON.stringify({ order: next.map((b) => b.id) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      await onChange();
    } catch (e) {
      setOrderedBrands(previous);
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setReordering(false);
    }
  }

  function handleDrop(targetId: number) {
    const sourceId = dragId;
    setDragId(null);
    setDragOverId(null);
    if (sourceId == null || sourceId === targetId) return;
    const sourceIdx = orderedBrands.findIndex((b) => b.id === sourceId);
    const targetIdx = orderedBrands.findIndex((b) => b.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;
    const next = [...orderedBrands];
    const [moved] = next.splice(sourceIdx, 1);
    next.splice(targetIdx, 0, moved!);
    void persistOrder(next);
  }

  function startCreate() {
    setCreating(true);
    setEditing(null);
    setName("");
    setLogoUrl("");
    setErr(null);
  }

  function startEdit(b: StreamingBrand) {
    setEditing(b);
    setCreating(false);
    setName(b.name);
    setLogoUrl(b.logoUrl ?? "");
    setErr(null);
    setAffectedPlans([]);
    setRenameSummary(null);
    usagesAbortRef.current?.abort();
    const controller = new AbortController();
    usagesAbortRef.current = controller;
    setAffectedLoading(true);
    void (async () => {
      try {
        const res = await fetch(`${baseUrl}/api/streaming-brands/${b.id}/usages`, {
          headers: { "X-Admin-Key": adminKey },
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { plans: AffectedPlan[] };
        if (controller.signal.aborted) return;
        setAffectedPlans(data.plans ?? []);
      } catch {
        /* ignore (including aborts) */
      } finally {
        if (!controller.signal.aborted) setAffectedLoading(false);
      }
    })();
  }

  function cancel() {
    usagesAbortRef.current?.abort();
    usagesAbortRef.current = null;
    setEditing(null);
    setCreating(false);
    setName("");
    setLogoUrl("");
    setErr(null);
    setAffectedPlans([]);
    setAffectedLoading(false);
  }

  useEffect(() => {
    return () => {
      usagesAbortRef.current?.abort();
      deleteUsagesAbortRef.current?.abort();
    };
  }, []);

  function startDeleteConfirm(b: StreamingBrand) {
    setConfirmDel(b.id);
    setErr(null);
    setDeleteSummary(null);
    setDeleteUsages([]);
    setDeleteUsagesError(null);
    deleteUsagesAbortRef.current?.abort();
    const controller = new AbortController();
    deleteUsagesAbortRef.current = controller;
    setDeleteUsagesLoading(true);
    void (async () => {
      try {
        const res = await fetch(`${baseUrl}/api/streaming-brands/${b.id}/usages`, {
          headers: { "X-Admin-Key": adminKey },
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (!res.ok) {
          setDeleteUsagesError(
            "Não foi possível verificar quais planos usam esta marca. Tente novamente.",
          );
          return;
        }
        const data = (await res.json()) as { plans: AffectedPlan[] };
        if (controller.signal.aborted) return;
        setDeleteUsages(data.plans ?? []);
      } catch (e) {
        if (controller.signal.aborted) return;
        if (e instanceof Error && e.name === "AbortError") return;
        setDeleteUsagesError(
          "Não foi possível verificar quais planos usam esta marca. Tente novamente.",
        );
      } finally {
        if (!controller.signal.aborted) setDeleteUsagesLoading(false);
      }
    })();
  }

  function cancelDeleteConfirm() {
    deleteUsagesAbortRef.current?.abort();
    deleteUsagesAbortRef.current = null;
    setConfirmDel(null);
    setDeleteUsages([]);
    setDeleteUsagesLoading(false);
    setDeleteUsagesError(null);
  }

  async function handleLogoUpload(file: File) {
    if (!file) return;
    setErr(null);
    const fileType = (file.type || "").toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(fileType)) {
      setErr("Formato não suportado. Use PNG, JPG, WEBP, GIF ou SVG.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setErr("Imagem muito grande. Tamanho máximo: 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const reqRes = await fetch(`${baseUrl}/api/storage/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Key": adminKey },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!reqRes.ok) throw new Error("Falha ao obter URL de upload.");
      const { uploadURL, objectPath } = await reqRes.json();
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!putRes.ok) throw new Error("Falha ao enviar a imagem.");
      setLogoUrl(`${baseUrl}/api/storage${objectPath}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const trimmedName = name.trim();
      const oldName = editing?.name ?? "";
      const body = JSON.stringify({
        name: trimmedName,
        logoUrl: logoUrl.trim() || null,
      });
      const url = editing
        ? `${baseUrl}/api/streaming-brands/${editing.id}`
        : `${baseUrl}/api/streaming-brands`;
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "X-Admin-Key": adminKey },
        body,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json().catch(() => ({}));
      const renamedPlans: AffectedPlan[] = Array.isArray(data?.renamedPlans)
        ? data.renamedPlans
        : [];
      await onChange();
      cancel();
      if (editing && oldName && oldName !== trimmedName) {
        setRenameSummary({ oldName, newName: trimmedName, plans: renamedPlans });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`${baseUrl}/api/streaming-brands/${id}`, {
        method: "DELETE",
        headers: { "X-Admin-Key": adminKey },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json().catch(() => ({}));
      const updatedPlans: AffectedPlan[] = Array.isArray(data?.updatedPlans)
        ? data.updatedPlans
        : [];
      const brandName: string =
        typeof data?.brandName === "string" && data.brandName
          ? data.brandName
          : orderedBrands.find((b) => b.id === id)?.name ?? "";
      await onChange();
      cancelDeleteConfirm();
      setDeleteSummary({ brandName, plans: updatedPlans });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const isEditingForm = creating || editing !== null;

  return (
    <div className="bg-white rounded-xl border border-[#E0E3EB] px-5 py-5 mb-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="font-bold text-[#0D0D0D] text-base">
            Marcas de streaming
            {reordering && <span className="ml-2 text-[#0040FF] font-medium text-xs">Salvando ordem...</span>}
          </h2>
          <p className="text-xs text-[#7A7F8C] mt-0.5">
            Adicione, renomeie, remova ou arraste para reordenar marcas (ex.: Watch, Power Top, Disney+). O nome aparece como item incluso ao editar um plano e o logo aparece no card.
          </p>
        </div>
        {!isEditingForm && (
          <button
            type="button"
            onClick={startCreate}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold text-white transition-all hover:opacity-90"
            style={{ background: "#0040FF" }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nova marca
          </button>
        )}
      </div>

      {err && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 mb-3 text-sm">
          {err}
        </div>
      )}

      {renameSummary && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-3 py-2 mb-3 text-sm flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold">
              Marca renomeada de "{renameSummary.oldName}" para "{renameSummary.newName}".
            </div>
            <div className="text-[12px] mt-0.5">
              {renameSummary.plans.length === 0
                ? "Nenhum plano precisava ser atualizado."
                : `${renameSummary.plans.length} ${
                    renameSummary.plans.length === 1 ? "plano foi atualizado" : "planos foram atualizados"
                  } automaticamente.`}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRenameSummary(null)}
            className="text-green-700 hover:text-green-900 text-xs font-medium"
          >
            Fechar
          </button>
        </div>
      )}

      {deleteSummary && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-3 py-2 mb-3 text-sm flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold">
              Marca "{deleteSummary.brandName}" excluída.
            </div>
            <div className="text-[12px] mt-0.5">
              {deleteSummary.plans.length === 0
                ? "Nenhum plano precisava ser atualizado."
                : `O nome foi removido dos itens inclusos de ${deleteSummary.plans.length} ${
                    deleteSummary.plans.length === 1 ? "plano" : "planos"
                  }.`}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDeleteSummary(null)}
            className="text-green-700 hover:text-green-900 text-xs font-medium"
            data-testid="streaming-brand-delete-summary-close"
          >
            Fechar
          </button>
        </div>
      )}

      {isEditingForm && (
        <div className="border border-[#0040FF]/30 rounded-lg p-4 mb-4 space-y-3 bg-[#F8FAFF]">
          <h3 className="text-sm font-bold text-[#0D0D0D]">
            {editing ? `Editar marca: ${editing.name}` : "Nova marca de streaming"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#7A7F8C] uppercase tracking-wide mb-1">Nome</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-[#E0E3EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
                placeholder="Ex: Disney+"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#7A7F8C] uppercase tracking-wide mb-1">URL do logo</label>
              <input
                type="text"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="w-full border border-[#E0E3EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
                placeholder="Cole a URL ou envie um arquivo abaixo"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <label
              className={`px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer border transition-colors ${
                uploading
                  ? "opacity-60 cursor-not-allowed border-[#E0E3EB] text-[#7A7F8C]"
                  : "border-[#0040FF]/30 text-[#0040FF] hover:bg-[#0040FF]/5"
              }`}
            >
              {uploading ? "Enviando..." : "Enviar logo"}
              <input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleLogoUpload(f);
                  e.target.value = "";
                }}
                className="hidden"
              />
            </label>
            {logoUrl && (
              <div className="flex items-center gap-2">
                <div className="h-10 px-2 rounded-md bg-[#0040FF] flex items-center">
                  <img src={logoUrl} alt="" className="h-7 w-auto max-w-[160px] object-contain" />
                </div>
                <button
                  type="button"
                  onClick={() => setLogoUrl("")}
                  className="text-sm text-red-500 hover:text-red-600"
                >
                  Remover
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={save}
              disabled={busy || !name.trim()}
              className="px-4 py-2 rounded-lg text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-60"
              style={{ background: "#0040FF" }}
            >
              {busy ? "Salvando..." : editing ? "Salvar alterações" : "Criar marca"}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[#7A7F8C] hover:text-[#0D0D0D]"
            >
              Cancelar
            </button>
          </div>
          {editing && affectedLoading && (
            <p className="text-[11px] text-[#7A7F8C]">Verificando planos que usam esta marca...</p>
          )}
          {editing && !affectedLoading && affectedPlans.length > 0 && name.trim() && name.trim() !== editing.name && (
            <div className="rounded-md bg-[#FFF8E1] border border-[#F0D78C] px-3 py-2 text-[12px] text-[#5A4500]">
              <div className="font-semibold mb-1">
                Ao salvar, {affectedPlans.length}{" "}
                {affectedPlans.length === 1 ? "plano será atualizado" : "planos serão atualizados"} de "{editing.name}" para "{name.trim()}":
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                {affectedPlans.slice(0, 8).map((p) => (
                  <li key={p.id}>
                    {p.speed} — {p.price}
                  </li>
                ))}
                {affectedPlans.length > 8 && (
                  <li>e mais {affectedPlans.length - 8}...</li>
                )}
              </ul>
            </div>
          )}
          {editing && !affectedLoading && affectedPlans.length === 0 && (
            <p className="text-[11px] text-[#7A7F8C]">
              Nenhum plano usa esta marca atualmente.
            </p>
          )}
        </div>
      )}

      {orderedBrands.length === 0 ? (
        <div className="text-center text-sm text-[#7A7F8C] py-6">
          Nenhuma marca cadastrada ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {orderedBrands.map((b) => (
            <div key={b.id} className="space-y-2">
            <div
              draggable={!isEditingForm && !reordering && confirmDel !== b.id}
              onDragStart={(e) => {
                setDragId(b.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(b.id));
              }}
              onDragOver={(e) => {
                if (dragId == null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverId !== b.id) setDragOverId(b.id);
              }}
              onDragLeave={() => {
                if (dragOverId === b.id) setDragOverId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(b.id);
              }}
              onDragEnd={() => {
                setDragId(null);
                setDragOverId(null);
              }}
              className={`flex items-center gap-3 border border-[#E0E3EB] rounded-lg px-3 py-3 transition-all ${
                dragId === b.id ? "opacity-40" : ""
              } ${dragOverId === b.id && dragId !== b.id ? "border-[#0040FF] ring-2 ring-[#0040FF]/20" : ""}`}
              data-testid={`streaming-brand-row-${b.id}`}
            >
              <div
                className="flex-shrink-0 cursor-grab active:cursor-grabbing text-[#7A7F8C] hover:text-[#0040FF] transition-colors"
                title="Arraste para reordenar"
                aria-label="Arraste para reordenar"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                  <circle cx="9" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/>
                  <circle cx="15" cy="6" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
                </svg>
              </div>
              <div className="w-20 h-12 rounded bg-[#0040FF] flex items-center justify-center flex-shrink-0 overflow-hidden">
                {b.logoUrl ? (
                  <img src={b.logoUrl} alt={b.name} className="max-h-10 max-w-[72px] object-contain" />
                ) : (
                  <span className="text-[10px] text-white font-bold">SEM LOGO</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-[#0D0D0D] truncate">{b.name}</div>
                {!b.logoUrl && (
                  <div className="text-[11px] text-[#A06B00]">Logo não definido</div>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => startEdit(b)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium text-[#0040FF] border border-[#0040FF]/20 hover:bg-[#0040FF]/5"
                >
                  Editar
                </button>
                {confirmDel !== b.id && (
                  <button
                    type="button"
                    onClick={() => startDeleteConfirm(b)}
                    className="px-2.5 py-1 rounded-md text-xs font-medium text-red-500 border border-red-200 hover:bg-red-50"
                  >
                    Excluir
                  </button>
                )}
              </div>
            </div>
            {confirmDel === b.id && (
              <div
                className="rounded-md bg-[#FFF1F1] border border-[#F4B5B5] px-3 py-2.5 text-[12px] text-[#7A1F1F] space-y-2"
                data-testid={`streaming-brand-delete-confirm-${b.id}`}
              >
                {deleteUsagesLoading ? (
                  <div>Verificando planos que usam "{b.name}"...</div>
                ) : deleteUsagesError ? (
                  <div className="font-semibold">{deleteUsagesError}</div>
                ) : deleteUsages.length === 0 ? (
                  <div>
                    Nenhum plano usa "{b.name}" atualmente. Deseja realmente excluir esta marca?
                  </div>
                ) : (
                  <div>
                    <div className="font-semibold mb-1">
                      {deleteUsages.length}{" "}
                      {deleteUsages.length === 1 ? "plano ainda usa" : "planos ainda usam"} "{b.name}".
                      Ao excluir, o nome será removido dos itens inclusos
                      {deleteUsages.length === 1 ? " deste plano" : " desses planos"}:
                    </div>
                    <ul className="list-disc pl-5 space-y-0.5">
                      {deleteUsages.slice(0, 8).map((p) => (
                        <li key={p.id}>
                          {p.speed} — {p.price}
                        </li>
                      ))}
                      {deleteUsages.length > 8 && (
                        <li>e mais {deleteUsages.length - 8}...</li>
                      )}
                    </ul>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => remove(b.id)}
                    disabled={busy || deleteUsagesLoading || deleteUsagesError !== null}
                    className="px-2.5 py-1 rounded-md text-xs font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-50"
                    data-testid={`streaming-brand-delete-confirm-button-${b.id}`}
                  >
                    {deleteUsages.length > 0 ? "Excluir mesmo assim" : "Confirmar"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelDeleteConfirm}
                    disabled={busy}
                    className="px-2.5 py-1 rounded-md text-xs font-medium text-[#7A7F8C] hover:text-[#0D0D0D]"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type CtaSettingsManagerProps = {
  settings: AppSettings;
  adminKey: string;
  baseUrl: string;
  onChange: () => void | Promise<void>;
};

function CtaSettingsManager({ settings, adminKey, baseUrl, onChange }: CtaSettingsManagerProps) {
  const [form, setForm] = useState<AppSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const dirty = useMemo(
    () =>
      form.whatsapp_number.trim() !== settings.whatsapp_number ||
      form.cta_subscribe_message.trim() !== settings.cta_subscribe_message ||
      form.cta_unavailable_message.trim() !== settings.cta_unavailable_message,
    [form, settings],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${baseUrl}/api/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey,
        },
        body: JSON.stringify({
          whatsapp_number: form.whatsapp_number.trim(),
          cta_subscribe_message: form.cta_subscribe_message.trim(),
          cta_unavailable_message: form.cta_unavailable_message.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setSavedAt(Date.now());
      await onChange();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar.";
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setForm(settings);
    setErrorMsg(null);
    setSavedAt(null);
  }

  return (
    <section className="bg-white rounded-2xl border border-[#E0E3EB] p-6">
      <header className="mb-5">
        <h2 className="font-bold text-[#0D0D0D] text-base">Configuração de CTAs</h2>
        <p className="text-sm text-[#7A7F8C] mt-1">
          Define o número do WhatsApp e as mensagens enviadas pelos botões dos planos.
          Use os marcadores <code className="px-1 py-0.5 bg-[#F5F7FA] rounded text-[11px]">{"{speed}"}</code>,{" "}
          <code className="px-1 py-0.5 bg-[#F5F7FA] rounded text-[11px]">{"{city}"}</code>,{" "}
          <code className="px-1 py-0.5 bg-[#F5F7FA] rounded text-[11px]">{"{region}"}</code> e{" "}
          <code className="px-1 py-0.5 bg-[#F5F7FA] rounded text-[11px]">{"{place}"}</code>{" "}
          (cidade/UF).
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-[#7A7F8C] uppercase tracking-wide mb-1">
            Número do WhatsApp
          </label>
          <input
            type="text"
            value={form.whatsapp_number}
            onChange={(e) =>
              setForm((p) => ({ ...p, whatsapp_number: e.target.value }))
            }
            placeholder="Ex: 5577998444757"
            className="w-full border border-[#E0E3EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#122AD5]/30"
            data-testid="settings-whatsapp-number"
          />
          <p className="text-[11px] text-[#7A7F8C] mt-1">
            Apenas dígitos, com código do país e DDD (formato wa.me).
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#7A7F8C] uppercase tracking-wide mb-1">
            Mensagem do "ASSINE JÁ" (cidade atendida)
          </label>
          <textarea
            value={form.cta_subscribe_message}
            onChange={(e) =>
              setForm((p) => ({ ...p, cta_subscribe_message: e.target.value }))
            }
            rows={3}
            className="w-full border border-[#E0E3EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#122AD5]/30 resize-y"
            data-testid="settings-cta-subscribe-message"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#7A7F8C] uppercase tracking-wide mb-1">
            Mensagem do "CONSULTAR DISPONIBILIDADE" (cidade fora da cobertura)
          </label>
          <textarea
            value={form.cta_unavailable_message}
            onChange={(e) =>
              setForm((p) => ({ ...p, cta_unavailable_message: e.target.value }))
            }
            rows={3}
            className="w-full border border-[#E0E3EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#122AD5]/30 resize-y"
            data-testid="settings-cta-unavailable-message"
          />
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">
            {errorMsg}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2 border-t border-[#E0E3EB]">
          <button
            type="submit"
            disabled={saving || !dirty}
            className="px-5 py-2 rounded-lg text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: "#122AD5" }}
            data-testid="settings-save"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={saving || !dirty}
            className="px-5 py-2 rounded-lg text-sm font-medium text-[#7A7F8C] hover:text-[#0D0D0D] transition-colors disabled:opacity-50"
          >
            Desfazer
          </button>
          {savedAt && !dirty && (
            <span className="text-xs text-[#0A1995] font-semibold">Salvo!</span>
          )}
        </div>
      </form>
    </section>
  );
}


type DemandInterest = {
  id: number;
  city: string;
  neighborhood: string;
  whatsapp: string;
  createdAt: string;
};

type InterestCity = { city: string; total: number };

type DemandInterestsManagerProps = {
  adminKey: string;
  baseUrl: string;
};

function formatWhatsappDisplay(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("55")) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  if (d.length === 12 && d.startsWith("55")) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  }
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return digits;
}

function whatsappLink(digits: string): string {
  const d = digits.replace(/\D/g, "");
  const withCountry = d.length <= 11 ? `55${d}` : d;
  return `https://wa.me/${withCountry}`;
}

function DemandInterestsManager({ adminKey, baseUrl }: DemandInterestsManagerProps) {
  const [items, setItems] = useState<DemandInterest[]>([]);
  const [cities, setCities] = useState<InterestCity[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const buildParams = useCallback((): URLSearchParams => {
    const params = new URLSearchParams();
    if (cityFilter) params.set("city", cityFilter);
    if (fromDate) {
      const since = new Date(`${fromDate}T00:00:00`);
      if (!Number.isNaN(since.getTime())) params.set("since", since.toISOString());
    }
    if (toDate) {
      const until = new Date(`${toDate}T00:00:00`);
      if (!Number.isNaN(until.getTime())) {
        until.setDate(until.getDate() + 1);
        params.set("until", until.toISOString());
      }
    }
    return params;
  }, [cityFilter, fromDate, toDate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = buildParams();
      const qs = params.toString();
      const [listRes, citiesRes] = await Promise.all([
        fetch(`${baseUrl}/api/demand/interests${qs ? `?${qs}` : ""}`, {
          headers: { "X-Admin-Key": adminKey },
        }),
        fetch(`${baseUrl}/api/demand/interests/cities`, {
          headers: { "X-Admin-Key": adminKey },
        }),
      ]);
      if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`);
      const data: DemandInterest[] = await listRes.json();
      setItems(data);
      if (citiesRes.ok) {
        const cityData: InterestCity[] = await citiesRes.json();
        setCities(cityData);
      }
    } catch {
      setErrorMsg("Não foi possível carregar os interesses.");
    } finally {
      setLoading(false);
    }
  }, [adminKey, baseUrl, buildParams]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  async function exportCsv() {
    try {
      const params = buildParams();
      const qs = params.toString();
      const res = await fetch(
        `${baseUrl}/api/demand/interests/export${qs ? `?${qs}` : ""}`,
        { headers: { "X-Admin-Key": adminKey } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      const slug = cityFilter ? `-${cityFilter.toLowerCase().replace(/\s+/g, "-")}` : "";
      a.download = `interesses${slug}-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setErrorMsg("Não foi possível exportar o CSV.");
    }
  }

  function clearFilters() {
    setCityFilter("");
    setFromDate("");
    setToDate("");
  }

  const totalLabel = items.length === 1 ? "1 cadastro" : `${items.length} cadastros`;

  return (
    <section className="bg-white rounded-2xl border border-[#E0E3EB] p-6">
      <header className="mb-5">
        <h2 className="font-bold text-[#0D0D0D] text-base">Interesses registrados (mapa de demanda)</h2>
        <p className="text-sm text-[#7A7F8C] mt-1">
          Pessoas que registraram interesse em ter fibra na rua delas pela página{" "}
          <code className="px-1 py-0.5 bg-[#F5F7FA] rounded text-[11px]">/demanda</code>.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="flex flex-col gap-1 text-xs text-[#7A7F8C]">
          <span>Cidade</span>
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="border border-[#E0E3EB] rounded-md px-2 py-1.5 bg-white text-sm text-[#2A2D38] min-w-[200px] focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
            data-testid="interest-city-filter"
          >
            <option value="">Todas as cidades</option>
            {cities.map((c) => (
              <option key={c.city} value={c.city}>
                {c.city} ({c.total})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[#7A7F8C]">
          <span>De</span>
          <input
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => setFromDate(e.target.value)}
            className="border border-[#E0E3EB] rounded-md px-2 py-1.5 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
            data-testid="interest-from-date"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[#7A7F8C]">
          <span>Até</span>
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-[#E0E3EB] rounded-md px-2 py-1.5 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
            data-testid="interest-to-date"
          />
        </label>
        {(cityFilter || fromDate || toDate) && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs text-[#7A7F8C] hover:text-[#0D0D0D] underline"
          >
            Limpar filtros
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchData()}
            disabled={loading}
            className="text-xs font-semibold px-3 py-1.5 rounded-md border border-[#E0E3EB] text-[#2A2D38] hover:border-[#0040FF]/50 disabled:opacity-50"
          >
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={items.length === 0}
            className="text-xs font-semibold px-3 py-1.5 rounded-md border border-[#0040FF]/20 text-[#0040FF] hover:bg-[#0040FF]/5 disabled:opacity-50"
            data-testid="interest-export-csv"
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm mb-4">
          {errorMsg}
        </div>
      )}

      <div className="text-xs text-[#7A7F8C] mb-2">{loading ? "Carregando..." : totalLabel}</div>

      {!loading && items.length === 0 ? (
        <div className="text-center text-[#7A7F8C] py-12 border border-dashed border-[#E0E3EB] rounded-xl">
          Nenhum interesse registrado para os filtros selecionados.
        </div>
      ) : (
        <div className="overflow-x-auto border border-[#E0E3EB] rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-[#F5F7FA] text-[#7A7F8C] text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Data</th>
                <th className="text-left px-3 py-2 font-semibold">Cidade</th>
                <th className="text-left px-3 py-2 font-semibold">Bairro/Rua</th>
                <th className="text-left px-3 py-2 font-semibold">WhatsApp</th>
                <th className="text-right px-3 py-2 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const date = new Date(it.createdAt);
                const dateLabel = date.toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <tr key={it.id} className="border-t border-[#E0E3EB] hover:bg-[#F8FAFF]">
                    <td className="px-3 py-2 text-[#2A2D38] whitespace-nowrap">{dateLabel}</td>
                    <td className="px-3 py-2 text-[#0D0D0D] font-medium">{it.city}</td>
                    <td className="px-3 py-2 text-[#2A2D38]">{it.neighborhood}</td>
                    <td className="px-3 py-2 text-[#2A2D38] whitespace-nowrap font-mono text-xs">
                      {formatWhatsappDisplay(it.whatsapp)}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <a
                        href={whatsappLink(it.whatsapp)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md border border-[#25D366]/30 text-[#0E7D3D] hover:bg-[#25D366]/10"
                        data-testid={`interest-open-whatsapp-${it.id}`}
                      >
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                          <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l.6.953-1.005 3.668 3.768-.987.616.407z"/>
                        </svg>
                        Abrir WhatsApp
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

type EmailSubscription = {
  id: number;
  email: string;
  reportType: string;
  frequency: "weekly" | "monthly";
  enabled: boolean;
  lastSentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function EmailReportSubscriptionsManager({
  adminKey,
  baseUrl,
}: {
  adminKey: string;
  baseUrl: string;
}) {
  const [items, setItems] = useState<EmailSubscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [emailConfigured, setEmailConfigured] = useState<boolean>(true);
  const [newEmail, setNewEmail] = useState("");
  const [newFreq, setNewFreq] = useState<"weekly" | "monthly">("weekly");
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `${baseUrl}/api/email-subscriptions/city-comparison`,
        { headers: { "X-Admin-Key": adminKey } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { items: EmailSubscription[]; emailConfigured: boolean } =
        await res.json();
      setItems(data.items);
      setEmailConfigured(data.emailConfigured);
    } catch {
      setErrorMsg("Não foi possível carregar as assinaturas de email.");
    } finally {
      setLoading(false);
    }
  }, [adminKey, baseUrl]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setFeedback(null);
    try {
      const res = await fetch(
        `${baseUrl}/api/email-subscriptions/city-comparison`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Key": adminKey,
          },
          body: JSON.stringify({ email: newEmail.trim(), frequency: newFreq }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string });
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setNewEmail("");
      setNewFreq("weekly");
      setFeedback("Assinatura adicionada.");
      await fetchData();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Não foi possível adicionar.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleEnabled(sub: EmailSubscription) {
    setBusyId(sub.id);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `${baseUrl}/api/email-subscriptions/city-comparison/${sub.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Key": adminKey,
          },
          body: JSON.stringify({ enabled: !sub.enabled }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchData();
    } catch {
      setErrorMsg("Não foi possível atualizar a assinatura.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(sub: EmailSubscription) {
    if (!confirm(`Remover ${sub.email} (${freqLabel(sub.frequency)})?`)) return;
    setBusyId(sub.id);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `${baseUrl}/api/email-subscriptions/city-comparison/${sub.id}`,
        { method: "DELETE", headers: { "X-Admin-Key": adminKey } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchData();
    } catch {
      setErrorMsg("Não foi possível remover a assinatura.");
    } finally {
      setBusyId(null);
    }
  }

  async function sendNow(sub: EmailSubscription) {
    setBusyId(sub.id);
    setErrorMsg(null);
    setFeedback(null);
    try {
      const res = await fetch(
        `${baseUrl}/api/email-subscriptions/city-comparison/${sub.id}/send-now`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Key": adminKey,
          },
          body: JSON.stringify({ frequency: sub.frequency }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string });
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setFeedback(`Email enviado para ${sub.email}.`);
      await fetchData();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Falha ao enviar email.",
      );
    } finally {
      setBusyId(null);
    }
  }

  function freqLabel(f: "weekly" | "monthly"): string {
    return f === "weekly" ? "Semanal (7 dias vs. 7)" : "Mensal (30 dias vs. 30)";
  }

  function formatTimestamp(iso: string | null): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <section className="bg-white rounded-2xl border border-[#E0E3EB] p-6">
      <header className="mb-5">
        <h2 className="font-bold text-[#0D0D0D] text-base">
          Comparativo de cidades por email
        </h2>
        <p className="text-sm text-[#7A7F8C] mt-1">
          Receba automaticamente o CSV de comparação de cidades (mesmo arquivo
          do botão "Exportar CSV" do mapa) com um resumo dos maiores
          crescimentos e quedas. Envio semanal ou mensal.
        </p>
      </header>

      {!emailConfigured && (
        <div
          className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 mb-4 text-sm"
          data-testid="email-not-configured-warning"
        >
          <strong>Envio de email ainda não configurado.</strong> Defina as
          variáveis de ambiente <code>SMTP_HOST</code>, <code>SMTP_PORT</code>,{" "}
          <code>SMTP_USER</code>, <code>SMTP_PASS</code> e{" "}
          <code>SMTP_FROM</code> no servidor para que os relatórios sejam
          enviados. Você pode cadastrar destinatários mesmo assim — eles serão
          enviados assim que o SMTP estiver pronto.
        </div>
      )}

      <form
        onSubmit={handleAdd}
        className="flex flex-wrap items-end gap-3 mb-5 p-4 rounded-xl border border-[#E0E3EB] bg-[#F8FAFF]"
      >
        <label className="flex flex-col gap-1 text-xs text-[#7A7F8C] flex-1 min-w-[220px]">
          <span>Email do destinatário</span>
          <input
            type="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="time@providermaisfibra.com.br"
            className="border border-[#E0E3EB] rounded-md px-3 py-2 bg-white text-sm text-[#0D0D0D] focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
            data-testid="email-subscription-email"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[#7A7F8C]">
          <span>Frequência</span>
          <select
            value={newFreq}
            onChange={(e) =>
              setNewFreq(e.target.value as "weekly" | "monthly")
            }
            className="border border-[#E0E3EB] rounded-md px-3 py-2 bg-white text-sm text-[#0D0D0D] focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
            data-testid="email-subscription-frequency"
          >
            <option value="weekly">Semanal (7 dias vs. 7)</option>
            <option value="monthly">Mensal (30 dias vs. 30)</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={submitting || !newEmail.trim()}
          className="text-sm font-semibold px-4 py-2 rounded-md bg-[#0040FF] text-white hover:bg-[#0033CC] disabled:opacity-50"
          data-testid="email-subscription-add"
        >
          {submitting ? "Adicionando..." : "Adicionar destinatário"}
        </button>
      </form>

      {feedback && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-4 py-2 text-sm mb-4">
          {feedback}
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm mb-4">
          {errorMsg}
        </div>
      )}

      <div className="text-xs text-[#7A7F8C] mb-2">
        {loading
          ? "Carregando..."
          : items.length === 1
            ? "1 destinatário cadastrado"
            : `${items.length} destinatários cadastrados`}
      </div>

      {!loading && items.length === 0 ? (
        <div className="text-center text-[#7A7F8C] py-12 border border-dashed border-[#E0E3EB] rounded-xl">
          Nenhum destinatário cadastrado ainda.
        </div>
      ) : (
        <div className="overflow-x-auto border border-[#E0E3EB] rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-[#F5F7FA] text-[#7A7F8C] text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Email</th>
                <th className="text-left px-3 py-2 font-semibold">Frequência</th>
                <th className="text-left px-3 py-2 font-semibold">Status</th>
                <th className="text-left px-3 py-2 font-semibold">Último envio</th>
                <th className="text-right px-3 py-2 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((sub) => (
                <tr
                  key={sub.id}
                  className="border-t border-[#E0E3EB] hover:bg-[#F8FAFF]"
                  data-testid={`email-subscription-row-${sub.id}`}
                >
                  <td className="px-3 py-2 text-[#0D0D0D] font-medium">
                    {sub.email}
                  </td>
                  <td className="px-3 py-2 text-[#2A2D38]">
                    {freqLabel(sub.frequency)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        sub.enabled
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-[#F5F7FA] text-[#7A7F8C] border border-[#E0E3EB]"
                      }`}
                    >
                      {sub.enabled ? "Ativo" : "Pausado"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[#2A2D38] whitespace-nowrap">
                    {formatTimestamp(sub.lastSentAt)}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <div className="inline-flex flex-wrap gap-1.5 justify-end">
                      <button
                        type="button"
                        onClick={() => void sendNow(sub)}
                        disabled={busyId === sub.id || !emailConfigured}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-md border border-[#0040FF]/30 text-[#0040FF] hover:bg-[#0040FF]/5 disabled:opacity-40 disabled:cursor-not-allowed"
                        title={
                          emailConfigured
                            ? "Enviar agora para testar"
                            : "Configure o SMTP no servidor para enviar"
                        }
                        data-testid={`email-subscription-send-${sub.id}`}
                      >
                        Enviar agora
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleEnabled(sub)}
                        disabled={busyId === sub.id}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-md border border-[#E0E3EB] text-[#2A2D38] hover:border-[#0040FF]/50 disabled:opacity-40"
                        data-testid={`email-subscription-toggle-${sub.id}`}
                      >
                        {sub.enabled ? "Pausar" : "Ativar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(sub)}
                        disabled={busyId === sub.id}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-md border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40"
                        data-testid={`email-subscription-remove-${sub.id}`}
                      >
                        Remover
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

type InterestNotificationSettingsProps = {
  settings: AppSettings;
  adminKey: string;
  baseUrl: string;
  onChange: () => void | Promise<void>;
};

function InterestNotificationSettings({
  settings,
  adminKey,
  baseUrl,
  onChange,
}: InterestNotificationSettingsProps) {
  const [email, setEmail] = useState(settings.interest_notification_email);
  const [enabled, setEnabled] = useState(
    settings.interest_notification_enabled === "true",
  );
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setEmail(settings.interest_notification_email);
    setEnabled(settings.interest_notification_enabled === "true");
  }, [settings.interest_notification_email, settings.interest_notification_enabled]);

  const dirty =
    email.trim() !== settings.interest_notification_email ||
    String(enabled) !== settings.interest_notification_enabled;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${baseUrl}/api/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey,
        },
        body: JSON.stringify({
          interest_notification_email: email.trim(),
          interest_notification_enabled: enabled ? "true" : "false",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setSavedAt(Date.now());
      await onChange();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-[#E0E3EB] p-6">
      <header className="mb-4">
        <h2 className="font-bold text-[#0D0D0D] text-base">
          Notificação por email
        </h2>
        <p className="text-sm text-[#7A7F8C] mt-1">
          Receba um email a cada novo cadastro feito em{" "}
          <code className="px-1 py-0.5 bg-[#F5F7FA] rounded text-[11px]">/demanda</code>,
          com cidade, bairro, WhatsApp e link direto para iniciar a conversa.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-[#7A7F8C] flex-1 min-w-[260px]">
            <span>Email do destinatário</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="time@providermaisfibra.com.br"
              className="border border-[#E0E3EB] rounded-md px-3 py-2 bg-white text-sm text-[#0D0D0D] focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
              data-testid="interest-notification-email"
            />
          </label>
          <label
            className="flex items-center gap-2 text-sm text-[#2A2D38] pb-2"
            data-testid="interest-notification-enabled-label"
          >
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 accent-[#0040FF]"
              data-testid="interest-notification-enabled"
            />
            Enviar emails
          </label>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">
            {errorMsg}
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={saving || !dirty}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: "#122AD5" }}
            data-testid="interest-notification-save"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
          {savedAt && !dirty && (
            <span className="text-xs text-[#0A1995] font-semibold">Salvo!</span>
          )}
          {enabled && !email.trim() && (
            <span className="text-xs text-amber-700">
              Informe um email para começar a receber notificações.
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
