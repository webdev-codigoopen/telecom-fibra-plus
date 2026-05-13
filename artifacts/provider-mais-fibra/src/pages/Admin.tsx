import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { adminFetch, clearCsrfCache } from "../lib/adminFetch";
import { type ApiPlan } from "../hooks/usePlans";
import ImageCropper from "../components/ImageCropper";
import PlanCard, { StreamingBox } from "../components/PlanCard";
import MobilePlansPreview from "../components/MobilePlansPreview";
import { type Plan } from "../lib/plans";
import CityClicksMap from "../components/CityClicksMap";
import CityAccessDashboard from "../components/CityAccessDashboard";
import AdminShell, { type AdminTabId } from "./admin/AdminShell";
import DashboardOverview from "./admin/DashboardOverview";
import WhatsAppOverview from "./admin/WhatsAppOverview";
import CtasAnalytics from "./admin/CtasAnalytics";
import { colorForSource } from "../lib/sourceColors";
import {
  type StreamingBrand,
  refreshStreamingBrands,
} from "../hooks/useStreamingBrands";
import {
  type AppSettings,
  DEFAULT_SETTINGS,
  refreshAppSettings,
  useAppSettings,
} from "../hooks/useAppSettings";
import { loadRecaptcha, getRecaptchaToken } from "../lib/recaptcha";
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

function resolveLogoUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const base = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
  if (!base) return url;
  if (url === base || url.startsWith(`${base}/`)) return url;
  if (url.startsWith("/")) return `${base}${url}`;
  return `${base}/${url}`;
}

const PLAN_IMAGE_ASPECT = 16 / 9;
const PLAN_IMAGE_MAX_WIDTH = 1200;

type CleanupRunRecord = {
  id?: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  ok: boolean;
  rowsRelabeled: number;
  rowsRelabeledByUserAgent: number;
  burstGroupsFound: number;
  windowSeconds: number;
  minBurst: number;
  useUserAgent: boolean;
  trigger?: "manual" | "scheduled";
  error: string | null;
};

type CleanupStatusResponse = {
  status: CleanupRunRecord | null;
  history?: CleanupRunRecord[];
  recordedAt?: string;
};

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
  showBots: boolean;
  cleanupHistoryOpen: boolean;
};

function loadStoredUiState(): StoredUiState {
  const fallback: StoredUiState = {
    chartView: "total",
    previewOpen: true,
    previewMode: "desktop",
    showBots: true,
    cleanupHistoryOpen: false,
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
      showBots: typeof parsed.showBots === "boolean" ? parsed.showBots : fallback.showBots,
      cleanupHistoryOpen:
        typeof parsed.cleanupHistoryOpen === "boolean"
          ? parsed.cleanupHistoryOpen
          : fallback.cleanupHistoryOpen,
    };
  } catch {
    return fallback;
  }
}

