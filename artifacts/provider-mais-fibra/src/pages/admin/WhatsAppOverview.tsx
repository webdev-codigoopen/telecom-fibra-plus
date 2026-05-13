import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { MessageCircle, Eye, Share2, TrendingUp, MapPin } from "lucide-react";
import { adminFetch } from "../../lib/adminFetch";

type ClickStat = {
  planSpeed: string;
  planPrice: string;
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

type CityConv = {
  city: string;
  total?: number;
  totalClicks?: number;
  conversions?: number;
};
type CityConvResp = { rows?: CityConv[] } | CityConv[];

type HeatmapResp = { cells: { dow: number; hour: number; total: number }[] };

type Props = {
  adminKey: string;
  baseUrl: string;
  since?: string;
  until?: string;
};

function isWppCta(s: string): boolean {
  return s === "whatsapp-cta" || s === "whatsapp-plan" || /^whatsapp-(?!share)/.test(s);
}
function isPreview(s: string): boolean {
  return s === "whatsapp-share" || s.startsWith("whatsapp-share:");
}
function isShareBot(s: string): boolean {
  return s.startsWith("whatsapp-share-bot");
}
function isPlanRow(planSpeed: string): boolean {
  return planSpeed !== "city";
}

export default function WhatsAppOverview({ adminKey, baseUrl, since, until }: Props) {
  const [stats, setStats] = useState<ClickStat[]>([]);
  const [series, setSeries] = useState<TimeseriesRow[]>([]);
  const [interestCount, setInterestCount] = useState(0);
  const [cities, setCities] = useState<CityConv[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (since) params.set("since", since);
    if (until) params.set("until", until);
    const tsParams = new URLSearchParams(params);
    tsParams.set("bucket", "day");
    const qs = params.toString() ? `?${params.toString()}` : "";
    Promise.all([
      adminFetch(`${baseUrl}/api/clicks/stats${qs}`, {
        headers: { Authorization: `Bearer ${adminKey}` },
      }).then((r) => (r.ok ? r.json() : [])) as Promise<ClickStat[]>,
      adminFetch(`${baseUrl}/api/clicks/timeseries?${tsParams.toString()}`, {
        headers: { Authorization: `Bearer ${adminKey}` },
      }).then((r) => (r.ok ? r.json() : [])) as Promise<TimeseriesRow[]>,
      adminFetch(`${baseUrl}/api/demand/interests/count${qs}`, {
        headers: { Authorization: `Bearer ${adminKey}` },
      }).then((r) => (r.ok ? r.json() : null)) as Promise<{ total?: number } | null>,
      adminFetch(`${baseUrl}/api/clicks/cities-conversion${qs}`, {
        headers: { Authorization: `Bearer ${adminKey}` },
      }).then((r) => (r.ok ? r.json() : null)) as Promise<CityConvResp | null>,
      adminFetch(
        `${baseUrl}/api/clicks/heatmap?${new URLSearchParams({
          ...(since ? { since } : {}),
          ...(until ? { until } : {}),
          sourcePrefix: "whatsapp",
        }).toString()}`,
        { headers: { Authorization: `Bearer ${adminKey}` } },
      ).then((r) => (r.ok ? r.json() : null)) as Promise<HeatmapResp | null>,
    ])
      .then(([s, t, i, c, h]) => {
        if (cancelled) return;
        setStats(Array.isArray(s) ? s : []);
        setSeries(Array.isArray(t) ? t : []);
        setInterestCount(typeof i?.total === "number" ? i.total : 0);
        const cityRows = Array.isArray(c) ? c : (c?.rows ?? []);
        setCities(Array.isArray(cityRows) ? cityRows : []);
        setHeatmap(h);
      })
      .catch(() => {
        if (cancelled) return;
        setStats([]); setSeries([]); setInterestCount(0); setCities([]); setHeatmap(null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [adminKey, baseUrl, since, until]);

  const kpis = useMemo(() => {
    let ctaClicks = 0;
    let previews = 0;
    let bots = 0;
    let allHumanClicks = 0;
    for (const s of stats) {
      if (!isPlanRow(s.planSpeed)) continue;
      if (isShareBot(s.source)) { bots += s.total; continue; }
      allHumanClicks += s.total;
      if (isPreview(s.source)) previews += s.total;
      else if (isWppCta(s.source)) ctaClicks += s.total;
    }
    const conversions = interestCount;
    const convRate = ctaClicks > 0 ? Math.round((conversions / ctaClicks) * 1000) / 10 : 0;
    const wppShare = allHumanClicks > 0 ? Math.round((ctaClicks / allHumanClicks) * 1000) / 10 : 0;
    return { ctaClicks, previews, bots, conversions, convRate, wppShare, allHumanClicks };
  }, [stats, interestCount]);

  const topPlans = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of stats) {
      if (!isPlanRow(s.planSpeed)) continue;
      if (isShareBot(s.source)) continue;
      if (!isWppCta(s.source)) continue;
      const k = `${s.planSpeed} · ${s.planPrice}`;
      map.set(k, (map.get(k) ?? 0) + s.total);
    }
    return Array.from(map.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [stats]);

  const topPlan = topPlans[0] ?? null;

  const ctaSeries = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of series) {
      if (!isPlanRow(r.planSpeed)) continue;
      if (isShareBot(r.source)) continue;
      if (!isWppCta(r.source)) continue;
      const date = new Date(r.bucket);
      const key = `${date.getTime()}`;
      map.set(key, (map.get(key) ?? 0) + r.total);
    }
    return Array.from(map.entries())
      .map(([k, v]) => {
        const ts = Number(k);
        return {
          ts,
          label: new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
          total: v,
        };
      })
      .sort((a, b) => a.ts - b.ts);
  }, [series]);

  const hourlyChart = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: `${h}h`, total: 0 }));
    if (heatmap?.cells) {
      for (const c of heatmap.cells) {
        if (c.hour >= 0 && c.hour < 24) buckets[c.hour]!.total += c.total;
      }
    }
    return buckets;
  }, [heatmap]);

  const topCities = useMemo(() => {
    return cities
      .map((c) => ({
        city: c.city,
        total: c.totalClicks ?? c.total ?? 0,
        conv: c.conversions ?? 0,
      }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [cities]);

  if (loading) {
    return <div style={{ padding: 24, color: "var(--as-text3)" }}>Carregando WhatsApp…</div>;
  }

  return (
    <div data-testid="admin-whatsapp-overview">
      <div className="admin-section-title">Visão geral · WhatsApp</div>
      <div className="admin-grid-4">
        <KpiCard
          accent="var(--as-wpp)"
          icon={<MessageCircle size={12} color="var(--as-wpp)" />}
          label="Cliques em CTA WhatsApp"
          value={kpis.ctaClicks.toLocaleString("pt-BR")}
          sub={`${kpis.wppShare}% do tráfego total`}
        />
        <KpiCard
          accent="var(--as-blue-md)"
          icon={<Share2 size={12} color="var(--as-blue-md)" />}
          label="Conversões (interesses)"
          value={kpis.conversions.toLocaleString("pt-BR")}
          sub={`${kpis.convRate}% dos cliques em CTA`}
        />
        <KpiCard
          accent="var(--as-blue)"
          icon={<TrendingUp size={12} color="var(--as-blue)" />}
          label="Plano mais clicado"
          value={topPlan ? topPlan.label : "—"}
          sub={topPlan ? `${topPlan.total.toLocaleString("pt-BR")} cliques` : "Sem dados"}
        />
        <KpiCard
          accent="var(--as-amber)"
          icon={<Eye size={12} color="var(--as-amber)" />}
          label="Previews / Bots"
          value={`${kpis.previews.toLocaleString("pt-BR")} / ${kpis.bots.toLocaleString("pt-BR")}`}
          sub="humanos / robôs em /share"
        />
      </div>

      <div className="admin-grid-2" style={{ marginTop: 12 }}>
        <div className="admin-card">
          <div className="admin-card-title">
            Cliques em CTA WhatsApp por dia
            <span className="admin-card-sub">{ctaSeries.length} pontos</span>
          </div>
          <div style={{ width: "100%", height: 200 }}>
            {ctaSeries.length === 0 ? (
              <Empty>Sem dados no período</Empty>
            ) : (
              <ResponsiveContainer>
                <LineChart data={ctaSeries} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--as-border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--as-text3)" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--as-text3)" }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                  <Line type="monotone" dataKey="total" stroke="var(--as-wpp)" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-title">
            Cliques WhatsApp por hora
            <span className="admin-card-sub">apenas fontes whatsapp*</span>
          </div>
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={hourlyChart} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--as-border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--as-text3)" }} interval={2} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--as-text3)" }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                <Bar dataKey="total" fill="var(--as-blue-md)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="admin-grid-2" style={{ marginTop: 12 }}>
        <div className="admin-card">
          <div className="admin-card-title">
            Top planos por cliques no WhatsApp
            <span className="admin-card-sub">{topPlans.length} planos</span>
          </div>
          <div style={{ width: "100%", height: 220 }}>
            {topPlans.length === 0 ? (
              <Empty>Sem dados no período</Empty>
            ) : (
              <ResponsiveContainer>
                <BarChart data={topPlans} layout="vertical" margin={{ top: 5, right: 10, bottom: 0, left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--as-border)" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "var(--as-text3)" }} />
                  <YAxis dataKey="label" type="category" tick={{ fontSize: 10, fill: "var(--as-text3)" }} width={80} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                  <Bar dataKey="total" fill="var(--as-wpp)" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-title">
            Top cidades por cliques
            <span className="admin-card-sub"><MapPin size={10} style={{ display: "inline", verticalAlign: "middle" }} /> {topCities.length} cidades</span>
          </div>
          {topCities.length === 0 ? (
            <Empty>Sem dados no período</Empty>
          ) : (
            <ol style={{ display: "flex", flexDirection: "column", gap: 6, margin: 0, padding: 0, listStyle: "none" }}>
              {topCities.map((c, idx) => {
                const max = topCities[0]?.total || 1;
                const w = Math.max(4, Math.round((c.total / max) * 100));
                return (
                  <li key={c.city} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span style={{ width: 18, color: "var(--as-text3)", textAlign: "right" }}>{idx + 1}.</span>
                    <span style={{ width: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.city}</span>
                    <div style={{ flex: 1, height: 8, background: "var(--as-bg)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${w}%`, background: "var(--as-blue)" }} />
                    </div>
                    <span className="admin-funnel-pct" style={{ minWidth: 60 }}>
                      {c.total.toLocaleString("pt-BR")}
                      {c.conv > 0 && <span style={{ color: "var(--as-wpp)", marginLeft: 4 }}>·{c.conv}c</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>

      <div className="admin-card" style={{ marginTop: 12 }}>
        <div className="admin-card-title">
          Funil WhatsApp <span className="admin-card-sub">CTA → conversão (interesses)</span>
        </div>
        <Funnel
          steps={[
            { label: "Cliques em CTA", value: kpis.ctaClicks, color: "var(--as-blue)" },
            { label: "Conversões", value: kpis.conversions, color: "var(--as-wpp)" },
          ]}
        />
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ paddingTop: 60, textAlign: "center", fontSize: 12, color: "var(--as-text3)" }}>
      {children}
    </div>
  );
}

function Funnel({ steps }: { steps: { label: string; value: number; color: string }[] }) {
  const max = steps[0]?.value || 1;
  return (
    <>
      {steps.map((s) => {
        const w = Math.max(8, Math.round((s.value / max) * 100));
        const pct = max > 0 ? Math.round((s.value / max) * 1000) / 10 : 0;
        return (
          <div className="admin-funnel-step" key={s.label}>
            <div className="admin-funnel-label">{s.label}</div>
            <div className="admin-funnel-bar" style={{ width: `${w}%`, background: s.color }}>
              {s.value.toLocaleString("pt-BR")}
            </div>
            <div className="admin-funnel-pct">{pct}%</div>
          </div>
        );
      })}
    </>
  );
}

function KpiCard({
  accent, icon, label, value, sub,
}: {
  accent: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="admin-metric-card" style={{ ["--accent" as never]: accent }}>
      <div className="admin-mc-label">{icon} {label}</div>
      <div className="admin-mc-value" style={{ fontSize: 18, lineHeight: 1.2 }}>{value}</div>
      <div className="admin-mc-sub">{sub}</div>
    </div>
  );
}