type StatsRange = "today" | "week" | "30d" | "90d" | "all" | "custom";

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
      parsed.range === "today" || parsed.range === "week" || parsed.range === "30d" || parsed.range === "90d" || parsed.range === "all" || parsed.range === "custom"
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
  const [emailInput, setEmailInput] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [totpInput, setTotpInput] = useState("");
  const [recoveryInput, setRecoveryInput] = useState("");
  const [requires2fa, setRequires2fa] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
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
  const [showBots, setShowBots] = useState<boolean>(() => loadStoredUiState().showBots);
  const [cleanupHistoryOpen, setCleanupHistoryOpen] = useState<boolean>(
    () => loadStoredUiState().cleanupHistoryOpen,
  );
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);
  const [previewOpen, setPreviewOpen] = useState<boolean>(() => loadStoredUiState().previewOpen);
  const [previewMode, setPreviewMode] = useState<PreviewMode>(() => loadStoredUiState().previewMode);
  const [streamingBrands, setStreamingBrands] = useState<StreamingBrand[]>([]);
  const ADMIN_TAB_STORAGE_KEY = "pmf-admin-active-tab";
  const ADMIN_TAB_VALID: AdminTabId[] = [
    "dashboard", "mapa", "wpp", "ctas", "ctas-config", "planos", "cidades", "bots",
    "interesses", "emails", "seguranca", "marketing", "avaliacoes", "duvidas", "historico",
  ];
  const [activeTab, setActiveTabState] = useState<AdminTabId>(() => {
    if (typeof window === "undefined") return "dashboard";
    const stored = window.localStorage.getItem(ADMIN_TAB_STORAGE_KEY);
    if (stored && (ADMIN_TAB_VALID as string[]).includes(stored)) return stored as AdminTabId;
    return "dashboard";
  });
  const setActiveTab = (id: AdminTabId) => {
    setActiveTabState(id);
    try { window.localStorage.setItem(ADMIN_TAB_STORAGE_KEY, id); } catch { /* ignore */ }
  };
  const [appSettings, setAppSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [previewHealth, setPreviewHealth] = useState<{
    humanPreviews24h: number;
    botPreviews24h: number;
    lastHumanPreviewAt: string | null;
    lastBotFetchAt: string | null;
  } | null>(null);
  const [previewHealthDismissed, setPreviewHealthDismissed] = useState(false);
  const [cleanupStatus, setCleanupStatus] = useState<CleanupStatusResponse | null>(null);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupRunMsg, setCleanupRunMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const baseUrl = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  const publicSettings = useAppSettings();
  const recaptchaEnabled = publicSettings.recaptcha_enabled === "true";
  const recaptchaSiteKey = publicSettings.recaptcha_site_key;

  // Lazy-load reCAPTCHA on the login screen so a token is ready at submit.
  useEffect(() => {
    if (!authed && recaptchaEnabled && recaptchaSiteKey) {
      loadRecaptcha(recaptchaSiteKey).catch(() => {
        /* server will reject without a valid token */
      });
    }
  }, [authed, recaptchaEnabled, recaptchaSiteKey]);

  const fetchAppSettingsAdmin = useCallback(async () => {
    try {
      const res = await adminFetch(`${baseUrl}/api/settings/admin`, {
        headers: { Authorization: `Bearer ${adminKey}` },
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
      const res = await adminFetch(`${baseUrl}/api/streaming-brands`);
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
      const sourceKey = row.source.startsWith("whatsapp-share-bot")
        ? "whatsapp-share-bot"
        : row.source;
      entry.bySource[sourceKey] = (entry.bySource[sourceKey] ?? 0) + row.total;
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
    "whatsapp-share": "WhatsApp share — humanos",
    "whatsapp-share-bot": "WhatsApp share — bots (não conta na conversão)",
  };
  function formatSourceLabel(src: string): string {
    if (sourceLabels[src]) return sourceLabels[src]!;
    if (src.startsWith("whatsapp-share:")) {
      const sub = src.slice("whatsapp-share:".length);
      return `WhatsApp share — humanos (${sub || "sem origem"})`;
    }
    if (src.startsWith("city:")) return `Cidade — ${src.slice(5)}`;
    if (src.startsWith("city-sticky:")) return `Cidade ${src.slice(12)} — Botão flutuante`;
    if (src.startsWith("city-cta-hero:")) return `Cidade ${src.slice(14)} — CTA Hero`;
    return src;
  }

  const visibleChartSources = useMemo(
    () => (showBots ? chartSources : chartSources.filter((s) => s.source !== "whatsapp-share-bot")),
    [chartSources, showBots],
  );

  const displayChartData = useMemo(() => {
    if (showBots) return chartData;
    return chartData.map((point) => {
      const botCount = point.bySource["whatsapp-share-bot"] ?? 0;
      if (botCount === 0) return point;
      return { ...point, total: Math.max(0, point.total - botCount) };
    });
  }, [chartData, showBots]);

  const stackedChartData = useMemo(() => {
    if (chartView !== "source") return [];
    return displayChartData.map((point) => {
      const row: Record<string, string | number> = {
        bucket: point.bucket,
        label: point.label,
        total: point.total,
      };
      for (const { source } of visibleChartSources) {
        row[source] = point.bySource[source] ?? 0;
      }
      return row;
    });
  }, [displayChartData, visibleChartSources, chartView]);

  const chartTotalLabel = useMemo(() => {
    return chartData.reduce((acc, p) => {
      const botCount = showBots ? 0 : p.bySource["whatsapp-share-bot"] ?? 0;
      return acc + p.total - botCount;
    }, 0);
  }, [chartData, showBots]);

  const hasBotSeries = useMemo(
    () => chartSources.some((s) => s.source === "whatsapp-share-bot"),
    [chartSources],
  );

  const fetchClickStats = useCallback(async (
    key: string,
    range: StatsRange = "all",
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
          const daysBack = range === "30d" ? 30 : range === "90d" ? 90 : 7;
          since.setDate(since.getDate() - daysBack);
          prevUntil.setDate(prevUntil.getDate() - daysBack);
          prevSince.setDate(prevSince.getDate() - daysBack * 2);
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

      const [statsRes, sourcesRes, prevRes, tsRes, healthRes, cleanupRes] = await Promise.all([
        adminFetch(url, { headers: { Authorization: `Bearer ${key}` } }),
        adminFetch(`${baseUrl}/api/clicks/sources`, { headers: { Authorization: `Bearer ${key}` } }),
        hasPrevious
          ? adminFetch(prevUrl, { headers: { Authorization: `Bearer ${key}` } })
          : Promise.resolve(null),
        adminFetch(tsUrl, { headers: { Authorization: `Bearer ${key}` } }),
        adminFetch(`${baseUrl}/api/clicks/preview-health`, { headers: { Authorization: `Bearer ${key}` } }),
        adminFetch(`${baseUrl}/api/clicks/cleanup-status`, { headers: { Authorization: `Bearer ${key}` } }),
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
      if (cleanupRes.ok) {
        const data = (await cleanupRes.json()) as typeof cleanupStatus;
        setCleanupStatus(data);
      }
    } catch {
    } finally {
      setClickStatsLoading(false);
    }
  }, [baseUrl]);

  const runCleanupNow = useCallback(async () => {
    if (cleanupRunning) return;
    setCleanupRunning(true);
    setCleanupRunMsg(null);
    try {
      const res = await adminFetch(`${baseUrl}/api/clicks/cleanup-run`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminKey}` },
      });
      if (res.status === 409) {
        setCleanupRunMsg({
          kind: "error",
          text: "Uma limpeza já está em execução. Tente novamente em alguns instantes.",
        });
        return;
      }
      if (!res.ok) {
        setCleanupRunMsg({
          kind: "error",
          text: "Não foi possível executar a limpeza agora. Tente novamente.",
        });
        return;
      }
      const data = (await res.json()) as {
        skipped: boolean;
        status: CleanupStatusResponse["status"];
      };
      if (data.status) {
        const newRun = data.status;
        setCleanupStatus((prev) => {
          const prevHistory = prev?.history ?? [];
          const nextHistory = [newRun, ...prevHistory].slice(0, 7);
          return {
            status: newRun,
            recordedAt: new Date().toISOString(),
            history: nextHistory,
          };
        });
        if (data.status.ok) {
          const rows = data.status.rowsRelabeled;
          const bursts = data.status.burstGroupsFound;
          setCleanupRunMsg({
            kind: "success",
            text: `Limpeza concluída: ${rows.toLocaleString("pt-BR")} ${
              rows === 1 ? "linha reclassificada" : "linhas reclassificadas"
            } em ${bursts.toLocaleString("pt-BR")} ${
              bursts === 1 ? "rajada" : "rajadas"
            }.`,
          });
        } else {
          setCleanupRunMsg({
            kind: "error",
            text: `A limpeza falhou: ${data.status.error ?? "erro desconhecido"}`,
          });
        }
      }
    } catch {
      setCleanupRunMsg({
        kind: "error",
        text: "Falha de conexão ao executar a limpeza.",
      });
    } finally {
      setCleanupRunning(false);
    }
  }, [adminKey, baseUrl, cleanupRunning]);

  const fetchPlans = useCallback(async (key: string) => {
    setLoading(true);
    setError(null);
    try {
      const verify = await adminFetch(`${baseUrl}/api/plans/admin/verify`, {
        headers: { Authorization: `Bearer ${key}` },
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
        adminFetch(`${baseUrl}/api/plans`, { headers: { Authorization: `Bearer ${key}` } }),
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

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoggingIn(true);
    try {
      const body: Record<string, string> = {
        email: emailInput.trim(),
        password: keyInput,
      };
      if (requires2fa) {
        if (useRecovery && recoveryInput.trim()) body["recoveryCode"] = recoveryInput.trim();
        else if (totpInput.trim()) body["totpCode"] = totpInput.trim();
      }
      if (recaptchaEnabled && recaptchaSiteKey) {
        try {
          body["recaptchaToken"] = await getRecaptchaToken(recaptchaSiteKey, "admin_login");
        } catch {
          setError("Não foi possível carregar a verificação anti-robô. Recarregue a página.");
          return;
        }
      }
      const res = await adminFetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (res.status === 429) {
        setError("Muitas tentativas. Aguarde alguns minutos.");
        return;
      }
      if (res.status === 423) {
        const data = await res.json().catch(() => ({} as { error?: string }));
        setError(data.error ?? "Conta bloqueada temporariamente.");
        return;
      }
      const data = await res.json().catch(() => ({} as { token?: string; requires2fa?: boolean; error?: string }));
      if (res.status === 401 && (data as { requires2fa?: boolean }).requires2fa) {
        setRequires2fa(true);
        setError(requires2fa ? "Código inválido." : null);
        return;
      }
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Credenciais inválidas.");
        return;
      }
      const ok = data as { token?: string };
      if (!ok.token) {
        setError("Resposta inválida do servidor.");
        return;
      }
      localStorage.setItem(STORAGE_KEY, ok.token);
      setAdminKey(ok.token);
      setRequires2fa(false);
      setTotpInput("");
      setRecoveryInput("");
      setUseRecovery(false);
      fetchPlans(ok.token);
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoggingIn(false);
    }
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
        JSON.stringify({ chartView, previewOpen, previewMode, showBots, cleanupHistoryOpen }),
      );
    } catch {
      // ignore quota errors
    }
  }, [chartView, previewOpen, previewMode, showBots, cleanupHistoryOpen]);

  async function savePlan(plan: ApiPlan | Omit<ApiPlan, "id">) {
    setSaving(true);
    setSaveError(null);
    try {
      const isCreating = !("id" in plan);
      const url = isCreating
        ? `${baseUrl}/api/plans`
        : `${baseUrl}/api/plans/${(plan as ApiPlan).id}`;
      const method = isCreating ? "POST" : "PUT";
      const res = await adminFetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminKey}`,
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
      const res = await adminFetch(`${baseUrl}/api/plans/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminKey}` },
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
      const res = await adminFetch(`${baseUrl}/api/plans/reorder`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminKey}`,
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
          <Helmet>
            <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
            <title>Painel Admin · Provider Mais Fibra</title>
          </Helmet>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#2A2D38] mb-1">E-mail</label>
              <input
                type="email"
                autoComplete="username"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full border border-[#E0E3EB] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
                placeholder="seu@email.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#2A2D38] mb-1">Senha</label>
              <input
                type="password"
                autoComplete="current-password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                className="w-full border border-[#E0E3EB] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
                placeholder="Digite sua senha"
                required
              />
            </div>
            {requires2fa && !useRecovery && (
              <div>
                <label className="block text-sm font-medium text-[#2A2D38] mb-1">
                  Código do app (6 dígitos)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  autoFocus
                  value={totpInput}
                  onChange={(e) => setTotpInput(e.target.value.replace(/\D/g, ""))}
                  className="w-full border border-[#E0E3EB] rounded-lg px-3 py-2.5 text-sm tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
                  placeholder="000000"
                  required
                />
                <button
                  type="button"
                  onClick={() => { setUseRecovery(true); setTotpInput(""); }}
                  className="mt-2 text-xs text-[#0040FF] hover:underline"
                >
                  Não consigo abrir o app — usar código de recuperação
                </button>
              </div>
            )}
            {requires2fa && useRecovery && (
              <div>
                <label className="block text-sm font-medium text-[#2A2D38] mb-1">
                  Código de recuperação
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  autoFocus
                  value={recoveryInput}
                  onChange={(e) => setRecoveryInput(e.target.value.toUpperCase())}
                  className="w-full border border-[#E0E3EB] rounded-lg px-3 py-2.5 text-sm tracking-wider text-center uppercase focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
                  placeholder="XXXXX-XXXXX"
                  required
                />
                <button
                  type="button"
                  onClick={() => { setUseRecovery(false); setRecoveryInput(""); }}
                  className="mt-2 text-xs text-[#0040FF] hover:underline"
                >
                  Voltar para o código do app
                </button>
              </div>
            )}
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-2.5 rounded-lg font-bold text-sm text-white transition-all duration-200 hover:opacity-90 disabled:opacity-60"
              style={{ background: "#0040FF" }}
            >
              {loggingIn ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  const periodWindow = (() => {
    if (statsRange === "today") {
      const since = new Date(); since.setHours(0, 0, 0, 0);
      return { since: since.toISOString() };
    }
    if (statsRange === "week" || statsRange === "30d" || statsRange === "90d") {
      const days = statsRange === "week" ? 7 : statsRange === "30d" ? 30 : 90;
      const since = new Date(); since.setDate(since.getDate() - days);
      return { since: since.toISOString() };
    }
    if (statsRange === "custom" && customFrom && customTo) {
      const since = new Date(`${customFrom}T00:00:00`);
      const until = new Date(`${customTo}T00:00:00`);
      until.setDate(until.getDate() + 1);
      if (!Number.isNaN(since.getTime()) && !Number.isNaN(until.getTime()) && until > since) {
        return { since: since.toISOString(), until: until.toISOString() };
      }
    }
    return {} as { since?: string; until?: string };
  })();

  const exportClicksCsv = async (kind: "agg" | "raw") => {
    const params = new URLSearchParams();
    if (periodWindow.since) params.set("since", periodWindow.since);
    if (periodWindow.until) params.set("until", periodWindow.until);
    if (cityFilter) params.set("city", cityFilter);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const path = kind === "raw" ? "/api/clicks/export/raw" : "/api/clicks/export";
    try {
      const res = await adminFetch(`${baseUrl}${path}${qs}`, {
        headers: { Authorization: `Bearer ${adminKey}` },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const a = document.createElement("a");
      const url = URL.createObjectURL(blob);
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = kind === "raw" ? `clicks-raw-${stamp}.csv` : `clicks-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  const exportCitiesCsv = async () => {
    const params = new URLSearchParams();
    if (periodWindow.since) params.set("since", periodWindow.since);
    if (periodWindow.until) params.set("until", periodWindow.until);
    const qs = params.toString() ? `?${params.toString()}` : "";
    try {
      const res = await adminFetch(`${baseUrl}/api/clicks/cities-conversion${qs}`, {
        headers: { Authorization: `Bearer ${adminKey}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const rows: Array<{ city?: string; totalClicks?: number; total?: number; conversions?: number }> =
        Array.isArray(data) ? data : (data?.rows ?? []);
      const escape = (val: string | number): string => {
        let s = String(val ?? "");
        if (s.length > 0 && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
        if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
      };
      const total = rows.reduce((acc, r) => acc + (r.totalClicks ?? r.total ?? 0), 0);
      const csvRows = rows
        .map((r) => ({
          city: r.city ?? "",
          clicks: r.totalClicks ?? r.total ?? 0,
          conversions: r.conversions ?? 0,
        }))
        .filter((r) => r.clicks > 0)
        .sort((a, b) => b.clicks - a.clicks)
        .map((r) => [
          escape(r.city),
          escape(r.clicks),
          escape(r.conversions),
          escape(total > 0 ? ((r.clicks / total) * 100).toFixed(1) : "0"),
        ].join(","));
      const csv = "\uFEFF" + ["Cidade,Cliques,Conversões,Participação (%)", ...csvRows].join("\n") + "\n";
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const a = document.createElement("a");
      const url = URL.createObjectURL(blob);
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `cidades-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  const handleAdminLogout = async () => {
    try {
      await adminFetch(`${baseUrl}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      /* ignore */
    }
    clearCsrfCache();
    localStorage.removeItem(STORAGE_KEY);
    setAdminKey("");
    setAuthed(false);
    setKeyInput("");
    setEmailInput("");
  };

  const menuItemStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "8px 12px",
    fontSize: 12,
    background: "transparent",
    border: "none",
    color: "var(--as-text)",
    cursor: "pointer",
  };

  const topbarExtras = (
    <>
      <details style={{ position: "relative" }}>
        <summary
          className="admin-btn-outline"
          style={{ listStyle: "none", cursor: "pointer" }}
          data-testid="admin-export-menu"
        >
          Exportar ▾
        </summary>
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            background: "var(--as-surface)",
            border: "1px solid var(--as-border)",
            borderRadius: "var(--as-radius-sm)",
            boxShadow: "0 4px 12px rgba(0,0,0,.08)",
            zIndex: 30,
            minWidth: 200,
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            onClick={() => void exportClicksCsv("agg")}
            style={menuItemStyle}
            data-testid="admin-export-csv"
          >
            Cliques · CSV (agregado)
          </button>
          <button
            type="button"
            onClick={() => void exportClicksCsv("raw")}
            style={menuItemStyle}
            data-testid="admin-export-csv-raw"
          >
            Cliques · CSV (bruto)
          </button>
          <button
            type="button"
            onClick={() => void exportCitiesCsv()}
            style={menuItemStyle}
            data-testid="admin-export-cities-csv"
          >
            Cidades · CSV
          </button>
        </div>
      </details>
      {activeTab === "planos" && (
        <button
          type="button"
          onClick={() => { setActiveTab("planos"); startNew(); }}
          className="admin-btn-outline"
          style={{ background: "var(--as-blue)", color: "#fff", borderColor: "var(--as-blue)" }}
          data-testid="admin-new-plan"
        >
          + Novo plano
        </button>
      )}
    </>
  );

  return (
    <>
      <Helmet>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700&family=DM+Mono:wght@400;500&display=swap"
        />
      </Helmet>
      <AdminShell
        active={activeTab}
        onChange={setActiveTab}
        period={statsRange}
        onPeriodChange={(p) => {
          setStatsRange(p);
          if (p === "custom") {
            void fetchClickStats(adminKey, p, sourceFilter, customFrom, customTo, cityFilter);
          } else {
            void fetchClickStats(adminKey, p, sourceFilter, "", "", cityFilter);
          }
        }}
        onLogout={handleAdminLogout}
        topbarExtras={topbarExtras}
        customFrom={customFrom}
        customTo={customTo}
        onCustomFromChange={(v) => {
          setCustomFrom(v);
          if (statsRange === "custom" && v && customTo) {
            void fetchClickStats(adminKey, "custom", sourceFilter, v, customTo, cityFilter);
          }
        }}
        onCustomToChange={(v) => {
          setCustomTo(v);
          if (statsRange === "custom" && customFrom && v) {
            void fetchClickStats(adminKey, "custom", sourceFilter, customFrom, v, cityFilter);
          }
        }}
      >
        <main id="main-content" tabIndex={-1} className="focus:outline-none" style={{ outline: "none" }}>
        {loading && (
          <div className="text-center text-[#7A7F8C] py-12">Carregando...</div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-6 text-sm">
            {error}
          </div>
        )}

        {!loading && activeTab === "dashboard" && (
          <DashboardOverview
            adminKey={adminKey}
            baseUrl={baseUrl}
            since={periodWindow.since}
            until={periodWindow.until}
          />
        )}

        {!loading && activeTab === "mapa" && (
          <div className="admin-card" style={{ padding: 0, overflow: "hidden" }}>
            <CityClicksMap
              adminKey={adminKey}
              baseUrl={baseUrl}
              selectedCity={cityFilter}
              onSelectCity={(city) => {
                setCityFilter(city);
                void fetchClickStats(adminKey, statsRange, sourceFilter, customFrom, customTo, city);
              }}
              periodOverride={periodWindow}
            />
          </div>
        )}

        {!loading && activeTab === "wpp" && (
          <WhatsAppOverview
            adminKey={adminKey}
            baseUrl={baseUrl}
            since={periodWindow.since}
            until={periodWindow.until}
          />
        )}

        {!loading && activeTab === "bots" && (
          <BotVsHumanPanel
            adminKey={adminKey}
            baseUrl={baseUrl}
            statsRange={statsRange}
            customFrom={customFrom}
            customTo={customTo}
            cityFilter={cityFilter}
          />
        )}

        {!loading && activeTab === "cidades" && (
          <CityAccessDashboard
            adminKey={adminKey}
            baseUrl={baseUrl}
            since={periodWindow.since}
            until={periodWindow.until}
          />
        )}

        {!loading && activeTab === "ctas" && (
          <CtasAnalytics
            adminKey={adminKey}
            baseUrl={baseUrl}
            since={periodWindow.since}
            until={periodWindow.until}
          />
        )}

        {!loading && activeTab === "ctas-config" && (
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
              adminKey={adminKey}
              baseUrl={baseUrl}
            />
            <QuietHoursSettings
              settings={appSettings}
              adminKey={adminKey}
              baseUrl={baseUrl}
              onChange={fetchAppSettingsAdmin}
            />
            <WhatsappNotifySettings
              settings={appSettings}
              adminKey={adminKey}
              baseUrl={baseUrl}
              onChange={fetchAppSettingsAdmin}
            />
            <DemandInterestsManager adminKey={adminKey} baseUrl={baseUrl} />
          </div>
        )}

        {!loading && activeTab === "emails" && (
          <div className="space-y-6">
            <SmtpSettings
              settings={appSettings}
              adminKey={adminKey}
              baseUrl={baseUrl}
              onChange={fetchAppSettingsAdmin}
            />
            <EmailReportSubscriptionsManager adminKey={adminKey} baseUrl={baseUrl} />
            <BelowTargetDigestManager
              adminKey={adminKey}
              baseUrl={baseUrl}
              settings={appSettings}
              onSettingsChange={fetchAppSettingsAdmin}
            />
            <PreviewHealthAlertSubscriptionsManager
              adminKey={adminKey}
              baseUrl={baseUrl}
            />
          </div>
        )}

        {!loading && activeTab === "seguranca" && (
          <div className="space-y-6">
            <TwoFactorPanel adminKey={adminKey} baseUrl={baseUrl} />
            <RecaptchaSettings
              settings={appSettings}
              adminKey={adminKey}
              baseUrl={baseUrl}
              onChange={fetchAppSettingsAdmin}
            />
            <BotUaPatternsPanel adminKey={adminKey} baseUrl={baseUrl} />
          </div>
        )}

        {!loading && activeTab === "marketing" && (
          <MarketingSettings
            settings={appSettings}
            adminKey={adminKey}
            baseUrl={baseUrl}
            onChange={fetchAppSettingsAdmin}
          />
        )}

        {!loading && activeTab === "avaliacoes" && (
          <div className="space-y-6">
            <ReviewsSettings
              settings={appSettings}
              adminKey={adminKey}
              baseUrl={baseUrl}
              onChange={fetchAppSettingsAdmin}
            />
            <ReviewsManager adminKey={adminKey} baseUrl={baseUrl} />
          </div>
        )}

        {!loading && activeTab === "duvidas" && (
          <FaqManager adminKey={adminKey} baseUrl={baseUrl} />
        )}

        {!loading && activeTab === "historico" && (
          <AuditLogPanel adminKey={adminKey} baseUrl={baseUrl} />
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
                        const res = await adminFetch(
                          `${baseUrl}/api/clicks/export${qs ? `?${qs}` : ""}`,
                          { headers: { Authorization: `Bearer ${adminKey}` } },
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
                        const params = new URLSearchParams();
                        const stamp = new Date().toISOString().slice(0, 10);
                        let filename = `clicks-raw-${stamp}.csv`;
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
                          filename = `clicks-raw-${customFrom}_to_${customTo}.csv`;
                        } else if (statsRange !== "all") {
                          const since = new Date();
                          if (statsRange === "today") {
                            since.setHours(0, 0, 0, 0);
                          } else {
                            since.setDate(since.getDate() - 7);
                          }
                          params.set("since", since.toISOString());
                          const rangeSlug = statsRange === "today" ? "today" : "week";
                          filename = `clicks-raw-${rangeSlug}-${stamp}.csv`;
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
                          filename = filename.replace(/^clicks-raw-/, `clicks-raw-${citySlug}-`);
                        }
                        const qs = params.toString();
                        const res = await adminFetch(
                          `${baseUrl}/api/clicks/export/raw${qs ? `?${qs}` : ""}`,
                          { headers: { Authorization: `Bearer ${adminKey}` } },
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
                      {hasBotSeries && (
                        <button
                          type="button"
                          onClick={() => setShowBots((v) => !v)}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors ${
                            showBots
                              ? "border-[#E0E3EB] text-[#7A7F8C] hover:text-[#0D0D0D] hover:border-[#0040FF]/30"
                              : "border-[#0040FF]/30 bg-[#0040FF]/5 text-[#0040FF]"
                          }`}
                          aria-pressed={!showBots}
                          title="Esconder pré-visualizações de bots para focar no tráfego humano"
                        >
                          {showBots ? "Ocultar bots" : "Mostrar bots"}
                        </button>
                      )}
                      <span className="text-xs text-[#7A7F8C]">
                        Total: {chartTotalLabel}
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
                              const hasBots = ordered.some(
                                (p) => String(p.dataKey) === "whatsapp-share-bot",
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
                                          <span className="truncate">{formatSourceLabel(String(p.dataKey))}</span>
                                        </span>
                                        <span className="font-semibold tabular-nums">{p.value as number}</span>
                                      </div>
                                    ))}
                                  </div>
                                  {hasBots && (
                                    <div className="mt-1.5 pt-1.5 border-t border-[#EEF0F5] text-[10px] text-[#7A7F8C] leading-snug">
                                      Pré-visualizações de bots (WhatsApp/Facebook crawlers) não entram no cálculo de conversão.
                                    </div>
                                  )}
                                </div>
                              );
                            }}
                          />
                          <Legend
                            verticalAlign="bottom"
                            height={28}
                            iconSize={10}
                            wrapperStyle={{ fontSize: 11, color: "#2A2D38" }}
                            formatter={(value) => formatSourceLabel(String(value))}
                          />
                          {visibleChartSources.map(({ source, color }, i) => (
                            <Bar
                              key={source}
                              dataKey={source}
                              stackId="src"
                              fill={color}
                              maxBarSize={48}
                              radius={i === visibleChartSources.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                            />
                          ))}
                        </BarChart>
                      ) : (
                        <BarChart data={displayChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
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
              {cleanupStatus && (
                <div
                  className="rounded-xl border px-4 py-3 mb-3"
                  style={{
                    background: cleanupStatus.status?.ok === false ? "#FFF0F0" : "#F5F7FA",
                    borderColor: cleanupStatus.status?.ok === false ? "#F0B0B0" : "#E0E3EB",
                  }}
                >
                  <div className="flex items-start gap-3 flex-wrap">
                    <div
                      className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0"
                      style={{
                        background:
                          cleanupStatus.status == null
                            ? "#A1A6B0"
                            : cleanupStatus.status.ok
                              ? "#0AAE67"
                              : "#C73838",
                      }}
                      aria-hidden="true"
                    >
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      </svg>
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm font-bold text-[#2A2D38]">
                          Limpeza de pré-visualizações de robôs
                        </span>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background:
                              cleanupStatus.status == null
                                ? "#EEF0F5"
                                : cleanupStatus.status.ok
                                  ? "#D4F4E2"
                                  : "#F8D7D7",
                            color:
                              cleanupStatus.status == null
                                ? "#7A7F8C"
                                : cleanupStatus.status.ok
                                  ? "#0A6B41"
                                  : "#7A1A1A",
                          }}
                        >
                          {cleanupStatus.status == null
                            ? "Ainda não executou"
                            : cleanupStatus.status.ok
                              ? "OK"
                              : "Falhou"}
                        </span>
                        <button
                          type="button"
                          onClick={() => void runCleanupNow()}
                          disabled={cleanupRunning}
                          className="ml-auto text-[11px] font-semibold px-3 py-1 rounded-md border transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          style={{
                            background: cleanupRunning ? "#EEF0F5" : "#2A2D38",
                            color: cleanupRunning ? "#7A7F8C" : "#FFFFFF",
                            borderColor: cleanupRunning ? "#E0E3EB" : "#2A2D38",
                          }}
                        >
                          {cleanupRunning ? "Executando..." : "Executar agora"}
                        </button>
                      </div>
                      {cleanupRunMsg && (
                        <p
                          className="text-[12px] mt-1 leading-relaxed"
                          style={{
                            color: cleanupRunMsg.kind === "success" ? "#0A6B41" : "#7A1A1A",
                          }}
                          role="status"
                          aria-live="polite"
                        >
                          {cleanupRunMsg.text}
                        </p>
                      )}
                      {cleanupStatus.status == null && (
                        <p className="text-[12px] text-[#7A7F8C] mt-1 leading-relaxed">
                          A limpeza noturna ainda não rodou desde que o servidor foi iniciado.
                          Ela é executada automaticamente a cada 24 horas.
                        </p>
                      )}
                      {cleanupStatus.status != null && (
                        <>
                          <p className="text-[12px] text-[#2A2D38] mt-1 leading-relaxed">
                            Última execução em{" "}
                            <strong>
                              {new Date(cleanupStatus.status.finishedAt).toLocaleString("pt-BR")}
                            </strong>{" "}
                            ({Math.max(1, Math.round(cleanupStatus.status.durationMs / 1000))}s).{" "}
                            {cleanupStatus.status.ok ? (
                              <>
                                <strong>{cleanupStatus.status.rowsRelabeled.toLocaleString("pt-BR")}</strong>{" "}
                                {cleanupStatus.status.rowsRelabeled === 1
                                  ? "linha reclassificada"
                                  : "linhas reclassificadas"}{" "}
                                como robô em{" "}
                                <strong>{cleanupStatus.status.burstGroupsFound.toLocaleString("pt-BR")}</strong>{" "}
                                {cleanupStatus.status.burstGroupsFound === 1
                                  ? "rajada detectada"
                                  : "rajadas detectadas"}
                                .
                              </>
                            ) : (
                              <span className="text-[#7A1A1A]">A execução falhou.</span>
                            )}
                          </p>
                          {cleanupStatus.status.error && (
                            <p className="text-[11px] text-[#7A1A1A] mt-1 leading-relaxed">
                              Erro: <code className="text-[11px]">{cleanupStatus.status.error}</code>
                            </p>
                          )}
                        </>
                      )}
                      {cleanupStatus.history && cleanupStatus.history.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-[#E0E3EB]">
                          <div className="flex items-baseline justify-between gap-2 mb-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setCleanupHistoryOpen((o) => !o)}
                              aria-expanded={cleanupHistoryOpen}
                              aria-controls="cleanup-history-panel"
                              className="text-[11px] font-semibold text-[#2A2D38] flex items-center gap-1 hover:text-[#0A6B41] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0A6B41] rounded"
                            >
                              <span
                                aria-hidden="true"
                                className="inline-block transition-transform"
                                style={{
                                  transform: cleanupHistoryOpen ? "rotate(90deg)" : "rotate(0deg)",
                                }}
                              >
                                ▶
                              </span>
                              Histórico recente ({cleanupStatus.history.length}{" "}
                              {cleanupStatus.history.length === 1 ? "execução" : "execuções"})
                            </button>
                            {cleanupHistoryOpen && (
                              <span className="text-[10px] text-[#7A7F8C]">
                                Linhas reclassificadas por execução
                              </span>
                            )}
                          </div>
                          {cleanupHistoryOpen && (() => {
                            const runs = [...cleanupStatus.history].reverse();
                            const maxRows = Math.max(1, ...runs.map((r) => r.rowsRelabeled));
                            return (
                              <div id="cleanup-history-panel">
                                <div className="flex items-end gap-1 h-12 mb-2" aria-label="Sparkline de linhas reclassificadas por execução">
                                  {runs.map((r, idx) => {
                                    const heightPct = r.ok
                                      ? Math.max(6, Math.round((r.rowsRelabeled / maxRows) * 100))
                                      : 100;
                                    const color = !r.ok
                                      ? "#C73838"
                                      : r.rowsRelabeled > 0
                                        ? "#0AAE67"
                                        : "#A1A6B0";
                                    const when = new Date(r.finishedAt).toLocaleString("pt-BR");
                                    return (
                                      <div
                                        key={r.id ?? `${r.finishedAt}-${idx}`}
                                        className="flex-1 rounded-t-sm min-w-[6px]"
                                        style={{
                                          height: `${heightPct}%`,
                                          background: color,
                                          opacity: r.ok ? 0.85 : 1,
                                        }}
                                        title={
                                          r.ok
                                            ? `${when}: ${r.rowsRelabeled.toLocaleString("pt-BR")} reclassificadas em ${r.burstGroupsFound.toLocaleString("pt-BR")} rajadas`
                                            : `${when}: falhou${r.error ? ` — ${r.error}` : ""}`
                                        }
                                      />
                                    );
                                  })}
                                </div>
                                <ul className="text-[11px] text-[#2A2D38] space-y-0.5">
                                  {cleanupStatus.history.slice(0, 7).map((r, idx) => (
                                    <li
                                      key={r.id ?? `${r.finishedAt}-${idx}`}
                                      className="flex items-center gap-2 flex-wrap"
                                    >
                                      <span
                                        className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                                        style={{
                                          background: !r.ok
                                            ? "#C73838"
                                            : r.rowsRelabeled > 0
                                              ? "#0AAE67"
                                              : "#A1A6B0",
                                        }}
                                        aria-hidden="true"
                                      />
                                      <span className="text-[#7A7F8C]">
                                        {new Date(r.finishedAt).toLocaleString("pt-BR")}
                                      </span>
                                      <span
                                        className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide font-semibold"
                                        style={
                                          r.trigger === "manual"
                                            ? { background: "#EEF0F5", color: "#2A2D38" }
                                            : { background: "#F5F7FA", color: "#7A7F8C" }
                                        }
                                        title={
                                          r.trigger === "manual"
                                            ? "Disparada manualmente pelo admin"
                                            : "Execução agendada (automática)"
                                        }
                                      >
                                        {r.trigger === "manual" ? "Manual" : "Agendada"}
                                      </span>
                                      <span className="ml-auto">
                                        {r.ok ? (
                                          <>
                                            <strong>{r.rowsRelabeled.toLocaleString("pt-BR")}</strong>{" "}
                                            reclassif. ·{" "}
                                            <strong>{r.burstGroupsFound.toLocaleString("pt-BR")}</strong>{" "}
                                            rajadas ·{" "}
                                            {Math.max(1, Math.round(r.durationMs / 1000))}s
                                          </>
                                        ) : (
                                          <span className="text-[#7A1A1A]">falhou</span>
                                        )}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
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

            <div className="mb-8">
              <BotVsHumanPanel
                adminKey={adminKey}
                baseUrl={baseUrl}
                statsRange={statsRange}
                customFrom={customFrom}
                customTo={customTo}
                cityFilter={cityFilter}
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
              <div id="plan-edit-form">
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
              </div>
            )}

            <StreamingBrandsManager
              brands={streamingBrands}
              plans={plans}
              adminKey={adminKey}
              baseUrl={baseUrl}
              onChange={fetchStreamingBrands}
              onEditPlan={(planId) => {
                const plan = plans.find((p) => p.id === planId);
                if (!plan) return;
                startEdit(plan);
                requestAnimationFrame(() => {
                  document
                    .getElementById("plan-edit-form")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                });
              }}
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
      </AdminShell>
    </>
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
      const reqRes = await adminFetch(`${baseUrl}/api/storage/uploads/request-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminKey}`,
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
          <label className="block text-xs font-semibold text-[#7A7F8C] uppercase tracking-wide mb-2">Streamings deste plano</label>
          {(() => {
            const previewBrands = streamingBrandIds
              .map((id) => brandById.get(id))
              .filter((b): b is StreamingBrand => Boolean(b));
            return (
              <div
                className="mb-3 rounded-lg border border-[#0040FF]/20 overflow-hidden"
                data-testid="streaming-box-live-preview"
              >
                <div className="flex items-center justify-between px-3 py-1.5 bg-[#F5F6FA] border-b border-[#E0E3EB]">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#7A7F8C]">
                    Pré-visualização do StreamingBox
                  </span>
                  <span className="text-[10px] text-[#7A7F8C]">
                    {previewBrands.length === 0
                      ? "Sem marcas selecionadas"
                      : `${previewBrands.length} ${previewBrands.length === 1 ? "marca" : "marcas"}`}
                  </span>
                </div>
                <div
                  className="px-3 py-3 flex items-center justify-center min-h-[72px]"
                  style={{
                    background: "linear-gradient(135deg, #2C41DA 20%, #172DD8 96%)",
                  }}
                >
                  {previewBrands.length === 0 ? (
                    <span className="text-white/60 text-[11px] italic">
                      Selecione uma marca abaixo para ver o preview
                    </span>
                  ) : (
                    <StreamingBox brands={previewBrands} />
                  )}
                </div>
              </div>
            );
          })()}
          {streamingBrandIds.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] text-[#7A7F8C] mb-1.5">Arraste as miniaturas para reordenar — esta é a ordem que aparece no card.</p>
              <div className="flex flex-wrap gap-2">
                {streamingBrandIds.map((id) => {
                  const brand = brandById.get(id);
                  if (!brand) return null;
                  const isDragging = brandDragId === id;
                  const isOver = brandDragOverId === id && brandDragId !== id;
                  const logoSrc = brand.logoUrl ? resolveLogoUrl(brand.logoUrl) : null;
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
                      className={`relative flex flex-col items-center gap-1 p-2 rounded-lg border-2 cursor-grab active:cursor-grabbing transition-all ${
                        isDragging ? "opacity-40" : ""
                      } ${isOver ? "ring-2 ring-[#0040FF]/40 border-[#0040FF]" : "border-[#0040FF]/30"}`}
                      style={{
                        background: "linear-gradient(135deg, #2C41DA 20%, #172DD8 96%)",
                        width: 110,
                      }}
                      title="Arraste para reordenar"
                      aria-label={`Reordenar ${brand.name}`}
                    >
                      <div className="w-full h-12 flex items-center justify-center px-1 bg-white/5 rounded">
                        {logoSrc ? (
                          <img
                            src={logoSrc}
                            alt={brand.name}
                            className="max-h-10 max-w-full object-contain"
                          />
                        ) : (
                          <span className="text-white text-xs font-bold uppercase tracking-wide text-center leading-tight">
                            {brand.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 w-full">
                        <svg viewBox="0 0 24 24" className="w-3 h-3 text-white/70 flex-shrink-0" fill="currentColor">
                          <circle cx="9" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/>
                          <circle cx="15" cy="6" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="15" cy="18" r="1.3"/>
                        </svg>
                        <span className="text-white text-[11px] font-semibold truncate flex-1">{brand.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleBrand(id)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 inline-flex items-center justify-center rounded-full bg-white border border-[#E0E3EB] shadow-sm hover:bg-red-50 hover:border-red-300 text-[#2A2D38] hover:text-red-600 transition-colors"
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
              <p className="text-[11px] text-[#7A7F8C] mb-1.5">Disponíveis — clique para adicionar</p>
              <div className="flex flex-wrap gap-2">
                {streamingBrands
                  .filter((b) => !streamingBrandIds.includes(b.id))
                  .map((b) => {
                    const logoSrc = b.logoUrl ? resolveLogoUrl(b.logoUrl) : null;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => toggleBrand(b.id)}
                        className="flex flex-col items-center gap-1 p-2 rounded-lg border border-dashed border-[#E0E3EB] hover:border-[#0040FF]/50 hover:bg-[#0040FF]/5 transition-all"
                        style={{ width: 110, background: "white" }}
                        aria-label={`Adicionar ${b.name}`}
                      >
                        <div className="w-full h-12 flex items-center justify-center px-1 bg-[#F5F6FA] rounded">
                          {logoSrc ? (
                            <img
                              src={logoSrc}
                              alt={b.name}
                              className="max-h-10 max-w-full object-contain"
                            />
                          ) : (
                            <span className="text-[#2A2D38] text-xs font-bold uppercase tracking-wide text-center leading-tight">
                              {b.name}
                            </span>
                          )}
                        </div>
                        <span className="text-[#0040FF] text-[11px] font-semibold">+ {b.name}</span>
                      </button>
                    );
                  })}
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
  plans: ApiPlan[];
  adminKey: string;
  baseUrl: string;
  onChange: () => Promise<void> | void;
  onEditPlan: (planId: number) => void;
};

type AffectedPlan = { id: number; speed: string; price: string };

function StreamingBrandsManager({ brands, plans, adminKey, baseUrl, onChange, onEditPlan }: StreamingBrandsManagerProps) {
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
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [viewingPlans, setViewingPlans] = useState<AffectedPlan[]>([]);
  const [viewingLoading, setViewingLoading] = useState(false);
  const [viewingError, setViewingError] = useState<string | null>(null);
  const viewingAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setOrderedBrands(brands);
  }, [brands]);

  useEffect(() => {
    return () => {
      viewingAbortRef.current?.abort();
    };
  }, []);

  function toggleViewPlans(b: StreamingBrand) {
    if (viewingId === b.id) {
      viewingAbortRef.current?.abort();
      viewingAbortRef.current = null;
      setViewingId(null);
      setViewingPlans([]);
      setViewingLoading(false);
      setViewingError(null);
      return;
    }
    viewingAbortRef.current?.abort();
    const controller = new AbortController();
    viewingAbortRef.current = controller;
    setViewingId(b.id);
    setViewingPlans([]);
    setViewingError(null);
    setViewingLoading(true);
    void (async () => {
      try {
        const res = await adminFetch(`${baseUrl}/api/streaming-brands/${b.id}/usages`, {
          headers: { Authorization: `Bearer ${adminKey}` },
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (!res.ok) {
          setViewingError("Não foi possível carregar os planos. Tente novamente.");
          return;
        }
        const data = (await res.json()) as { plans: AffectedPlan[] };
        if (controller.signal.aborted) return;
        setViewingPlans(data.plans ?? []);
      } catch (e) {
        if (controller.signal.aborted) return;
        if (e instanceof Error && e.name === "AbortError") return;
        setViewingError("Não foi possível carregar os planos. Tente novamente.");
      } finally {
        if (!controller.signal.aborted) setViewingLoading(false);
      }
    })();
  }

  function handleEditPlanFromBrand(planId: number) {
    viewingAbortRef.current?.abort();
    viewingAbortRef.current = null;
    setViewingId(null);
    setViewingPlans([]);
    setViewingLoading(false);
    setViewingError(null);
    onEditPlan(planId);
  }

  async function persistOrder(next: StreamingBrand[]) {
    const previous = orderedBrands;
    setOrderedBrands(next);
    setReordering(true);
    setErr(null);
    try {
      const res = await adminFetch(`${baseUrl}/api/streaming-brands/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminKey}` },
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
        const res = await adminFetch(`${baseUrl}/api/streaming-brands/${b.id}/usages`, {
          headers: { Authorization: `Bearer ${adminKey}` },
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
        const res = await adminFetch(`${baseUrl}/api/streaming-brands/${b.id}/usages`, {
          headers: { Authorization: `Bearer ${adminKey}` },
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
      const reqRes = await adminFetch(`${baseUrl}/api/storage/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminKey}` },
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
      const res = await adminFetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminKey}` },
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
      const res = await adminFetch(`${baseUrl}/api/streaming-brands/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminKey}` },
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
                {(() => {
                  const count = b.planCount ?? 0;
                  if (count === 0) {
                    return (
                      <div
                        className="inline-flex items-center gap-1 mt-0.5 text-[11px] font-semibold text-[#A06B00] bg-[#FFF8E1] border border-[#F0D78C] rounded px-1.5 py-0.5"
                        data-testid={`streaming-brand-usage-${b.id}`}
                      >
                        Não usado em nenhum plano
                      </div>
                    );
                  }
                  const expanded = viewingId === b.id;
                  return (
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => toggleViewPlans(b)}
                        aria-expanded={expanded}
                        aria-controls={`streaming-brand-plans-${b.id}`}
                        className="text-[11px] text-[#0040FF] font-medium hover:underline focus:outline-none focus:underline"
                        data-testid={`streaming-brand-usage-${b.id}`}
                      >
                        {count === 1 ? "Usado em 1 plano" : `Usado em ${count} planos`}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleViewPlans(b)}
                        aria-expanded={expanded}
                        aria-controls={`streaming-brand-plans-${b.id}`}
                        className="text-[11px] text-[#0040FF] hover:underline focus:outline-none focus:underline"
                        data-testid={`streaming-brand-view-plans-${b.id}`}
                      >
                        {expanded ? "Ocultar planos" : "Ver planos"}
                      </button>
                    </div>
                  );
                })()}
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
            {viewingId === b.id && (
              <div
                id={`streaming-brand-plans-${b.id}`}
                className="rounded-md bg-[#F8FAFF] border border-[#0040FF]/20 px-3 py-2.5 text-[12px] text-[#0D0D0D] space-y-2"
                data-testid={`streaming-brand-plans-panel-${b.id}`}
              >
                {viewingLoading ? (
                  <div className="text-[#7A7F8C]">Carregando planos que usam "{b.name}"...</div>
                ) : viewingError ? (
                  <div className="text-red-700 font-semibold">{viewingError}</div>
                ) : viewingPlans.length === 0 ? (
                  <div className="text-[#7A7F8C]">
                    Nenhum plano usa "{b.name}" no momento.
                  </div>
                ) : (
                  <>
                    <div className="font-semibold text-[#2A2D38]">
                      Planos que usam "{b.name}":
                    </div>
                    <ul className="space-y-1.5">
                      {viewingPlans.map((p) => {
                        const exists = plans.some((pl) => pl.id === p.id);
                        return (
                          <li
                            key={p.id}
                            className="flex items-center justify-between gap-2 bg-white border border-[#E0E3EB] rounded px-2.5 py-1.5"
                          >
                            <span className="truncate">
                              <span className="font-bold text-[#0040FF]">{p.speed}</span>
                              <span className="text-[#7A7F8C]"> · R$ {p.price}/mês</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleEditPlanFromBrand(p.id)}
                              disabled={!exists}
                              title={exists ? undefined : "Plano não disponível nesta lista"}
                              className="px-2 py-0.5 rounded text-[11px] font-medium text-[#0040FF] border border-[#0040FF]/20 hover:bg-[#0040FF]/5 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                              data-testid={`streaming-brand-edit-plan-${b.id}-${p.id}`}
                            >
                              Editar plano
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
            )}
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
      const res = await adminFetch(`${baseUrl}/api/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminKey}`,
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


type InterestStatus = "novo" | "contatado" | "convertido" | "sem_retorno";

type DemandInterest = {
  id: number;
  city: string;
  neighborhood: string;
  whatsapp: string;
  status: InterestStatus;
  note: string | null;
  createdAt: string;
  updatedAt?: string;
};

const STATUS_OPTIONS: { value: InterestStatus; label: string; badge: string }[] = [
  { value: "novo", label: "Novo", badge: "bg-[#E0E7FF] text-[#1E3A8A] border-[#C7D2FE]" },
  { value: "contatado", label: "Contatado", badge: "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]" },
  { value: "convertido", label: "Convertido", badge: "bg-[#D1FAE5] text-[#065F46] border-[#A7F3D0]" },
  { value: "sem_retorno", label: "Sem retorno", badge: "bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]" },
];

function statusMeta(s: InterestStatus): { label: string; badge: string } {
  return STATUS_OPTIONS.find((o) => o.value === s) ?? STATUS_OPTIONS[0]!;
}

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
  const [statusFilter, setStatusFilter] = useState<"" | InterestStatus>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>("");

  const buildParams = useCallback((): URLSearchParams => {
    const params = new URLSearchParams();
    if (cityFilter) params.set("city", cityFilter);
    if (statusFilter) params.set("status", statusFilter);
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
  }, [cityFilter, statusFilter, fromDate, toDate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = buildParams();
      const qs = params.toString();
      const [listRes, citiesRes] = await Promise.all([
        adminFetch(`${baseUrl}/api/demand/interests${qs ? `?${qs}` : ""}`, {
          headers: { Authorization: `Bearer ${adminKey}` },
        }),
        adminFetch(`${baseUrl}/api/demand/interests/cities`, {
          headers: { Authorization: `Bearer ${adminKey}` },
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

  async function updateInterest(
    id: number,
    patch: { status?: InterestStatus; note?: string | null },
  ): Promise<boolean> {
    setSavingId(id);
    setErrorMsg(null);
    try {
      const res = await adminFetch(`${baseUrl}/api/demand/interests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminKey}` },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated: { status: InterestStatus; note: string | null; updatedAt: string } = await res.json();
      setItems((prev) =>
        prev.map((it) =>
          it.id === id ? { ...it, status: updated.status, note: updated.note, updatedAt: updated.updatedAt } : it,
        ),
      );
      return true;
    } catch {
      setErrorMsg("Não foi possível salvar a alteração.");
      return false;
    } finally {
      setSavingId(null);
    }
  }

  function startNoteEdit(it: DemandInterest) {
    setEditingNoteId(it.id);
    setNoteDraft(it.note ?? "");
  }

  async function saveNote(id: number) {
    const ok = await updateInterest(id, { note: noteDraft });
    if (ok) {
      setEditingNoteId(null);
      setNoteDraft("");
    }
  }

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  async function exportCsv() {
    try {
      const params = buildParams();
      const qs = params.toString();
      const res = await adminFetch(
        `${baseUrl}/api/demand/interests/export${qs ? `?${qs}` : ""}`,
        { headers: { Authorization: `Bearer ${adminKey}` } },
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
    setStatusFilter("");
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
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | InterestStatus)}
            className="border border-[#E0E3EB] rounded-md px-2 py-1.5 bg-white text-sm text-[#2A2D38] min-w-[160px] focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
            data-testid="interest-status-filter"
          >
            <option value="">Todos os status</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
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
        {(cityFilter || statusFilter || fromDate || toDate) && (
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
                <th className="text-left px-3 py-2 font-semibold">Status</th>
                <th className="text-left px-3 py-2 font-semibold">Nota</th>
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
                const meta = statusMeta(it.status);
                const isEditingNote = editingNoteId === it.id;
                const isSaving = savingId === it.id;
                return (
                  <tr key={it.id} className="border-t border-[#E0E3EB] hover:bg-[#F8FAFF]">
                    <td className="px-3 py-2 text-[#2A2D38] whitespace-nowrap">{dateLabel}</td>
                    <td className="px-3 py-2 text-[#0D0D0D] font-medium">{it.city}</td>
                    <td className="px-3 py-2 text-[#2A2D38]">{it.neighborhood}</td>
                    <td className="px-3 py-2 text-[#2A2D38] whitespace-nowrap font-mono text-xs">
                      {formatWhatsappDisplay(it.whatsapp)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="relative inline-block">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${meta.badge}`}
                          data-testid={`interest-status-badge-${it.id}`}
                        >
                          {meta.label}
                        </span>
                        <select
                          aria-label="Atualizar status"
                          value={it.status}
                          disabled={isSaving}
                          onChange={(e) => void updateInterest(it.id, { status: e.target.value as InterestStatus })}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          data-testid={`interest-status-select-${it.id}`}
                        >
                          {STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[#2A2D38] max-w-[260px]">
                      {isEditingNote ? (
                        <div className="flex items-start gap-1">
                          <textarea
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value.slice(0, 500))}
                            rows={2}
                            className="flex-1 border border-[#E0E3EB] rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
                            placeholder="Ex.: Falei dia 12, vai pensar"
                            data-testid={`interest-note-input-${it.id}`}
                            autoFocus
                          />
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              onClick={() => void saveNote(it.id)}
                              disabled={isSaving}
                              className="text-[11px] font-semibold px-2 py-0.5 rounded border border-[#0040FF]/30 text-[#0040FF] hover:bg-[#0040FF]/5 disabled:opacity-50"
                              data-testid={`interest-note-save-${it.id}`}
                            >
                              Salvar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNoteId(null);
                                setNoteDraft("");
                              }}
                              className="text-[11px] text-[#7A7F8C] hover:text-[#0D0D0D]"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startNoteEdit(it)}
                          className="text-left text-xs text-[#2A2D38] hover:text-[#0040FF] w-full min-h-[1.25rem]"
                          data-testid={`interest-note-${it.id}`}
                        >
                          {it.note ? (
                            <span className="whitespace-pre-wrap">{it.note}</span>
                          ) : (
                            <span className="text-[#9CA3AF] italic">Adicionar nota…</span>
                          )}
                        </button>
                      )}
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
      const res = await adminFetch(
        `${baseUrl}/api/email-subscriptions/city-comparison`,
        { headers: { Authorization: `Bearer ${adminKey}` } },
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
      const res = await adminFetch(
        `${baseUrl}/api/email-subscriptions/city-comparison`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminKey}`,
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
      const res = await adminFetch(
        `${baseUrl}/api/email-subscriptions/city-comparison/${sub.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminKey}`,
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
      const res = await adminFetch(
        `${baseUrl}/api/email-subscriptions/city-comparison/${sub.id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${adminKey}` } },
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
      const res = await adminFetch(
        `${baseUrl}/api/email-subscriptions/city-comparison/${sub.id}/send-now`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminKey}`,
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

type BelowTargetSubscription = {
  id: number;
  email: string;
  reportType: string;
  frequency: "daily" | "weekly";
  enabled: boolean;
  lastSentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function belowTargetFreqLabel(f: "daily" | "weekly"): string {
  return f === "daily" ? "Diário" : "Semanal";
}

function BelowTargetDigestManager({
  adminKey,
  baseUrl,
  settings,
  onSettingsChange,
}: {
  adminKey: string;
  baseUrl: string;
  settings: AppSettings;
  onSettingsChange: () => void | Promise<void>;
}) {
  const [items, setItems] = useState<BelowTargetSubscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [emailConfigured, setEmailConfigured] = useState<boolean>(true);
  const [newEmail, setNewEmail] = useState("");
  const [newFreq, setNewFreq] = useState<"daily" | "weekly">("daily");
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [defaultPct, setDefaultPct] = useState(
    settings.below_target_default_pct || "10",
  );
  const [minPreviews, setMinPreviews] = useState(
    settings.below_target_min_previews || "5",
  );
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    setDefaultPct(settings.below_target_default_pct || "10");
    setMinPreviews(settings.below_target_min_previews || "5");
  }, [settings.below_target_default_pct, settings.below_target_min_previews]);

  const settingsDirty =
    defaultPct.trim() !== (settings.below_target_default_pct || "10").trim() ||
    minPreviews.trim() !== (settings.below_target_min_previews || "5").trim();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await adminFetch(
        `${baseUrl}/api/email-subscriptions/city-below-target`,
        { headers: { Authorization: `Bearer ${adminKey}` } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { items: BelowTargetSubscription[]; emailConfigured: boolean } =
        await res.json();
      setItems(data.items);
      setEmailConfigured(data.emailConfigured);
    } catch {
      setErrorMsg("Não foi possível carregar as assinaturas.");
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
      const res = await adminFetch(
        `${baseUrl}/api/email-subscriptions/city-below-target`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminKey}`,
          },
          body: JSON.stringify({ email: newEmail.trim(), frequency: newFreq }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string });
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setNewEmail("");
      setNewFreq("daily");
      setFeedback("Assinatura adicionada.");
      await fetchData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Não foi possível adicionar.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleEnabled(sub: BelowTargetSubscription) {
    setBusyId(sub.id);
    setErrorMsg(null);
    try {
      const res = await adminFetch(
        `${baseUrl}/api/email-subscriptions/city-below-target/${sub.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminKey}`,
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

  async function changeFrequency(
    sub: BelowTargetSubscription,
    freq: "daily" | "weekly",
  ) {
    if (freq === sub.frequency) return;
    setBusyId(sub.id);
    setErrorMsg(null);
    try {
      const res = await adminFetch(
        `${baseUrl}/api/email-subscriptions/city-below-target/${sub.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminKey}`,
          },
          body: JSON.stringify({ frequency: freq }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchData();
    } catch {
      setErrorMsg("Não foi possível atualizar a frequência.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(sub: BelowTargetSubscription) {
    if (!confirm(`Remover ${sub.email}?`)) return;
    setBusyId(sub.id);
    setErrorMsg(null);
    try {
      const res = await adminFetch(
        `${baseUrl}/api/email-subscriptions/city-below-target/${sub.id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${adminKey}` } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchData();
    } catch {
      setErrorMsg("Não foi possível remover.");
    } finally {
      setBusyId(null);
    }
  }

  async function sendNow(sub: BelowTargetSubscription) {
    setBusyId(sub.id);
    setErrorMsg(null);
    setFeedback(null);
    try {
      const res = await adminFetch(
        `${baseUrl}/api/email-subscriptions/city-below-target/${sub.id}/send-now`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminKey}`,
          },
          body: JSON.stringify({ frequency: sub.frequency }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string });
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setFeedback(`Email de teste enviado para ${sub.email}.`);
      await fetchData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Falha ao enviar email.");
    } finally {
      setBusyId(null);
    }
  }

  async function saveSettings() {
    setSavingSettings(true);
    setErrorMsg(null);
    setFeedback(null);
    try {
      const pctNum = Number(defaultPct);
      const minNum = Number(minPreviews);
      if (!Number.isFinite(pctNum) || pctNum <= 0 || pctNum > 100) {
        throw new Error("Meta padrão deve estar entre 0 e 100%.");
      }
      if (!Number.isFinite(minNum) || minNum < 1 || minNum > 1000) {
        throw new Error("Mínimo de prévias deve estar entre 1 e 1000.");
      }
      const res = await adminFetch(`${baseUrl}/api/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminKey}`,
        },
        body: JSON.stringify({
          below_target_default_pct: String(pctNum),
          below_target_min_previews: String(Math.floor(minNum)),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFeedback("Configurações do alerta salvas.");
      await onSettingsChange();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSavingSettings(false);
    }
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
    <section
      className="bg-white rounded-2xl border border-[#E0E3EB] p-6"
      data-testid="below-target-digest-section"
    >
      <header className="mb-5">
        <h2 className="font-bold text-[#0D0D0D] text-base">
          Alerta de cidades abaixo da meta
        </h2>
        <p className="text-sm text-[#7A7F8C] mt-1">
          Receba um email automático quando alguma cidade tiver taxa de
          conversão abaixo da meta. As metas por cidade são definidas no mapa
          (admin → Mapa de cliques). Cidades sem meta específica usam a meta
          padrão configurada abaixo.
        </p>
      </header>

      {!emailConfigured && (
        <div
          className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 mb-4 text-sm"
          data-testid="below-target-email-not-configured-warning"
        >
          <strong>Envio de email ainda não configurado.</strong> Configure o
          SMTP acima para que os alertas sejam enviados.
        </div>
      )}

      <div className="mb-5 p-4 rounded-xl border border-[#E0E3EB] bg-[#F8FAFF]">
        <div className="text-sm font-semibold text-[#0D0D0D] mb-2">
          Critérios do alerta
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-[#7A7F8C]">
            <span>Meta padrão de conversão (%)</span>
            <input
              type="number"
              min={1}
              max={100}
              step={0.5}
              value={defaultPct}
              onChange={(e) => setDefaultPct(e.target.value)}
              className="border border-[#E0E3EB] rounded-md px-3 py-2 bg-white text-sm text-[#0D0D0D] w-32 focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
              data-testid="below-target-default-pct"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[#7A7F8C]">
            <span>Mínimo de prévias para alertar</span>
            <input
              type="number"
              min={1}
              max={1000}
              step={1}
              value={minPreviews}
              onChange={(e) => setMinPreviews(e.target.value)}
              className="border border-[#E0E3EB] rounded-md px-3 py-2 bg-white text-sm text-[#0D0D0D] w-32 focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
              data-testid="below-target-min-previews"
            />
          </label>
          <button
            type="button"
            onClick={() => void saveSettings()}
            disabled={savingSettings || !settingsDirty}
            className="text-sm font-semibold px-4 py-2 rounded-md bg-[#0040FF] text-white hover:bg-[#0033CC] disabled:opacity-50"
            data-testid="below-target-save-settings"
          >
            {savingSettings ? "Salvando..." : "Salvar critérios"}
          </button>
        </div>
        <p className="text-[11px] text-[#7A7F8C] mt-2">
          Cidades com meta específica (definida no mapa) usam a própria meta;
          as demais usam a meta padrão acima.
        </p>
      </div>

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
            data-testid="below-target-new-email"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[#7A7F8C]">
          <span>Frequência</span>
          <select
            value={newFreq}
            onChange={(e) => setNewFreq(e.target.value as "daily" | "weekly")}
            className="border border-[#E0E3EB] rounded-md px-3 py-2 bg-white text-sm text-[#0D0D0D] focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
            data-testid="below-target-new-frequency"
          >
            <option value="daily">Diário</option>
            <option value="weekly">Semanal</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={submitting || !newEmail.trim()}
          className="text-sm font-semibold px-4 py-2 rounded-md bg-[#0040FF] text-white hover:bg-[#0033CC] disabled:opacity-50"
          data-testid="below-target-add"
        >
          {submitting ? "Adicionando..." : "Adicionar"}
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
                  data-testid={`below-target-row-${sub.id}`}
                >
                  <td className="px-3 py-2 text-[#0D0D0D] font-medium">{sub.email}</td>
                  <td className="px-3 py-2 text-[#2A2D38]">
                    <select
                      value={sub.frequency}
                      onChange={(e) =>
                        void changeFrequency(sub, e.target.value as "daily" | "weekly")
                      }
                      disabled={busyId === sub.id}
                      className="border border-[#E0E3EB] rounded-md px-2 py-1 bg-white text-xs text-[#0D0D0D] focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30 disabled:opacity-50"
                      data-testid={`below-target-frequency-${sub.id}`}
                    >
                      <option value="daily">{belowTargetFreqLabel("daily")}</option>
                      <option value="weekly">{belowTargetFreqLabel("weekly")}</option>
                    </select>
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
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-md border border-[#E0E3EB] text-[#0040FF] hover:border-[#0040FF]/50 disabled:opacity-40"
                        data-testid={`below-target-send-now-${sub.id}`}
                      >
                        Enviar agora
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleEnabled(sub)}
                        disabled={busyId === sub.id}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-md border border-[#E0E3EB] text-[#2A2D38] hover:border-[#0040FF]/50 disabled:opacity-40"
                        data-testid={`below-target-toggle-${sub.id}`}
                      >
                        {sub.enabled ? "Pausar" : "Ativar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(sub)}
                        disabled={busyId === sub.id}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-md border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40"
                        data-testid={`below-target-remove-${sub.id}`}
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

type PreviewHealthAlertSubscription = {
  id: number;
  email: string;
  reportType: string;
  frequency: string;
  enabled: boolean;
  lastSentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function PreviewHealthAlertSubscriptionsManager({
  adminKey,
  baseUrl,
}: {
  adminKey: string;
  baseUrl: string;
}) {
  const [items, setItems] = useState<PreviewHealthAlertSubscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [emailConfigured, setEmailConfigured] = useState<boolean>(true);
  const [newEmail, setNewEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await adminFetch(
        `${baseUrl}/api/email-subscriptions/preview-health-alert`,
        { headers: { Authorization: `Bearer ${adminKey}` } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: {
        items: PreviewHealthAlertSubscription[];
        emailConfigured: boolean;
      } = await res.json();
      setItems(data.items);
      setEmailConfigured(data.emailConfigured);
    } catch {
      setErrorMsg("Não foi possível carregar os destinatários do alerta.");
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
      const res = await adminFetch(
        `${baseUrl}/api/email-subscriptions/preview-health-alert`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminKey}`,
          },
          body: JSON.stringify({ email: newEmail.trim() }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string });
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setNewEmail("");
      setFeedback("Destinatário adicionado.");
      await fetchData();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Não foi possível adicionar.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleEnabled(sub: PreviewHealthAlertSubscription) {
    setBusyId(sub.id);
    setErrorMsg(null);
    try {
      const res = await adminFetch(
        `${baseUrl}/api/email-subscriptions/preview-health-alert/${sub.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminKey}`,
          },
          body: JSON.stringify({ enabled: !sub.enabled }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchData();
    } catch {
      setErrorMsg("Não foi possível atualizar o destinatário.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(sub: PreviewHealthAlertSubscription) {
    if (!confirm(`Remover ${sub.email}?`)) return;
    setBusyId(sub.id);
    setErrorMsg(null);
    try {
      const res = await adminFetch(
        `${baseUrl}/api/email-subscriptions/preview-health-alert/${sub.id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${adminKey}` } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchData();
    } catch {
      setErrorMsg("Não foi possível remover.");
    } finally {
      setBusyId(null);
    }
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
    <section
      className="bg-white rounded-2xl border border-[#E0E3EB] p-6"
      data-testid="preview-health-alert-section"
    >
      <header className="mb-5">
        <h2 className="font-bold text-[#0D0D0D] text-base">
          Alerta de pré-visualização do WhatsApp
        </h2>
        <p className="text-sm text-[#7A7F8C] mt-1">
          Receba um aviso por email quando pessoas abrirem páginas de
          compartilhamento mas o WhatsApp/Facebook não buscar a pré-visualização
          (links sem imagem/título). Apenas um email é enviado por incidente.
        </p>
      </header>

      {!emailConfigured && (
        <div
          className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 mb-4 text-sm"
          data-testid="preview-health-email-not-configured-warning"
        >
          <strong>Envio de email ainda não configurado.</strong> Configure o
          SMTP acima para que os alertas sejam enviados.
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
            data-testid="preview-health-new-email"
          />
        </label>
        <button
          type="submit"
          disabled={submitting || !newEmail.trim()}
          className="text-sm font-semibold px-4 py-2 rounded-md bg-[#0040FF] text-white hover:bg-[#0033CC] disabled:opacity-50"
          data-testid="preview-health-add"
        >
          {submitting ? "Adicionando..." : "Adicionar"}
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
                <th className="text-left px-3 py-2 font-semibold">Status</th>
                <th className="text-left px-3 py-2 font-semibold">
                  Último alerta
                </th>
                <th className="text-right px-3 py-2 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((sub) => (
                <tr
                  key={sub.id}
                  className="border-t border-[#E0E3EB] hover:bg-[#F8FAFF]"
                  data-testid={`preview-health-row-${sub.id}`}
                >
                  <td className="px-3 py-2 text-[#0D0D0D] font-medium">
                    {sub.email}
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
                        onClick={() => void toggleEnabled(sub)}
                        disabled={busyId === sub.id}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-md border border-[#E0E3EB] text-[#2A2D38] hover:border-[#0040FF]/50 disabled:opacity-40"
                        data-testid={`preview-health-toggle-${sub.id}`}
                      >
                        {sub.enabled ? "Pausar" : "Ativar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(sub)}
                        disabled={busyId === sub.id}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-md border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40"
                        data-testid={`preview-health-remove-${sub.id}`}
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
  adminKey: string;
  baseUrl: string;
};

type InterestRecipient = {
  id: number;
  email: string;
  reportType: string;
  frequency: "instant" | "daily" | "weekly";
  enabled: boolean;
  lastSentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function interestFreqLabel(f: "instant" | "daily" | "weekly"): string {
  if (f === "instant") return "Instantâneo (1 email por cadastro)";
  if (f === "daily") return "Diário (resumo)";
  return "Semanal (resumo)";
}

function InterestNotificationSettings({
  adminKey,
  baseUrl,
}: InterestNotificationSettingsProps) {
  const [items, setItems] = useState<InterestRecipient[]>([]);
  const [loading, setLoading] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState<boolean>(true);
  const [newEmail, setNewEmail] = useState("");
  const [newFreq, setNewFreq] = useState<"instant" | "daily" | "weekly">("instant");
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await adminFetch(
        `${baseUrl}/api/email-subscriptions/interest-notification`,
        { headers: { Authorization: `Bearer ${adminKey}` } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { items: InterestRecipient[]; emailConfigured: boolean } =
        await res.json();
      setItems(data.items);
      setEmailConfigured(data.emailConfigured);
    } catch {
      setErrorMsg("Não foi possível carregar os destinatários.");
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
      const res = await adminFetch(
        `${baseUrl}/api/email-subscriptions/interest-notification`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminKey}`,
          },
          body: JSON.stringify({ email: newEmail.trim(), frequency: newFreq }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string });
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setNewEmail("");
      setNewFreq("instant");
      setFeedback("Destinatário adicionado.");
      await fetchData();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Não foi possível adicionar.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleEnabled(sub: InterestRecipient) {
    setBusyId(sub.id);
    setErrorMsg(null);
    try {
      const res = await adminFetch(
        `${baseUrl}/api/email-subscriptions/interest-notification/${sub.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminKey}`,
          },
          body: JSON.stringify({ enabled: !sub.enabled }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchData();
    } catch {
      setErrorMsg("Não foi possível atualizar o destinatário.");
    } finally {
      setBusyId(null);
    }
  }

  async function changeFrequency(sub: InterestRecipient, freq: "instant" | "daily" | "weekly") {
    if (freq === sub.frequency) return;
    setBusyId(sub.id);
    setErrorMsg(null);
    try {
      const res = await adminFetch(
        `${baseUrl}/api/email-subscriptions/interest-notification/${sub.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminKey}`,
          },
          body: JSON.stringify({ frequency: freq }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchData();
    } catch {
      setErrorMsg("Não foi possível atualizar a frequência.");
    } finally {
      setBusyId(null);
    }
  }

  async function sendDigestNow(sub: InterestRecipient) {
    setBusyId(sub.id);
    setErrorMsg(null);
    setFeedback(null);
    try {
      const res = await adminFetch(
        `${baseUrl}/api/demand/interests/digest/${sub.id}/send-now`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${adminKey}` },
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        count?: number;
      };
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const n = data.count ?? 0;
      setFeedback(
        `Resumo enviado para ${sub.email} (${n} cadastro${n === 1 ? "" : "s"}).`,
      );
      await fetchData();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Não foi possível enviar o resumo.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function remove(sub: InterestRecipient) {
    if (!confirm(`Remover ${sub.email}?`)) return;
    setBusyId(sub.id);
    setErrorMsg(null);
    try {
      const res = await adminFetch(
        `${baseUrl}/api/email-subscriptions/interest-notification/${sub.id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${adminKey}` } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchData();
    } catch {
      setErrorMsg("Não foi possível remover o destinatário.");
    } finally {
      setBusyId(null);
    }
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
          Notificação por email
        </h2>
        <p className="text-sm text-[#7A7F8C] mt-1">
          Cadastre quantos destinatários quiser para receber os novos cadastros
          feitos em{" "}
          <code className="px-1 py-0.5 bg-[#F5F7FA] rounded text-[11px]">/demanda</code>,
          com cidade, bairro, WhatsApp e link direto para iniciar a conversa.
          Cada destinatário pode escolher "instantâneo" (1 email por cadastro)
          ou um resumo "diário" / "semanal".
        </p>
      </header>

      {!emailConfigured && (
        <div
          className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 mb-4 text-sm"
          data-testid="interest-email-not-configured-warning"
        >
          <strong>Envio de email ainda não configurado.</strong> Configure o
          SMTP na aba "Relatórios por email" para que as notificações sejam
          enviadas. Você pode cadastrar destinatários mesmo assim.
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
            data-testid="interest-notification-email"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[#7A7F8C]">
          <span>Frequência</span>
          <select
            value={newFreq}
            onChange={(e) =>
              setNewFreq(e.target.value as "instant" | "daily" | "weekly")
            }
            className="border border-[#E0E3EB] rounded-md px-3 py-2 bg-white text-sm text-[#0D0D0D] focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
            data-testid="interest-notification-frequency"
          >
            <option value="instant">Instantâneo (1 email por cadastro)</option>
            <option value="daily">Diário (resumo)</option>
            <option value="weekly">Semanal (resumo)</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={submitting || !newEmail.trim()}
          className="text-sm font-semibold px-4 py-2 rounded-md bg-[#0040FF] text-white hover:bg-[#0033CC] disabled:opacity-50"
          data-testid="interest-notification-add"
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
                  data-testid={`interest-notification-row-${sub.id}`}
                >
                  <td className="px-3 py-2 text-[#0D0D0D] font-medium">
                    {sub.email}
                  </td>
                  <td className="px-3 py-2 text-[#2A2D38]">
                    <select
                      value={sub.frequency}
                      onChange={(e) =>
                        void changeFrequency(
                          sub,
                          e.target.value as "instant" | "daily" | "weekly",
                        )
                      }
                      disabled={busyId === sub.id}
                      className="border border-[#E0E3EB] rounded-md px-2 py-1 bg-white text-xs text-[#0D0D0D] focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30 disabled:opacity-50"
                      data-testid={`interest-notification-frequency-${sub.id}`}
                    >
                      <option value="instant">{interestFreqLabel("instant")}</option>
                      <option value="daily">{interestFreqLabel("daily")}</option>
                      <option value="weekly">{interestFreqLabel("weekly")}</option>
                    </select>
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
                        onClick={() => void toggleEnabled(sub)}
                        disabled={busyId === sub.id}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-md border border-[#E0E3EB] text-[#2A2D38] hover:border-[#0040FF]/50 disabled:opacity-40"
                        data-testid={`interest-notification-toggle-${sub.id}`}
                      >
                        {sub.enabled ? "Pausar" : "Ativar"}
                      </button>
                      {(sub.frequency === "daily" || sub.frequency === "weekly") && (
                        <button
                          type="button"
                          onClick={() => void sendDigestNow(sub)}
                          disabled={busyId === sub.id || !emailConfigured}
                          title={
                            emailConfigured
                              ? "Enviar resumo agora para testar"
                              : "Configure o SMTP para enviar"
                          }
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-md border border-[#0040FF]/30 text-[#0040FF] hover:bg-[#0040FF]/5 disabled:opacity-40"
                          data-testid={`interest-notification-send-now-${sub.id}`}
                        >
                          Enviar resumo agora
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void remove(sub)}
                        disabled={busyId === sub.id}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-md border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40"
                        data-testid={`interest-notification-remove-${sub.id}`}
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

type QuietHoursSettingsProps = {
  settings: AppSettings;
  adminKey: string;
  baseUrl: string;
  onChange: () => void | Promise<void>;
};

function QuietHoursSettings({
  settings,
  adminKey,
  baseUrl,
  onChange,
}: QuietHoursSettingsProps) {
  const [enabled, setEnabled] = useState(settings.quiet_hours_enabled === "true");
  const [start, setStart] = useState(settings.quiet_hours_start || "22:00");
  const [end, setEnd] = useState(settings.quiet_hours_end || "08:00");
  const [muteWeekends, setMuteWeekends] = useState(
    settings.quiet_hours_weekends === "true",
  );
  const [digestEnabled, setDigestEnabled] = useState(
    settings.quiet_hours_digest_enabled === "true",
  );
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(settings.quiet_hours_enabled === "true");
    setStart(settings.quiet_hours_start || "22:00");
    setEnd(settings.quiet_hours_end || "08:00");
    setMuteWeekends(settings.quiet_hours_weekends === "true");
    setDigestEnabled(settings.quiet_hours_digest_enabled === "true");
  }, [
    settings.quiet_hours_enabled,
    settings.quiet_hours_start,
    settings.quiet_hours_end,
    settings.quiet_hours_weekends,
    settings.quiet_hours_digest_enabled,
  ]);

  const dirty =
    enabled !== (settings.quiet_hours_enabled === "true") ||
    start !== (settings.quiet_hours_start || "22:00") ||
    end !== (settings.quiet_hours_end || "08:00") ||
    muteWeekends !== (settings.quiet_hours_weekends === "true") ||
    digestEnabled !== (settings.quiet_hours_digest_enabled === "true");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await adminFetch(`${baseUrl}/api/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminKey}`,
        },
        body: JSON.stringify({
          quiet_hours_enabled: enabled ? "true" : "false",
          quiet_hours_start: start,
          quiet_hours_end: end,
          quiet_hours_weekends: muteWeekends ? "true" : "false",
          quiet_hours_digest_enabled: digestEnabled ? "true" : "false",
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

  const windowDescription =
    start === end
      ? "Janela vazia (início igual ao fim)."
      : start < end
        ? `Silêncio das ${start} às ${end} (mesmo dia).`
        : `Silêncio das ${start} às ${end} do dia seguinte (passa da meia-noite).`;

  return (
    <section
      className="bg-white rounded-2xl border border-[#E0E3EB] p-6"
      data-testid="quiet-hours-settings"
    >
      <header className="mb-5">
        <h2 className="font-bold text-[#0D0D0D] text-base">
          Silêncio de notificações (quiet hours)
        </h2>
        <p className="text-sm text-[#7A7F8C] mt-1">
          Defina uma janela diária em que os emails e mensagens de WhatsApp de
          novos interesses não serão enviados — os cadastros continuam sendo
          salvos normalmente no painel. Horários no fuso de São Paulo.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="flex items-center gap-3 text-sm text-[#0D0D0D]">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 accent-[#0040FF]"
            data-testid="quiet-hours-enabled"
          />
          <span>Ativar silêncio de notificações</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-xs text-[#7A7F8C]">
            <span>Início</span>
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              disabled={!enabled}
              className="border border-[#E0E3EB] rounded-md px-3 py-2 bg-white text-sm text-[#0D0D0D] focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30 disabled:opacity-50"
              data-testid="quiet-hours-start"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[#7A7F8C]">
            <span>Fim</span>
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              disabled={!enabled}
              className="border border-[#E0E3EB] rounded-md px-3 py-2 bg-white text-sm text-[#0D0D0D] focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30 disabled:opacity-50"
              data-testid="quiet-hours-end"
            />
          </label>
        </div>
        <p className="text-[11px] text-[#7A7F8C] -mt-2">{windowDescription}</p>

        <label className="flex items-center gap-3 text-sm text-[#0D0D0D]">
          <input
            type="checkbox"
            checked={muteWeekends}
            onChange={(e) => setMuteWeekends(e.target.checked)}
            disabled={!enabled}
            className="h-4 w-4 accent-[#0040FF] disabled:opacity-50"
            data-testid="quiet-hours-weekends"
          />
          <span>Silenciar o fim de semana inteiro (sábado e domingo)</span>
        </label>

        <label className="flex items-start gap-3 text-sm text-[#0D0D0D]">
          <input
            type="checkbox"
            checked={digestEnabled}
            onChange={(e) => setDigestEnabled(e.target.checked)}
            disabled={!enabled}
            className="h-4 w-4 accent-[#0040FF] mt-0.5 disabled:opacity-50"
            data-testid="quiet-hours-digest-enabled"
          />
          <span>
            Ao terminar o silêncio, enviar um email de resumo com os interesses
            recebidos no período (para os destinatários cadastrados como
            "instantâneo").
          </span>
        </label>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">
            {errorMsg}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || !dirty}
            className="text-sm font-semibold px-4 py-2 rounded-md bg-[#0040FF] text-white hover:bg-[#0033CC] disabled:opacity-50"
            data-testid="quiet-hours-save"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
          {savedAt && !dirty && (
            <span className="text-xs text-emerald-700">Salvo.</span>
          )}
        </div>
      </form>
    </section>
  );
}

type WhatsappNotifySettingsProps = {
  settings: AppSettings;
  adminKey: string;
  baseUrl: string;
  onChange: () => void | Promise<void>;
};

function WhatsappNotifySettings({
  settings,
  adminKey,
  baseUrl,
  onChange,
}: WhatsappNotifySettingsProps) {
  const [enabled, setEnabled] = useState(
    settings.whatsapp_notify_enabled === "true",
  );
  const [to, setTo] = useState(settings.whatsapp_notify_to);
  const [phoneNumberId, setPhoneNumberId] = useState(
    settings.whatsapp_notify_phone_number_id,
  );
  const [accessToken, setAccessToken] = useState(
    settings.whatsapp_notify_access_token,
  );
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  useEffect(() => {
    setEnabled(settings.whatsapp_notify_enabled === "true");
    setTo(settings.whatsapp_notify_to);
    setPhoneNumberId(settings.whatsapp_notify_phone_number_id);
    setAccessToken(settings.whatsapp_notify_access_token);
  }, [
    settings.whatsapp_notify_enabled,
    settings.whatsapp_notify_to,
    settings.whatsapp_notify_phone_number_id,
    settings.whatsapp_notify_access_token,
  ]);

  const trimmedTo = to.replace(/\D/g, "");
  const dirty =
    String(enabled) !== settings.whatsapp_notify_enabled ||
    trimmedTo !== settings.whatsapp_notify_to ||
    phoneNumberId.trim() !== settings.whatsapp_notify_phone_number_id ||
    accessToken.trim() !== settings.whatsapp_notify_access_token;

  const toInvalid = trimmedTo.length > 0 && (trimmedTo.length < 10 || trimmedTo.length > 15);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (toInvalid) {
      setErrorMsg("Número de WhatsApp inválido. Use somente dígitos com DDI/DDD (ex.: 5577998444757).");
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await adminFetch(`${baseUrl}/api/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminKey}`,
        },
        body: JSON.stringify({
          whatsapp_notify_enabled: enabled ? "true" : "false",
          whatsapp_notify_to: trimmedTo,
          whatsapp_notify_phone_number_id: phoneNumberId.trim(),
          whatsapp_notify_access_token: accessToken.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail = body?.details?.fieldErrors
          ? Object.entries(body.details.fieldErrors)
              .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`)
              .join(" · ")
          : null;
        throw new Error(detail || body?.error || `HTTP ${res.status}`);
      }
      setSavedAt(Date.now());
      await onChange();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await adminFetch(`${baseUrl}/api/settings/whatsapp/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminKey}`,
        },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTestMsg({ ok: false, text: body?.error || `HTTP ${res.status}` });
        return;
      }
      setTestMsg({
        ok: true,
        text: `Mensagem de teste enviada para ${trimmedTo || "o número configurado"}.`,
      });
    } catch (err) {
      setTesting(false);
      setTestMsg({
        ok: false,
        text: err instanceof Error ? err.message : "Falha de rede.",
      });
      return;
    } finally {
      setTesting(false);
    }
  }

  const canTest =
    !dirty &&
    trimmedTo.length >= 10 &&
    phoneNumberId.trim().length > 0 &&
    accessToken.trim().length > 0;

  return (
    <section
      className="bg-white rounded-2xl border border-[#E0E3EB] p-6"
      data-testid="whatsapp-notify-settings"
    >
      <header className="mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-bold text-[#0D0D0D] text-base">
              Notificação por WhatsApp
            </h2>
            <p className="text-sm text-[#7A7F8C] mt-1 leading-relaxed">
              Envie cada novo cadastro de <code className="px-1 py-0.5 bg-[#F5F7FA] rounded text-[11px]">/demanda</code>{" "}
              para um número de WhatsApp do time, com cidade, bairro, link
              direto e horário. Pode ser ativado ou desativado independentemente
              do email.
            </p>
            <p className="text-xs text-[#7A7F8C] mt-2 leading-relaxed">
              Use a{" "}
              <a
                href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#122AD5] font-semibold hover:underline"
              >
                WhatsApp Cloud API da Meta
              </a>
              . O número de destino precisa ter conversado com o número
              remetente nas últimas 24h para receber mensagens livres.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#0D0D0D] select-none">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 accent-[#0040FF]"
              data-testid="whatsapp-notify-enabled"
            />
            Ativado
          </label>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="flex flex-col gap-1 text-xs text-[#7A7F8C]">
          <span>Número de destino (com DDI e DDD, somente dígitos)</span>
          <input
            type="text"
            inputMode="numeric"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="5577998444757"
            className="border border-[#E0E3EB] rounded-md px-3 py-2 bg-white text-sm text-[#0D0D0D] focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
            data-testid="whatsapp-notify-to"
          />
          {toInvalid && (
            <span className="text-[11px] text-red-600 mt-1">
              Use 10 a 15 dígitos. Ex.: 5577998444757.
            </span>
          )}
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-[#7A7F8C]">
            <span>Phone Number ID (Meta)</span>
            <input
              type="text"
              autoComplete="off"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              placeholder="123456789012345"
              className="border border-[#E0E3EB] rounded-md px-3 py-2 bg-white text-sm text-[#0D0D0D] focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
              data-testid="whatsapp-notify-phone-id"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[#7A7F8C]">
            <span>Access Token</span>
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                autoComplete="new-password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="EAAG..."
                className="w-full border border-[#E0E3EB] rounded-md px-3 py-2 pr-16 bg-white text-sm text-[#0D0D0D] focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
                data-testid="whatsapp-notify-token"
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#0040FF] hover:underline"
              >
                {showToken ? "ocultar" : "mostrar"}
              </button>
            </div>
          </label>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">
            {errorMsg}
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="submit"
            disabled={saving || !dirty || toInvalid}
            className="text-sm font-semibold px-4 py-2 rounded-md bg-[#0040FF] text-white hover:bg-[#0033CC] disabled:opacity-50"
            data-testid="whatsapp-notify-save"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={testing || !canTest}
            className="text-sm font-semibold px-4 py-2 rounded-md border border-[#E0E3EB] text-[#0D0D0D] hover:border-[#0040FF]/50 disabled:opacity-50"
            data-testid="whatsapp-notify-test"
            title={
              !canTest
                ? "Salve as configurações antes de testar."
                : "Enviar mensagem de teste"
            }
          >
            {testing ? "Enviando..." : "Enviar teste"}
          </button>
          {savedAt && !dirty && (
            <span className="text-xs text-emerald-700">Salvo.</span>
          )}
        </div>

        {testMsg && (
          <div
            className={`rounded-lg px-4 py-2 text-sm border ${
              testMsg.ok
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
            data-testid="whatsapp-notify-test-result"
          >
            {testMsg.text}
          </div>
        )}
      </form>
    </section>
  );
}

type RecaptchaSettingsProps = {
  settings: AppSettings;
  adminKey: string;
  baseUrl: string;
  onChange: () => void | Promise<void>;
};

function RecaptchaSettings({
  settings,
  adminKey,
  baseUrl,
  onChange,
}: RecaptchaSettingsProps) {
  const [enabled, setEnabled] = useState(settings.recaptcha_enabled === "true");
  const [siteKey, setSiteKey] = useState(settings.recaptcha_site_key);
  const [secretKey, setSecretKey] = useState(settings.recaptcha_secret_key);
  const [minScore, setMinScore] = useState(settings.recaptcha_min_score);
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(settings.recaptcha_enabled === "true");
    setSiteKey(settings.recaptcha_site_key);
    setSecretKey(settings.recaptcha_secret_key);
    setMinScore(settings.recaptcha_min_score);
  }, [
    settings.recaptcha_enabled,
    settings.recaptcha_site_key,
    settings.recaptcha_secret_key,
    settings.recaptcha_min_score,
  ]);

  const dirty =
    String(enabled) !== settings.recaptcha_enabled ||
    siteKey.trim() !== settings.recaptcha_site_key ||
    secretKey.trim() !== settings.recaptcha_secret_key ||
    minScore.trim() !== settings.recaptcha_min_score;

  const scoreInvalid = !/^(0(\.\d+)?|1(\.0+)?)$/.test(minScore.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (scoreInvalid) {
      setErrorMsg("Use um valor entre 0 e 1, ex: 0.5");
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await adminFetch(`${baseUrl}/api/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminKey}`,
        },
        body: JSON.stringify({
          recaptcha_enabled: enabled ? "true" : "false",
          recaptcha_site_key: siteKey.trim(),
          recaptcha_secret_key: secretKey.trim(),
          recaptcha_min_score: minScore.trim(),
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
    <section className="bg-white rounded-2xl border border-[#E0E3EB] p-6 max-w-3xl">
      <header className="mb-5">
        <h2 className="font-bold text-[#0D0D0D] text-base">
          Anti-spam & reCAPTCHA v3
        </h2>
        <p className="text-sm text-[#7A7F8C] mt-1 leading-relaxed">
          Proteção do formulário de <code className="px-1 py-0.5 bg-[#F5F7FA] rounded text-[11px]">/contato</code>.
          Já estão sempre ativos: limite de envios por IP, honeypot, time-trap,
          validação de campos (nome, e-mail, WhatsApp com DDD da Bahia) e
          bloqueio de scripts/SQL. Adicione o reCAPTCHA v3 do Google para
          uma camada extra contra robôs.
        </p>
        <p className="text-xs text-[#7A7F8C] mt-2">
          Crie suas chaves em{" "}
          <a
            href="https://www.google.com/recaptcha/admin/create"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#122AD5] font-semibold hover:underline"
          >
            google.com/recaptcha/admin
          </a>
          {" "}— escolha <strong>reCAPTCHA v3</strong>.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="flex items-center gap-2 text-sm text-[#2A2D38]">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 accent-[#0040FF]"
            data-testid="recaptcha-enabled"
          />
          Ativar reCAPTCHA v3 no formulário de contato
        </label>

        <label className="flex flex-col gap-1 text-xs text-[#7A7F8C]">
          <span>Site key (pública)</span>
          <input
            type="text"
            value={siteKey}
            onChange={(e) => setSiteKey(e.target.value)}
            placeholder="6Lc..."
            className="border border-[#E0E3EB] rounded-md px-3 py-2 bg-white text-sm text-[#0D0D0D] focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30 font-mono"
            data-testid="recaptcha-site-key"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-[#7A7F8C]">
          <span>Secret key (privada — nunca exposta no site)</span>
          <div className="relative">
            <input
              type={showSecret ? "text" : "password"}
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder="6Lc..."
              className="border border-[#E0E3EB] rounded-md px-3 py-2 bg-white text-sm text-[#0D0D0D] focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30 font-mono w-full pr-20"
              data-testid="recaptcha-secret-key"
            />
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#7A7F8C] hover:text-[#0D0D0D] px-2 py-1"
            >
              {showSecret ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </label>

        <label className="flex flex-col gap-1 text-xs text-[#7A7F8C] max-w-[220px]">
          <span>Score mínimo (0.1 a 0.9)</span>
          <input
            type="text"
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
            placeholder="0.5"
            className={`border rounded-md px-3 py-2 bg-white text-sm text-[#0D0D0D] focus:outline-none focus:ring-2 ${
              scoreInvalid && minScore.trim().length > 0
                ? "border-red-300 focus:ring-red-300"
                : "border-[#E0E3EB] focus:ring-[#0040FF]/30"
            }`}
            data-testid="recaptcha-min-score"
          />
          <span className="text-[11px] text-[#7A7F8C]">
            Recomendado: 0.5. Quanto mais alto, mais rigoroso (mais robôs barrados, porém mais falsos positivos).
          </span>
        </label>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">
            {errorMsg}
          </div>
        )}

        {enabled && (!siteKey.trim() || !secretKey.trim()) && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-2 text-sm">
            Para ativar o reCAPTCHA, informe a site key e a secret key.
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={saving || !dirty}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: "#122AD5" }}
            data-testid="recaptcha-save"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
          {savedAt && !dirty && (
            <span className="text-xs text-[#0A1995] font-semibold">Salvo!</span>
          )}
        </div>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Marketing tab — Google + Meta tag IDs.
// ---------------------------------------------------------------------------
type MarketingSettingsProps = {
  settings: AppSettings;
  adminKey: string;
  baseUrl: string;
  onChange: () => void | Promise<void>;
};

function MarketingSettings({ settings, adminKey, baseUrl, onChange }: MarketingSettingsProps) {
  const [ga4, setGa4] = useState(settings.ga4_measurement_id);
  const [gtm, setGtm] = useState(settings.gtm_container_id);
  const [adsId, setAdsId] = useState(settings.google_ads_conversion_id);
  const [adsLabel, setAdsLabel] = useState(settings.google_ads_conversion_label);
  const [pixel, setPixel] = useState(settings.meta_pixel_id);
  const [capi, setCapi] = useState(settings.meta_capi_token);
  const [capiTest, setCapiTest] = useState(settings.meta_capi_test_event_code);
  const [showCapi, setShowCapi] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setGa4(settings.ga4_measurement_id);
    setGtm(settings.gtm_container_id);
    setAdsId(settings.google_ads_conversion_id);
    setAdsLabel(settings.google_ads_conversion_label);
    setPixel(settings.meta_pixel_id);
    setCapi(settings.meta_capi_token);
    setCapiTest(settings.meta_capi_test_event_code);
  }, [
    settings.ga4_measurement_id,
    settings.gtm_container_id,
    settings.google_ads_conversion_id,
    settings.google_ads_conversion_label,
    settings.meta_pixel_id,
    settings.meta_capi_token,
    settings.meta_capi_test_event_code,
  ]);

  const dirty =
    ga4.trim() !== settings.ga4_measurement_id ||
    gtm.trim() !== settings.gtm_container_id ||
    adsId.trim() !== settings.google_ads_conversion_id ||
    adsLabel.trim() !== settings.google_ads_conversion_label ||
    pixel.trim() !== settings.meta_pixel_id ||
    capi.trim() !== settings.meta_capi_token ||
    capiTest.trim() !== settings.meta_capi_test_event_code;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await adminFetch(`${baseUrl}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminKey}` },
        body: JSON.stringify({
          ga4_measurement_id: ga4.trim(),
          gtm_container_id: gtm.trim(),
          google_ads_conversion_id: adsId.trim(),
          google_ads_conversion_label: adsLabel.trim(),
          meta_pixel_id: pixel.trim(),
          meta_capi_token: capi.trim(),
          meta_capi_test_event_code: capiTest.trim(),
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
    <section className="bg-white rounded-2xl border border-[#E0E3EB] p-6 max-w-3xl">
      <header className="mb-5">
        <h2 className="font-bold text-[#0D0D0D] text-base">Ferramentas Google &amp; Meta</h2>
        <p className="text-sm text-[#7A7F8C] mt-1 leading-relaxed">
          Cole aqui os IDs das suas ferramentas. Cada campo só é ativado no site
          quando preenchido — deixe em branco para não carregar.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-[#0D0D0D]">Google</legend>
          <label className="flex flex-col gap-1 text-xs text-[#7A7F8C]">
            <span>Google Tag Manager (Container ID)</span>
            <input
              type="text"
              value={gtm}
              onChange={(e) => setGtm(e.target.value)}
              placeholder="GTM-XXXXXXX"
              className="border border-[#E0E3EB] rounded-md px-3 py-2 bg-white text-sm font-mono"
              data-testid="gtm-id"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[#7A7F8C]">
            <span>Google Analytics 4 (Measurement ID)</span>
            <input
              type="text"
              value={ga4}
              onChange={(e) => setGa4(e.target.value)}
              placeholder="G-XXXXXXXXXX"
              className="border border-[#E0E3EB] rounded-md px-3 py-2 bg-white text-sm font-mono"
              data-testid="ga4-id"
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-[#7A7F8C]">
              <span>Google Ads — Conversion ID</span>
              <input
                type="text"
                value={adsId}
                onChange={(e) => setAdsId(e.target.value)}
                placeholder="AW-XXXXXXXXX"
                className="border border-[#E0E3EB] rounded-md px-3 py-2 bg-white text-sm font-mono"
                data-testid="ads-id"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[#7A7F8C]">
              <span>Google Ads — Conversion Label</span>
              <input
                type="text"
                value={adsLabel}
                onChange={(e) => setAdsLabel(e.target.value)}
                placeholder="abcDEFghi123"
                className="border border-[#E0E3EB] rounded-md px-3 py-2 bg-white text-sm font-mono"
                data-testid="ads-label"
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-[#0D0D0D]">Meta (Facebook / Instagram)</legend>
          <label className="flex flex-col gap-1 text-xs text-[#7A7F8C]">
            <span>Meta Pixel ID</span>
            <input
              type="text"
              value={pixel}
              onChange={(e) => setPixel(e.target.value)}
              placeholder="1234567890"
              className="border border-[#E0E3EB] rounded-md px-3 py-2 bg-white text-sm font-mono"
              data-testid="meta-pixel"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[#7A7F8C]">
            <span>Conversions API — Access Token (privado)</span>
            <div className="relative">
              <input
                type={showCapi ? "text" : "password"}
                value={capi}
                onChange={(e) => setCapi(e.target.value)}
                placeholder="EAA..."
                className="border border-[#E0E3EB] rounded-md px-3 py-2 bg-white text-sm font-mono w-full pr-20"
                data-testid="meta-capi-token"
              />
              <button
                type="button"
                onClick={() => setShowCapi((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#7A7F8C] hover:text-[#0D0D0D] px-2 py-1"
              >
                {showCapi ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            <span className="text-[11px] text-[#7A7F8C]">
              Apenas armazenado — o disparo do CAPI no servidor pode ser ativado depois.
            </span>
          </label>
          <label className="flex flex-col gap-1 text-xs text-[#7A7F8C] max-w-[260px]">
            <span>Test Event Code (opcional)</span>
            <input
              type="text"
              value={capiTest}
              onChange={(e) => setCapiTest(e.target.value)}
              placeholder="TEST12345"
              className="border border-[#E0E3EB] rounded-md px-3 py-2 bg-white text-sm font-mono"
              data-testid="meta-capi-test"
            />
          </label>
        </fieldset>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">{errorMsg}</div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={saving || !dirty}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: "#122AD5" }}
            data-testid="marketing-save"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
          {savedAt && !dirty && <span className="text-xs text-[#0A1995] font-semibold">Salvo!</span>}
        </div>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Avaliações tab — Google Business config + min-rating filter.
// ---------------------------------------------------------------------------
function extractPlaceIdFromUrl(url: string): string | null {
  const m1 = url.match(/[?&]place_id=([A-Za-z0-9_-]+)/);
  if (m1) return m1[1] ?? null;
  const m2 = url.match(/!1s(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/);
  if (m2) return m2[1] ?? null;
  return null;
}

function ReviewsSettings({ settings, adminKey, baseUrl, onChange }: MarketingSettingsProps) {
  const [profileUrl, setProfileUrl] = useState(settings.gmb_profile_url);
  const [apiKey, setApiKey] = useState(settings.google_places_api_key);
  const [placeId, setPlaceId] = useState(settings.google_places_id);
  const [minRating, setMinRating] = useState(settings.reviews_min_rating || "4");
  const [showCount, setShowCount] = useState(settings.reviews_show_count || "6");
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  useEffect(() => {
    setProfileUrl(settings.gmb_profile_url);
    setApiKey(settings.google_places_api_key);
    setPlaceId(settings.google_places_id);
    setMinRating(settings.reviews_min_rating || "4");
    setShowCount(settings.reviews_show_count || "6");
  }, [
    settings.gmb_profile_url,
    settings.google_places_api_key,
    settings.google_places_id,
    settings.reviews_min_rating,
    settings.reviews_show_count,
  ]);

  const dirty =
    profileUrl.trim() !== settings.gmb_profile_url ||
    apiKey.trim() !== settings.google_places_api_key ||
    placeId.trim() !== settings.google_places_id ||
    minRating !== settings.reviews_min_rating ||
    showCount.trim() !== settings.reviews_show_count;

  const countInvalid = !/^([1-9]|1[0-2])$/.test(showCount.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (countInvalid) {
      setErrorMsg("A quantidade exibida deve ser entre 1 e 12.");
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await adminFetch(`${baseUrl}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminKey}` },
        body: JSON.stringify({
          gmb_profile_url: profileUrl.trim(),
          google_places_api_key: apiKey.trim(),
          google_places_id: placeId.trim(),
          reviews_min_rating: minRating,
          reviews_show_count: showCount.trim(),
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

  function tryAutoExtract() {
    const guess = extractPlaceIdFromUrl(profileUrl.trim());
    if (guess) setPlaceId(guess);
  }

  async function handleImport() {
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await adminFetch(`${baseUrl}/api/reviews/import-google`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminKey}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setImportMsg(
        `Importação concluída: ${body.imported ?? 0} novas, ${body.updated ?? 0} atualizadas (de ${body.total ?? 0}).`,
      );
      window.dispatchEvent(new CustomEvent("reviews:refresh"));
    } catch (err) {
      setImportMsg(err instanceof Error ? err.message : "Falha ao importar.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-[#E0E3EB] p-6 max-w-3xl">
      <header className="mb-5">
        <h2 className="font-bold text-[#0D0D0D] text-base">Google Meu Negócio — Avaliações</h2>
        <p className="text-sm text-[#7A7F8C] mt-1 leading-relaxed">
          Cole o link do seu perfil para o botão "Avalie a gente" aparecer no
          site. Para puxar as avaliações automaticamente, configure também a
          chave da Google Places API e o Place ID.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="flex flex-col gap-1 text-xs text-[#7A7F8C]">
          <span>Link do Google Meu Negócio (perfil público)</span>
          <input
            type="url"
            value={profileUrl}
            onChange={(e) => setProfileUrl(e.target.value)}
            placeholder="https://g.page/r/... ou https://maps.app.goo.gl/..."
            className="border border-[#E0E3EB] rounded-md px-3 py-2 bg-white text-sm"
            data-testid="gmb-url"
          />
          <span className="text-[11px] text-[#7A7F8C]">
            Aparece como botão "Avalie a gente no Google" abaixo dos depoimentos.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-xs text-[#7A7F8C]">
          <span>Google Places API key (privada)</span>
          <div className="relative">
            <input
              type={showSecret ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIza..."
              className="border border-[#E0E3EB] rounded-md px-3 py-2 bg-white text-sm font-mono w-full pr-20"
              data-testid="places-api-key"
            />
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#7A7F8C] hover:text-[#0D0D0D] px-2 py-1"
            >
              {showSecret ? "Ocultar" : "Mostrar"}
            </button>
          </div>
          <span className="text-[11px] text-[#7A7F8C]">
            Crie em <a href="https://console.cloud.google.com/google/maps-apis/credentials" target="_blank" rel="noopener noreferrer" className="text-[#122AD5] font-semibold hover:underline">Google Cloud Console</a> — habilite o produto "Places API".
          </span>
        </label>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <label className="flex flex-col gap-1 text-xs text-[#7A7F8C] flex-1">
            <span>Place ID</span>
            <input
              type="text"
              value={placeId}
              onChange={(e) => setPlaceId(e.target.value)}
              placeholder="ChIJ..."
              className="border border-[#E0E3EB] rounded-md px-3 py-2 bg-white text-sm font-mono"
              data-testid="place-id"
            />
          </label>
          <button
            type="button"
            onClick={tryAutoExtract}
            className="px-3 py-2 rounded-md text-xs font-semibold text-[#122AD5] border border-[#122AD5]/30 hover:bg-[#122AD5]/5"
          >
            Tentar extrair do link
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-[#7A7F8C]">
            <span>Mostrar avaliações com no mínimo</span>
            <select
              value={minRating}
              onChange={(e) => setMinRating(e.target.value)}
              className="border border-[#E0E3EB] rounded-md px-3 py-2 bg-white text-sm"
              data-testid="reviews-min-rating"
            >
              <option value="1">1 estrela ou mais</option>
              <option value="2">2 estrelas ou mais</option>
              <option value="3">3 estrelas ou mais</option>
              <option value="4">4 estrelas ou mais</option>
              <option value="5">Apenas 5 estrelas</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-[#7A7F8C]">
            <span>Quantas exibir na home (1 a 12)</span>
            <input
              type="text"
              value={showCount}
              onChange={(e) => setShowCount(e.target.value)}
              className={`border rounded-md px-3 py-2 bg-white text-sm ${
                countInvalid && showCount.trim().length > 0
                  ? "border-red-300"
                  : "border-[#E0E3EB]"
              }`}
              data-testid="reviews-show-count"
            />
          </label>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">{errorMsg}</div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={saving || !dirty}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: "#122AD5" }}
            data-testid="reviews-settings-save"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
          {savedAt && !dirty && <span className="text-xs text-[#0A1995] font-semibold">Salvo!</span>}
          <button
            type="button"
            onClick={handleImport}
            disabled={importing || !apiKey.trim() || !placeId.trim()}
            className="px-4 py-2 rounded-lg text-sm font-bold border border-[#122AD5] text-[#122AD5] hover:bg-[#122AD5]/5 transition-colors disabled:opacity-60"
            data-testid="reviews-import"
          >
            {importing ? "Importando..." : "Importar do Google agora"}
          </button>
          {importMsg && <span className="text-xs text-[#0D0D0D]">{importMsg}</span>}
        </div>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Avaliações manager — list / hide / delete / add manual.
// ---------------------------------------------------------------------------
type AdminReview = {
  id: number;
  source: string;
  authorName: string;
  authorAvatarUrl: string | null;
  rating: number;
  text: string;
  city: string | null;
  visible: boolean;
  postedAt: string | null;
  createdAt: string;
};

type AdminFaqItem = {
  id: number;
  question: string;
  answer: string;
  column: "left" | "right";
  sortOrder: number;
  isActive: boolean;
};

function FaqManager({ adminKey, baseUrl }: { adminKey: string; baseUrl: string }) {
  const [items, setItems] = useState<AdminFaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftQ, setDraftQ] = useState("");
  const [draftA, setDraftA] = useState("");
  const [draftCol, setDraftCol] = useState<"left" | "right">("left");
  const [draftActive, setDraftActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const isCreating = editingId === 0;

  const reload = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await adminFetch(`${baseUrl}/api/admin/faq-items`, {
        headers: { Authorization: `Bearer ${adminKey}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as AdminFaqItem[];
      setItems(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao carregar dúvidas.");
    } finally {
      setLoading(false);
    }
  }, [adminKey, baseUrl]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function startCreate() {
    setEditingId(0);
    setDraftQ("");
    setDraftA("");
    setDraftCol("left");
    setDraftActive(true);
  }

  function startEdit(item: AdminFaqItem) {
    setEditingId(item.id);
    setDraftQ(item.question);
    setDraftA(item.answer);
    setDraftCol(item.column);
    setDraftActive(item.isActive);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function save() {
    if (draftQ.trim().length < 3 || draftA.trim().length < 3) {
      setErr("Pergunta e resposta precisam ter ao menos 3 caracteres.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const isNew = editingId === 0;
      const url = isNew
        ? `${baseUrl}/api/faq-items`
        : `${baseUrl}/api/faq-items/${editingId}`;
      const res = await adminFetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminKey}`,
        },
        body: JSON.stringify({
          question: draftQ.trim(),
          answer: draftA.trim(),
          column: draftCol,
          isActive: draftActive,
          ...(isNew ? { sortOrder: items.length } : {}),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setEditingId(null);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: AdminFaqItem) {
    if (!confirm(`Excluir a dúvida "${item.question}"?`)) return;
    try {
      const res = await adminFetch(`${baseUrl}/api/faq-items/${item.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminKey}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao excluir.");
    }
  }

  async function toggleActive(item: AdminFaqItem) {
    try {
      const res = await adminFetch(`${baseUrl}/api/faq-items/${item.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminKey}`,
        },
        body: JSON.stringify({
          question: item.question,
          answer: item.answer,
          column: item.column,
          isActive: !item.isActive,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao atualizar.");
    }
  }

  const grouped = {
    left: items.filter((i) => i.column === "left"),
    right: items.filter((i) => i.column === "right"),
  };

  return (
    <section className="bg-white rounded-2xl border border-[#E0E3EB] p-6">
      <header className="mb-5 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-[#0D0D0D]">Dúvidas (FAQ)</h2>
          <p className="text-sm text-[#7A7F8C]">
            Gerencie as perguntas e respostas exibidas na seção "Tire suas Dúvidas" do site.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          disabled={editingId !== null}
          className="px-4 py-2 rounded-md bg-[#122AD5] text-white text-sm font-semibold disabled:opacity-50"
          data-testid="faq-add-button"
        >
          + Nova dúvida
        </button>
      </header>

      {err && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 mb-4 text-sm">
          {err}
        </div>
      )}

      {(isCreating || editingId !== null) && (
        <div className="mb-6 p-4 rounded-lg border border-[#122AD5]/30 bg-[#F4F6FF]">
          <h3 className="font-semibold text-sm mb-3 text-[#0D0D0D]">
            {isCreating ? "Nova dúvida" : `Editando #${editingId}`}
          </h3>
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-[#4A4F61]">
              Pergunta
              <input
                type="text"
                value={draftQ}
                onChange={(e) => setDraftQ(e.target.value)}
                maxLength={300}
                className="mt-1 w-full rounded-md border border-[#E0E3EB] px-3 py-2 text-sm font-normal text-[#0D0D0D]"
                data-testid="faq-input-question"
              />
            </label>
            <label className="block text-xs font-semibold text-[#4A4F61]">
              Resposta
              <textarea
                value={draftA}
                onChange={(e) => setDraftA(e.target.value)}
                maxLength={2000}
                rows={4}
                className="mt-1 w-full rounded-md border border-[#E0E3EB] px-3 py-2 text-sm font-normal text-[#0D0D0D]"
                data-testid="faq-input-answer"
              />
            </label>
            <div className="flex items-center gap-4 flex-wrap">
              <label className="text-xs font-semibold text-[#4A4F61] flex items-center gap-2">
                Coluna
                <select
                  value={draftCol}
                  onChange={(e) => setDraftCol(e.target.value as "left" | "right")}
                  className="rounded-md border border-[#E0E3EB] px-2 py-1 text-sm font-normal"
                >
                  <option value="left">Esquerda</option>
                  <option value="right">Direita</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-[#4A4F61] flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draftActive}
                  onChange={(e) => setDraftActive(e.target.checked)}
                />
                Visível no site
              </label>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="px-4 py-2 rounded-md bg-[#122AD5] text-white text-sm font-semibold disabled:opacity-50"
                data-testid="faq-save-button"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="px-4 py-2 rounded-md border border-[#E0E3EB] text-sm font-semibold text-[#4A4F61]"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-[#7A7F8C] py-8">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(["left", "right"] as const).map((col) => (
            <div key={col}>
              <h3 className="text-xs font-bold uppercase text-[#7A7F8C] mb-2">
                Coluna {col === "left" ? "esquerda" : "direita"} ({grouped[col].length})
              </h3>
              <ul className="space-y-2">
                {grouped[col].map((item) => (
                  <li
                    key={item.id}
                    className={`p-3 rounded-md border ${
                      item.isActive ? "border-[#E0E3EB] bg-white" : "border-dashed border-[#E0E3EB] bg-[#FAFAFB] opacity-60"
                    }`}
                    data-testid={`faq-item-${item.id}`}
                  >
                    <div className="text-sm font-semibold text-[#0D0D0D]">{item.question}</div>
                    <div className="text-xs text-[#4A4F61] mt-1 line-clamp-2">{item.answer}</div>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        disabled={editingId !== null}
                        className="text-xs font-semibold text-[#122AD5] hover:underline disabled:opacity-50"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleActive(item)}
                        className="text-xs font-semibold text-[#7A7F8C] hover:underline"
                      >
                        {item.isActive ? "Ocultar" : "Mostrar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(item)}
                        className="text-xs font-semibold text-red-600 hover:underline"
                      >
                        Excluir
                      </button>
                    </div>
                  </li>
                ))}
                {grouped[col].length === 0 && (
                  <li className="text-xs text-[#7A7F8C] italic">Nenhuma dúvida nesta coluna.</li>
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ReviewsManager({ adminKey, baseUrl }: { adminKey: string; baseUrl: string }) {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [rating, setRating] = useState("5");
  const [text, setText] = useState("");
  const [city, setCity] = useState("");
  const [creating, setCreating] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await adminFetch(`${baseUrl}/api/reviews/admin`, {
        headers: { Authorization: `Bearer ${adminKey}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as AdminReview[];
      setReviews(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao carregar avaliações.");
    } finally {
      setLoading(false);
    }
  }, [adminKey, baseUrl]);

  useEffect(() => {
    void reload();
    const onRefresh = () => void reload();
    window.addEventListener("reviews:refresh", onRefresh);
    return () => window.removeEventListener("reviews:refresh", onRefresh);
  }, [reload]);

  async function toggleVisible(r: AdminReview) {
    await adminFetch(`${baseUrl}/api/reviews/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminKey}` },
      body: JSON.stringify({ visible: !r.visible }),
    });
    void reload();
  }

  async function deleteReview(r: AdminReview) {
    if (!confirm(`Excluir a avaliação de ${r.authorName}?`)) return;
    await adminFetch(`${baseUrl}/api/reviews/${r.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminKey}` },
    });
    void reload();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !text.trim()) return;
    setCreating(true);
    try {
      await adminFetch(`${baseUrl}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminKey}` },
        body: JSON.stringify({
          authorName: name.trim(),
          rating: parseInt(rating, 10),
          text: text.trim(),
          city: city.trim() || undefined,
        }),
      });
      setName("");
      setText("");
      setCity("");
      setRating("5");
      void reload();
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-[#E0E3EB] p-6 max-w-3xl">
      <header className="mb-5 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-bold text-[#0D0D0D] text-base">Avaliações cadastradas</h2>
          <p className="text-sm text-[#7A7F8C] mt-1">
            Avaliações importadas do Google e cadastradas manualmente. Apenas as
            visíveis e dentro da faixa de estrelas configurada aparecem na home.
          </p>
        </div>
        <button onClick={() => void reload()} className="text-xs text-[#122AD5] font-semibold hover:underline">
          Recarregar
        </button>
      </header>

      <form onSubmit={handleCreate} className="mb-6 space-y-3 border-b border-[#E0E3EB] pb-6">
        <h3 className="text-sm font-semibold text-[#0D0D0D]">Adicionar avaliação manual</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do cliente"
            className="border border-[#E0E3EB] rounded-md px-3 py-2 text-sm sm:col-span-2"
            data-testid="manual-review-name"
          />
          <select
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            className="border border-[#E0E3EB] rounded-md px-3 py-2 text-sm"
            data-testid="manual-review-rating"
          >
            <option value="5">5 estrelas</option>
            <option value="4">4 estrelas</option>
            <option value="3">3 estrelas</option>
            <option value="2">2 estrelas</option>
            <option value="1">1 estrela</option>
          </select>
        </div>
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Cidade (opcional)"
          className="border border-[#E0E3EB] rounded-md px-3 py-2 text-sm w-full"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Comentário"
          rows={3}
          className="border border-[#E0E3EB] rounded-md px-3 py-2 text-sm w-full"
          data-testid="manual-review-text"
        />
        <button
          type="submit"
          disabled={creating || !name.trim() || !text.trim()}
          className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-60"
          style={{ background: "#122AD5" }}
          data-testid="manual-review-save"
        >
          {creating ? "Adicionando..." : "Adicionar avaliação"}
        </button>
      </form>

      {loading && <div className="text-sm text-[#7A7F8C] py-6 text-center">Carregando...</div>}
      {err && <div className="text-sm text-red-700">{err}</div>}
      {!loading && reviews.length === 0 && (
        <div className="text-sm text-[#7A7F8C] py-6 text-center">Nenhuma avaliação cadastrada ainda.</div>
      )}

      <ul className="space-y-3">
        {reviews.map((r) => (
          <li
            key={r.id}
            className={`border rounded-xl p-4 ${
              r.visible ? "border-[#E0E3EB] bg-white" : "border-[#E0E3EB] bg-[#F5F7FA] opacity-70"
            }`}
            data-testid={`admin-review-${r.id}`}
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-[#0D0D0D]">{r.authorName}</span>
                  <span
                    className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                      r.source === "google"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {r.source}
                  </span>
                  <span className="text-xs text-amber-600">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                  {r.city && <span className="text-xs text-[#7A7F8C]">· {r.city}</span>}
                </div>
                <p className="text-sm text-[#2A2D38] mt-2 leading-relaxed">{r.text}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => void toggleVisible(r)}
                  className="text-xs px-3 py-1 rounded-md border border-[#122AD5]/30 text-[#122AD5] hover:bg-[#122AD5]/5"
                >
                  {r.visible ? "Ocultar" : "Exibir"}
                </button>
                <button
                  onClick={() => void deleteReview(r)}
                  className="text-xs px-3 py-1 rounded-md border border-red-200 text-red-700 hover:bg-red-50"
                >
                  Excluir
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// SMTP settings — host, port, security, user, password, sender, test send
// ---------------------------------------------------------------------------
type SmtpSettingsProps = {
  settings: AppSettings;
  adminKey: string;
  baseUrl: string;
  onChange: () => void | Promise<void>;
};

function SmtpSettings({ settings, adminKey, baseUrl, onChange }: SmtpSettingsProps) {
  const [host, setHost] = useState(settings.smtp_host);
  const [port, setPort] = useState(settings.smtp_port);
  const [secure, setSecure] = useState(settings.smtp_secure || "auto");
  const [user, setUser] = useState(settings.smtp_user);
  const [password, setPassword] = useState(settings.smtp_password);
  const [showPwd, setShowPwd] = useState(false);
  const [fromEmail, setFromEmail] = useState(settings.smtp_from_email);
  const [fromName, setFromName] = useState(settings.smtp_from_name);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [testTo, setTestTo] = useState(settings.interest_notification_email || "");
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setHost(settings.smtp_host);
    setPort(settings.smtp_port);
    setSecure(settings.smtp_secure || "auto");
    setUser(settings.smtp_user);
    setPassword(settings.smtp_password);
    setFromEmail(settings.smtp_from_email);
    setFromName(settings.smtp_from_name);
  }, [
    settings.smtp_host,
    settings.smtp_port,
    settings.smtp_secure,
    settings.smtp_user,
    settings.smtp_password,
    settings.smtp_from_email,
    settings.smtp_from_name,
  ]);

  const dirty =
    host.trim() !== settings.smtp_host ||
    port.trim() !== settings.smtp_port ||
    secure !== (settings.smtp_secure || "auto") ||
    user.trim() !== settings.smtp_user ||
    password !== settings.smtp_password ||
    fromEmail.trim() !== settings.smtp_from_email ||
    fromName.trim() !== settings.smtp_from_name;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await adminFetch(`${baseUrl}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminKey}` },
        body: JSON.stringify({
          smtp_host: host.trim(),
          smtp_port: port.trim(),
          smtp_secure: secure,
          smtp_user: user.trim(),
          smtp_password: password,
          smtp_from_email: fromEmail.trim(),
          smtp_from_name: fromName.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail = body?.details?.fieldErrors
          ? Object.entries(body.details.fieldErrors)
              .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`)
              .join(" · ")
          : null;
        throw new Error(detail || body?.error || `HTTP ${res.status}`);
      }
      setSavedAt(Date.now());
      await onChange();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!testTo.trim()) {
      setTestMsg({ ok: false, text: "Informe um e-mail para enviar o teste." });
      return;
    }
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await adminFetch(`${baseUrl}/api/settings/smtp/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminKey}` },
        body: JSON.stringify({ to: testTo.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTestMsg({ ok: false, text: body?.error || `HTTP ${res.status}` });
        return;
      }
      setTestMsg({ ok: true, text: `E-mail de teste enviado para ${testTo.trim()}.` });
    } catch (err) {
      setTestMsg({ ok: false, text: err instanceof Error ? err.message : "Falha de rede." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-[#E0E3EB] p-6" data-testid="smtp-settings">
      <header className="mb-4">
        <h2 className="font-bold text-[#0D0D0D] text-base">Servidor de e-mail (SMTP)</h2>
        <p className="text-sm text-[#7A7F8C] mt-1">
          Conecte uma caixa de e-mail real para o site enviar mensagens de contato, notificações
          de novos cadastros e relatórios automáticos. Dica: no Hostinger/cPanel, crie a conta
          (ex.: <code>contato@seudominio.com.br</code>) e copie host, porta, usuário e senha.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 text-xs text-[#7A7F8C] md:col-span-2">
            <span>Servidor (host)</span>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="smtp.hostinger.com"
              className="border border-[#E0E3EB] rounded-md px-3 py-2 bg-white text-sm text-[#0D0D0D] focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
              data-testid="smtp-host"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[#7A7F8C]">
            <span>Porta</span>
            <input
              type="text"
              inputMode="numeric"
              value={port}
              onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="465"
              className="border border-[#E0E3EB] rounded-md px-3 py-2 bg-white text-sm text-[#0D0D0D] focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
              data-testid="smtp-port"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 text-xs text-[#7A7F8C]">
            <span>Segurança</span>
            <select
              value={secure}
              onChange={(e) => setSecure(e.target.value)}
              className="border border-[#E0E3EB] rounded-md px-3 py-2 bg-white text-sm text-[#0D0D0D] focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
              data-testid="smtp-secure"
            >
              <option value="auto">Automática (SSL na 465, STARTTLS nas demais)</option>
              <option value="true">SSL/TLS (porta 465)</option>
              <option value="false">STARTTLS (porta 587/25)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-[#7A7F8C]">
            <span>Usuário</span>
            <input
              type="text"
              autoComplete="off"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="contato@seudominio.com.br"
              className="border border-[#E0E3EB] rounded-md px-3 py-2 bg-white text-sm text-[#0D0D0D] focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
              data-testid="smtp-user"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[#7A7F8C]">
            <span>Senha</span>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-[#E0E3EB] rounded-md px-3 py-2 pr-16 bg-white text-sm text-[#0D0D0D] focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
                data-testid="smtp-password"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#0040FF] hover:underline"
              >
                {showPwd ? "ocultar" : "mostrar"}
              </button>
            </div>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-[#7A7F8C]">
            <span>Remetente — nome</span>
            <input
              type="text"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="Provider Mais Fibra"
              className="border border-[#E0E3EB] rounded-md px-3 py-2 bg-white text-sm text-[#0D0D0D] focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
              data-testid="smtp-from-name"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[#7A7F8C]">
            <span>Remetente — e-mail</span>
            <input
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder="contato@seudominio.com.br"
              className="border border-[#E0E3EB] rounded-md px-3 py-2 bg-white text-sm text-[#0D0D0D] focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
              data-testid="smtp-from-email"
            />
          </label>
        </div>

        {errorMsg && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {errorMsg}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={!dirty || saving}
            className="text-sm font-semibold px-4 py-2 rounded-md bg-[#0040FF] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="smtp-save"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
          {savedAt && !dirty && (
            <span className="text-xs text-emerald-600">Salvo.</span>
          )}
        </div>
      </form>

      <div className="mt-6 pt-5 border-t border-[#E0E3EB]">
        <h3 className="text-sm font-bold text-[#0D0D0D] mb-2">Enviar e-mail de teste</h3>
        <p className="text-xs text-[#7A7F8C] mb-3">
          Use as configurações já salvas para tentar uma entrega real. Se algo estiver errado, a
          mensagem de erro indicará o que ajustar (host, porta, usuário ou senha).
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-[#7A7F8C] flex-1 min-w-[260px]">
            <span>Enviar para</span>
            <input
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="seu-email@exemplo.com"
              className="border border-[#E0E3EB] rounded-md px-3 py-2 bg-white text-sm text-[#0D0D0D] focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30"
              data-testid="smtp-test-to"
            />
          </label>
          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={testing || dirty}
            className="text-sm font-semibold px-4 py-2 rounded-md border border-[#0040FF] text-[#0040FF] hover:bg-[#0040FF]/5 disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="smtp-test-send"
            title={dirty ? "Salve as mudanças antes de testar" : ""}
          >
            {testing ? "Enviando…" : "Enviar teste"}
          </button>
        </div>
        {testMsg && (
          <div
            className={`mt-3 rounded-md border px-3 py-2 text-xs ${
              testMsg.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {testMsg.text}
          </div>
        )}
      </div>
    </section>
  );
}

type TwoFactorPanelProps = { adminKey: string; baseUrl: string };

type BotSummary = {
  sharePageBots: number;
  sharePageHumans: number;
  otherBots: number;
  otherHumans: number;
};

type RecentClickRow = {
  id: number;
  clickedAt: string;
  planSpeed: string;
  planPrice: string;
  source: string;
  city: string | null;
  userAgent: string | null;
  countryCode: string | null;
  countryName: string | null;
  geoRegion: string | null;
  geoCity: string | null;
  isBot: boolean;
};

type TopCountryRow = {
  countryCode: string | null;
  countryName: string | null;
  humans: number;
  bots: number;
  total: number;
};

type TopCountriesResponse = {
  rows: TopCountryRow[];
  totalAll: number;
  totalIdentified: number;
  totalUnknown: number;
};

// Convert ISO 3166-1 alpha-2 country code to its emoji flag (regional indicator
// symbols). Returns an empty string for null / invalid codes so the UI can
// gracefully show just the country name.
function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "";
  const cc = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "";
  const A = 0x41;
  const base = 0x1f1e6;
  return String.fromCodePoint(base + cc.charCodeAt(0) - A, base + cc.charCodeAt(1) - A);
}

function BotVsHumanPanel({
  adminKey,
  baseUrl,
  statsRange,
  customFrom,
  customTo,
  cityFilter,
}: {
  adminKey: string;
  baseUrl: string;
  statsRange: StatsRange;
  customFrom: string;
  customTo: string;
  cityFilter: string | null;
}) {
  const [summary, setSummary] = useState<BotSummary | null>(null);
  const [rows, setRows] = useState<RecentClickRow[]>([]);
  const [topCountries, setTopCountries] = useState<TopCountriesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [kind, setKind] = useState<"all" | "humans" | "bots">("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const rangeParams = useMemo(() => {
    const params = new URLSearchParams();
    if (statsRange === "custom" && customFrom && customTo) {
      const since = new Date(`${customFrom}T00:00:00`);
      const until = new Date(`${customTo}T00:00:00`);
      until.setDate(until.getDate() + 1);
      if (!Number.isNaN(since.getTime()) && !Number.isNaN(until.getTime()) && until > since) {
        params.set("since", since.toISOString());
        params.set("until", until.toISOString());
      }
    } else if (statsRange === "today") {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      params.set("since", since.toISOString());
    } else if (statsRange === "week") {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      params.set("since", since.toISOString());
    }
    if (cityFilter) params.set("city", cityFilter);
    return params;
  }, [statsRange, customFrom, customTo, cityFilter]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const summaryUrl = `${baseUrl}/api/clicks/bot-summary${rangeParams.toString() ? `?${rangeParams.toString()}` : ""}`;
      const recentParams = new URLSearchParams(rangeParams);
      recentParams.set("limit", "100");
      if (kind !== "all") recentParams.set("kind", kind);
      if (debouncedSearch) recentParams.set("q", debouncedSearch);
      const recentUrl = `${baseUrl}/api/clicks/recent?${recentParams.toString()}`;
      const countriesUrl = `${baseUrl}/api/clicks/top-countries${rangeParams.toString() ? `?${rangeParams.toString()}` : ""}`;
      const [sRes, rRes, cRes] = await Promise.all([
        adminFetch(summaryUrl, { headers: { Authorization: `Bearer ${adminKey}` } }),
        adminFetch(recentUrl, { headers: { Authorization: `Bearer ${adminKey}` } }),
        adminFetch(countriesUrl, { headers: { Authorization: `Bearer ${adminKey}` } }),
      ]);
      if (!sRes.ok) throw new Error(`HTTP ${sRes.status}`);
      if (!rRes.ok) throw new Error(`HTTP ${rRes.status}`);
      const sData = (await sRes.json()) as BotSummary;
      const rData = (await rRes.json()) as { rows: RecentClickRow[] };
      setSummary(sData);
      setRows(rData.rows);
      if (cRes.ok) {
        const cData = (await cRes.json()) as TopCountriesResponse;
        setTopCountries(cData);
      } else {
        setTopCountries(null);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao carregar.");
    } finally {
      setLoading(false);
    }
  }, [adminKey, baseUrl, rangeParams, kind, debouncedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  const sharePageTotal = (summary?.sharePageBots ?? 0) + (summary?.sharePageHumans ?? 0);
  const sharePageBotPct = sharePageTotal > 0
    ? Math.round(((summary?.sharePageBots ?? 0) / sharePageTotal) * 100)
    : 0;
  const otherTotal = (summary?.otherBots ?? 0) + (summary?.otherHumans ?? 0);
  const otherBotPct = otherTotal > 0
    ? Math.round(((summary?.otherBots ?? 0) / otherTotal) * 100)
    : 0;

  return (
    <section className="bg-white rounded-xl border border-[#E0E3EB] px-5 py-4" data-testid="bot-vs-human-panel">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="font-bold text-[#0D0D0D] text-base">Robôs vs. visitantes reais</h2>
          <p className="text-xs text-[#7A7F8C] mt-0.5">
            Origem do tráfego identificada pelo User-Agent. Aplica o mesmo filtro de período/cidade dos cliques acima.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="text-xs text-[#0040FF] hover:underline disabled:opacity-50"
        >
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      {err && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 mb-3 text-xs">
          {err}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl border border-[#E0E3EB] px-4 py-3">
          <div className="text-xs font-semibold text-[#7A7F8C] uppercase tracking-wide">
            Página de compartilhamento (WhatsApp)
          </div>
          <div className="flex items-baseline gap-2 mt-1 flex-wrap">
            <span className="text-2xl font-black text-[#2A2D38] tabular-nums">
              {(summary?.sharePageHumans ?? 0).toLocaleString("pt-BR")}
            </span>
            <span className="text-xs text-[#7A7F8C]">humanos</span>
            <span className="text-[#7A7F8C]" aria-hidden="true">·</span>
            <span className="text-2xl font-black text-[#A1A6B0] tabular-nums">
              {(summary?.sharePageBots ?? 0).toLocaleString("pt-BR")}
            </span>
            <span className="text-xs text-[#7A7F8C]">robôs ({sharePageBotPct}%)</span>
          </div>
          {sharePageTotal > 0 && (
            <div className="h-2 rounded-full bg-[#A1A6B0] overflow-hidden mt-2" title={`${sharePageBotPct}% robôs`}>
              <div
                className="h-full bg-[#0040FF]"
                style={{ width: `${100 - sharePageBotPct}%` }}
              />
            </div>
          )}
        </div>
        <div className="rounded-xl border border-[#E0E3EB] px-4 py-3">
          <div className="text-xs font-semibold text-[#7A7F8C] uppercase tracking-wide">
            Demais cliques (CTAs do site)
          </div>
          <div className="flex items-baseline gap-2 mt-1 flex-wrap">
            <span className="text-2xl font-black text-[#2A2D38] tabular-nums">
              {(summary?.otherHumans ?? 0).toLocaleString("pt-BR")}
            </span>
            <span className="text-xs text-[#7A7F8C]">humanos</span>
            <span className="text-[#7A7F8C]" aria-hidden="true">·</span>
            <span className="text-2xl font-black text-[#A1A6B0] tabular-nums">
              {(summary?.otherBots ?? 0).toLocaleString("pt-BR")}
            </span>
            <span className="text-xs text-[#7A7F8C]">robôs ({otherBotPct}%)</span>
          </div>
          {otherTotal > 0 && (
            <div className="h-2 rounded-full bg-[#A1A6B0] overflow-hidden mt-2" title={`${otherBotPct}% robôs`}>
              <div
                className="h-full bg-[#0040FF]"
                style={{ width: `${100 - otherBotPct}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {topCountries && topCountries.rows.length > 0 && (
        <div className="rounded-xl border border-[#E0E3EB] px-4 py-3 mb-4" data-testid="top-countries-panel">
          <div className="flex items-baseline justify-between gap-2 flex-wrap mb-2">
            <div className="text-xs font-semibold text-[#7A7F8C] uppercase tracking-wide">
              Origem geográfica (por IP)
            </div>
            <div className="text-[11px] text-[#7A7F8C]">
              {topCountries.totalIdentified.toLocaleString("pt-BR")} de {topCountries.totalAll.toLocaleString("pt-BR")} cliques identificados
              {topCountries.totalUnknown > 0 && (
                <> · {topCountries.totalUnknown.toLocaleString("pt-BR")} sem geo</>
              )}
            </div>
          </div>
          <ul className="space-y-1.5">
            {topCountries.rows.map((c) => {
              const pct = topCountries.totalIdentified > 0
                ? Math.round((c.total / topCountries.totalIdentified) * 100)
                : 0;
              const flag = countryFlag(c.countryCode);
              const label = c.countryName ?? c.countryCode ?? "Desconhecido";
              return (
                <li
                  key={c.countryCode ?? "unknown"}
                  className="flex items-center gap-3"
                  data-testid={`top-country-${c.countryCode ?? "unknown"}`}
                >
                  <span className="text-base leading-none w-5 text-center" aria-hidden="true">{flag || "🏳️"}</span>
                  <span className="text-xs font-semibold text-[#2A2D38] w-32 truncate" title={label}>
                    {label}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-[#EEF0F5] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#0040FF]"
                      style={{ width: `${Math.max(pct, c.total > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums text-[#2A2D38] w-16 text-right">
                    {c.total.toLocaleString("pt-BR")}
                  </span>
                  <span className="text-[10px] text-[#7A7F8C] w-10 text-right tabular-nums">{pct}%</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-bold text-sm text-[#0D0D0D]">Cliques recentes</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border border-[#E0E3EB] bg-white p-0.5" role="group" aria-label="Filtrar por tipo">
            {([
              { id: "all", label: "Todos" },
              { id: "humans", label: "Humanos" },
              { id: "bots", label: "Robôs" },
            ] as const).map((opt) => {
              const active = kind === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setKind(opt.id)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                    active ? "bg-[#0040FF] text-white" : "text-[#7A7F8C] hover:text-[#0D0D0D]"
                  }`}
                  aria-pressed={active}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar User-Agent..."
            aria-label="Buscar User-Agent"
            className="text-xs border border-[#E0E3EB] rounded-md px-2 py-1 bg-white text-[#2A2D38] focus:outline-none focus:ring-2 focus:ring-[#0040FF]/30 w-44"
          />
        </div>
      </div>

      {rows.length === 0 && !loading ? (
        <div className="text-center text-sm text-[#7A7F8C] py-6">Nenhum clique encontrado.</div>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[#7A7F8C] font-semibold border-b border-[#E0E3EB]">
                <th className="px-2 py-2">Quando</th>
                <th className="px-2 py-2">Tipo</th>
                <th className="px-2 py-2">País</th>
                <th className="px-2 py-2">Plano / Cidade</th>
                <th className="px-2 py-2">Origem</th>
                <th className="px-2 py-2">User-Agent</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isCity = r.planSpeed === "city";
                return (
                  <tr key={r.id} className="border-b border-[#F0F2F5] align-top">
                    <td className="px-2 py-2 whitespace-nowrap text-[#2A2D38] tabular-nums">
                      {new Date(r.clickedAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={
                          r.isBot
                            ? { background: "#EEF0F5", color: "#7A7F8C" }
                            : { background: "#E6F8EC", color: "#00A030" }
                        }
                      >
                        {r.isBot ? "robô" : "humano"}
                      </span>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-[#2A2D38]">
                      {r.countryCode ? (
                        <span
                          className="inline-flex items-center gap-1"
                          title={[r.countryName ?? r.countryCode, r.geoRegion, r.geoCity]
                            .filter(Boolean)
                            .join(" · ")}
                        >
                          <span aria-hidden="true">{countryFlag(r.countryCode) || "🏳️"}</span>
                          <span className="text-[11px]">{r.countryCode}</span>
                          {r.geoCity && (
                            <span className="text-[10px] text-[#7A7F8C] truncate max-w-[6rem]">
                              {r.geoCity}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="italic text-[#7A7F8C] text-[11px]">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-[#2A2D38]">
                      {isCity ? (
                        <span>Cidade · <strong>{r.planPrice}</strong></span>
                      ) : (
                        <span><strong>{r.planSpeed}</strong> · R$ {r.planPrice}</span>
                      )}
                      {r.city && !isCity && (
                        <span className="text-[#7A7F8C]"> · {r.city}</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-[#2A2D38]">
                      <code className="text-[10px] bg-[#F5F7FA] px-1 py-0.5 rounded">{r.source}</code>
                    </td>
                    <td className="px-2 py-2 text-[#2A2D38] max-w-md">
                      <span className="text-[11px] break-all" title={r.userAgent ?? ""}>
                        {r.userAgent ?? <span className="italic text-[#7A7F8C]">(sem User-Agent)</span>}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="text-[11px] text-[#7A7F8C] mt-2">
            Mostrando até 100 cliques mais recentes. Use o exportador "CSV (bruto)" acima para baixar todos com User-Agent e marca de robô.
          </div>
        </div>
      )}
    </section>
  );
}

type AuditLogItem = {
  id: number;
  userId: number | null;
  email: string | null;
  action: string;
  target: string | null;
  payloadSummary: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

function AuditLogPanel({ adminKey, baseUrl }: { adminKey: string; baseUrl: string }) {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [emailFilter, setEmailFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams({ limit: "200" });
      if (emailFilter.trim()) qs.set("email", emailFilter.trim());
      if (actionFilter.trim()) qs.set("action", actionFilter.trim());
      const res = await adminFetch(`${baseUrl}/api/admin/audit?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${adminKey}` },
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items: AuditLogItem[]; total: number };
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao carregar histórico.");
    } finally {
      setLoading(false);
    }
  }, [adminKey, baseUrl, emailFilter, actionFilter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="bg-white rounded-2xl border border-[#E0E3EB] p-6">
      <header className="mb-4">
        <h2 className="text-lg font-bold text-[#0D0D0D]">Histórico de ações</h2>
        <p className="text-sm text-[#7A7F8C]">
          Últimos 90 dias. Toda alteração feita no painel é registrada com data, usuário, IP e endpoint.
        </p>
      </header>
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Filtrar por e-mail"
          value={emailFilter}
          onChange={(e) => setEmailFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-[#E0E3EB] rounded-md min-w-[220px]"
          data-testid="audit-filter-email"
        />
        <input
          type="text"
          placeholder="Filtrar por ação (ex: update:plans)"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-[#E0E3EB] rounded-md min-w-[220px]"
          data-testid="audit-filter-action"
        />
        <button
          type="button"
          onClick={load}
          className="px-4 py-1.5 text-sm font-semibold rounded-md bg-[#122AD5] text-white hover:bg-[#0F22B5]"
          data-testid="audit-refresh"
        >
          {loading ? "Carregando..." : "Atualizar"}
        </button>
        <span className="ml-auto text-xs text-[#7A7F8C] self-center">
          {total} {total === 1 ? "registro" : "registros"}
        </span>
      </div>
      {err && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 mb-3 text-sm">{err}</div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="audit-table">
          <thead>
            <tr className="text-left text-xs text-[#7A7F8C] border-b border-[#E0E3EB]">
              <th className="py-2 pr-3">Data</th>
              <th className="py-2 pr-3">Usuário</th>
              <th className="py-2 pr-3">Ação</th>
              <th className="py-2 pr-3">Alvo</th>
              <th className="py-2 pr-3">IP</th>
              <th className="py-2 pr-3">Resumo</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-[#7A7F8C]">Nenhum registro.</td>
              </tr>
            )}
            {items.map((it) => (
              <tr key={it.id} className="border-b border-[#F0F2F7]">
                <td className="py-2 pr-3 whitespace-nowrap text-[#0D0D0D]">
                  {new Date(it.createdAt).toLocaleString("pt-BR")}
                </td>
                <td className="py-2 pr-3 text-[#0D0D0D]">{it.email ?? "—"}</td>
                <td className="py-2 pr-3 font-mono text-xs text-[#0D0D0D]">{it.action}</td>
                <td className="py-2 pr-3 font-mono text-xs text-[#7A7F8C] break-all">{it.target ?? "—"}</td>
                <td className="py-2 pr-3 font-mono text-xs text-[#7A7F8C]">{it.ip ?? "—"}</td>
                <td className="py-2 pr-3 font-mono text-xs text-[#7A7F8C] break-all">
                  {it.payloadSummary ? JSON.stringify(it.payloadSummary) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TwoFactorPanel({ adminKey, baseUrl }: TwoFactorPanelProps) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [setupQr, setSetupQr] = useState<string | null>(null);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await adminFetch(`${baseUrl}/api/auth/me`, {
        credentials: "include",
        headers: { Authorization: `Bearer ${adminKey}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { totpEnabled?: boolean; recoveryCodesRemaining?: number };
      setEnabled(Boolean(data.totpEnabled));
      setRemaining(data.recoveryCodesRemaining ?? 0);
    } catch { /* ignore */ }
  }, [adminKey, baseUrl]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function startSetup() {
    setMsg(null);
    setBusy(true);
    try {
      const res = await adminFetch(`${baseUrl}/api/auth/2fa/setup`, {
        method: "POST",
        credentials: "include",
        headers: { Authorization: `Bearer ${adminKey}`, "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSetupQr(data.qr);
      setSetupSecret(data.secret);
      setRecoveryCodes(null);
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Falha ao iniciar 2FA." });
    } finally { setBusy(false); }
  }

  async function confirmEnable(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const res = await adminFetch(`${baseUrl}/api/auth/2fa/enable`, {
        method: "POST",
        credentials: "include",
        headers: { Authorization: `Bearer ${adminKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Código inválido.");
      setRecoveryCodes(data.recoveryCodes ?? []);
      setSetupQr(null);
      setSetupSecret(null);
      setCode("");
      setMsg({ kind: "ok", text: "2FA ativado. Guarde seus códigos de recuperação." });
      await refresh();
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Falha." });
    } finally { setBusy(false); }
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const res = await adminFetch(`${baseUrl}/api/auth/2fa/disable`, {
        method: "POST",
        credentials: "include",
        headers: { Authorization: `Bearer ${adminKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha.");
      setDisablePassword("");
      setMsg({ kind: "ok", text: "2FA desativado." });
      await refresh();
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Falha." });
    } finally { setBusy(false); }
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-[#E0E3EB] p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold text-[#0D0D0D]">Verificação em duas etapas (2FA)</h2>
          <p className="text-xs text-[#7A7F8C] mt-1">
            Use Google Authenticator, Authy ou 1Password para gerar um código de 6 dígitos a cada login.
          </p>
        </div>
        {enabled !== null && (
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
            {enabled ? "Ativo" : "Desativado"}
          </span>
        )}
      </div>

      {msg && (
        <div className={`mb-4 px-3 py-2 rounded-lg text-sm ${msg.kind === "ok" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {msg.text}
        </div>
      )}

      {recoveryCodes && (
        <div className="mb-4 p-4 rounded-lg bg-[#FFF8D6] border-2 border-[#FFD600]">
          <p className="text-sm font-bold text-[#5C4500] mb-2">
            Salve estes 8 códigos de recuperação em local seguro. Eles só aparecem UMA vez.
          </p>
          <div className="grid grid-cols-2 gap-2 font-mono text-sm">
            {recoveryCodes.map((c) => (
              <div key={c} className="bg-white px-3 py-1.5 rounded border border-[#FFD600] tracking-wider">{c}</div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              const blob = new Blob([recoveryCodes.join("\n")], { type: "text/plain" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = "codigos-recuperacao-providermaisfibra.txt"; a.click();
              URL.revokeObjectURL(url);
            }}
            className="mt-3 text-xs font-semibold text-[#5C4500] underline"
          >
            Baixar como arquivo .txt
          </button>
        </div>
      )}

      {enabled === false && !setupQr && (
        <button
          type="button"
          onClick={startSetup}
          disabled={busy}
          className="px-4 py-2 rounded-lg font-bold text-sm text-white disabled:opacity-60"
          style={{ background: "#0040FF" }}
        >
          {busy ? "Gerando..." : "Ativar 2FA"}
        </button>
      )}

      {setupQr && (
        <form onSubmit={confirmEnable} className="space-y-3">
          <p className="text-sm text-[#2A2D38]">
            1. Abra seu app autenticador e leia o QR code abaixo.
          </p>
          <img src={setupQr} alt="QR code 2FA" className="border border-[#E0E3EB] rounded-lg" width={200} height={200} />
          {setupSecret && (
            <p className="text-xs text-[#7A7F8C]">
              Não consegue ler o QR? Digite manualmente: <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">{setupSecret}</code>
            </p>
          )}
          <p className="text-sm text-[#2A2D38]">2. Digite o código de 6 dígitos que apareceu no app:</p>
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="w-40 border border-[#E0E3EB] rounded-lg px-3 py-2 text-sm text-center tracking-widest"
            placeholder="000000"
            required
          />
          <div className="flex gap-2">
            <button type="submit" disabled={busy || code.length !== 6} className="px-4 py-2 rounded-lg font-bold text-sm text-white disabled:opacity-60" style={{ background: "#0040FF" }}>
              {busy ? "Verificando..." : "Confirmar e ativar"}
            </button>
            <button type="button" onClick={() => { setSetupQr(null); setSetupSecret(null); setCode(""); }} className="px-4 py-2 rounded-lg font-medium text-sm text-[#2A2D38] border border-[#E0E3EB]">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {enabled === true && !recoveryCodes && (
        <div className="space-y-3">
          <p className="text-sm text-[#2A2D38]">
            2FA está ativo. Códigos de recuperação restantes: <strong>{remaining}</strong>
            {remaining <= 2 && remaining > 0 && (
              <span className="text-orange-600"> — gere novos em breve desativando e reativando o 2FA.</span>
            )}
          </p>
          <form onSubmit={disable} className="flex flex-col sm:flex-row gap-2 items-start sm:items-end">
            <div className="flex-1 max-w-xs">
              <label className="block text-xs font-medium text-[#2A2D38] mb-1">Confirme sua senha para desativar</label>
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                className="w-full border border-[#E0E3EB] rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <button type="submit" disabled={busy || !disablePassword} className="px-4 py-2 rounded-lg font-bold text-sm text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-60">
              {busy ? "..." : "Desativar 2FA"}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}


type BotUaPatternRow = {
  id: number;
  pattern: string;
  label: string;
  enabled: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type PreviewResult = {
  total: number;
  matched: number;
  wouldFlip: number;
  sampleUserAgent: string | null;
};

function BotUaPatternsPanel({ adminKey, baseUrl }: { adminKey: string; baseUrl: string }) {
  const [rows, setRows] = useState<BotUaPatternRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [newPattern, setNewPattern] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await adminFetch(`${baseUrl}/api/bot-ua-patterns`, {
        headers: { Authorization: `Bearer ${adminKey}` },
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as BotUaPatternRow[];
      setRows(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao carregar padrões.");
    } finally {
      setLoading(false);
    }
  }, [adminKey, baseUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(row: BotUaPatternRow) {
    try {
      const res = await adminFetch(`${baseUrl}/api/bot-ua-patterns/${row.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${adminKey}`, "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enabled: !row.enabled }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao atualizar.");
    }
  }

  async function editPattern(row: BotUaPatternRow) {
    const next = window.prompt("Editar padrão regex:", row.pattern);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === row.pattern) return;
    try {
      const res = await adminFetch(`${baseUrl}/api/bot-ua-patterns/${row.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${adminKey}`, "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pattern: trimmed }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao salvar.");
    }
  }

  async function remove(row: BotUaPatternRow) {
    if (!window.confirm(`Remover padrão "${row.label || row.pattern}"?`)) return;
    try {
      const res = await adminFetch(`${baseUrl}/api/bot-ua-patterns/${row.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminKey}` },
        credentials: "include",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao remover.");
    }
  }

  async function runPreview() {
    if (!newPattern.trim()) return;
    setPreviewing(true);
    setPreview(null);
    try {
      const res = await adminFetch(`${baseUrl}/api/bot-ua-patterns/preview`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminKey}`, "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pattern: newPattern.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setPreview(data as PreviewResult);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao avaliar padrão.");
    } finally {
      setPreviewing(false);
    }
  }

  async function create() {
    if (!newPattern.trim()) return;
    setCreating(true);
    try {
      const res = await adminFetch(`${baseUrl}/api/bot-ua-patterns`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminKey}`, "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          pattern: newPattern.trim(),
          label: newLabel.trim(),
          enabled: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setNewPattern("");
      setNewLabel("");
      setPreview(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao criar padrão.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-[#E0E3EB] p-6" data-testid="bot-ua-patterns">
      <header className="mb-4">
        <h2 className="text-lg font-bold text-[#0D0D0D]">Padrões de bots (User-Agent)</h2>
        <p className="text-sm text-[#7A7F8C]">
          Expressões regulares (case-insensitive) que classificam um clique como bot. Aplicam-se imediatamente à
          detecção em tempo real e às visualizações de bots vs humanos. O padrão WhatsApp link-preview "puro"
          é tratado por uma heurística embutida.
        </p>
      </header>

      {err && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 mb-3 text-sm">{err}</div>
      )}

      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[#7A7F8C] border-b border-[#E0E3EB]">
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Rótulo</th>
              <th className="py-2 pr-3">Padrão</th>
              <th className="py-2 pr-3">Origem</th>
              <th className="py-2 pr-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-[#7A7F8C]">Nenhum padrão.</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[#F0F2F7]" data-testid={`bot-ua-row-${r.id}`}>
                <td className="py-2 pr-3">
                  <button
                    type="button"
                    onClick={() => toggle(r)}
                    className={`px-2 py-0.5 rounded text-xs font-semibold ${r.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                    data-testid={`bot-ua-toggle-${r.id}`}
                  >
                    {r.enabled ? "Ativo" : "Desativado"}
                  </button>
                </td>
                <td className="py-2 pr-3 text-[#0D0D0D]">{r.label || "—"}</td>
                <td className="py-2 pr-3 font-mono text-xs text-[#0D0D0D] break-all max-w-[420px]">{r.pattern}</td>
                <td className="py-2 pr-3 text-xs text-[#7A7F8C]">{r.isDefault ? "Padrão" : "Personalizado"}</td>
                <td className="py-2 pr-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => editPattern(r)}
                    className="text-xs text-[#122AD5] hover:underline mr-3"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(r)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-[#E0E3EB] pt-4">
        <h3 className="text-sm font-bold text-[#0D0D0D] mb-3">Adicionar novo padrão</h3>
        <div className="grid gap-3 md:grid-cols-2 mb-3">
          <input
            type="text"
            placeholder="Rótulo (ex: MeuCrawler)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="px-3 py-2 text-sm border border-[#E0E3EB] rounded-md"
            data-testid="bot-ua-new-label"
          />
          <input
            type="text"
            placeholder="Regex (ex: meucrawler|outro-bot)"
            value={newPattern}
            onChange={(e) => { setNewPattern(e.target.value); setPreview(null); }}
            className="px-3 py-2 text-sm border border-[#E0E3EB] rounded-md font-mono"
            data-testid="bot-ua-new-pattern"
          />
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <button
            type="button"
            onClick={runPreview}
            disabled={!newPattern.trim() || previewing}
            className="px-4 py-1.5 text-sm font-semibold rounded-md border border-[#122AD5] text-[#122AD5] hover:bg-[#122AD5]/5 disabled:opacity-60"
            data-testid="bot-ua-preview"
          >
            {previewing ? "Avaliando..." : "Pré-visualizar impacto"}
          </button>
          <button
            type="button"
            onClick={create}
            disabled={!newPattern.trim() || creating}
            className="px-4 py-1.5 text-sm font-semibold rounded-md bg-[#122AD5] text-white hover:bg-[#0F22B5] disabled:opacity-60"
            data-testid="bot-ua-create"
          >
            {creating ? "Salvando..." : "Adicionar padrão"}
          </button>
        </div>
        {preview && (
          <div className="mt-4 bg-[#F7F8FB] border border-[#E0E3EB] rounded-md p-3 text-sm text-[#0D0D0D]" data-testid="bot-ua-preview-result">
            <div><strong>{preview.matched.toLocaleString("pt-BR")}</strong> cliques existentes correspondem ao padrão.</div>
            <div className="text-[#7A7F8C]">
              Destes, <strong className="text-[#0D0D0D]">{preview.wouldFlip.toLocaleString("pt-BR")}</strong> mudariam de "humano" para "bot" ao salvar.
            </div>
            {preview.sampleUserAgent && (
              <div className="mt-2 text-xs text-[#7A7F8C]">
                Exemplo de UA: <span className="font-mono break-all">{preview.sampleUserAgent}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
