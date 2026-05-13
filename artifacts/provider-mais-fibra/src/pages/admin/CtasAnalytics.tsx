import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Target, MousePointerClick, TrendingUp } from "lucide-react";
import { adminFetch } from "../../lib/adminFetch";
import { colorForSource } from "../../lib/sourceColors";

type ClickStat = {
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

type Props = {
  adminKey: string;
  baseUrl: string;
  since?: string;
  until?: string;
};

function isShareBot(s: string): boolean {
  return s.startsWith("whatsapp-share-bot");
}
function isPlanRow(planSpeed: string): boolean {
  return planSpeed !== "city";
}

export default function CtasAnalytics({ adminKey, baseUrl, since, until }: Props) {
  const [stats, setStats] = useState<ClickStat[]>([]);
  const [interestCount, setInterestCount] = useState(0);
  const [cities, setCities] = useState<CityConv[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (since) params.set("since", since);
    if (until) params.set("until", until);
    const qs = params.toString() ? `?${params.toString()}` : "";
    Promise.all([
      adminFetch(`${baseUrl}/api/clicks/stats${qs}`, {
        headers: { Authorization: `Bearer ${adminKey}` },
      }).then((r) => (r.ok ? r.json() : [])) as Promise<ClickStat[]>,
      adminFetch(`${baseUrl}/api/demand/interests/count${qs}`, {
        headers: { Authorization: `Bearer ${adminKey}` },
      }).then((r) => (r.ok ? r.json() : null)) as Promise<{ total?: number } | null>,
      adminFetch(`${baseUrl}/api/clicks/cities-conversion${qs}`, {
        headers: { Authorization: `Bearer ${adminKey}` },
      }).then((r) => (r.ok ? r.json() : null)) as Promise<CityConvResp | null>,
    ])
      .then(([s, i, c]) => {
        if (cancelled) return;
        setStats(Array.isArray(s) ? s : []);
        setInterestCount(typeof i?.total === "number" ? i.total : 0);
        const cityRows = Array.isArray(c) ? c : (c?.rows ?? []);
        setCities(Array.isArray(cityRows) ? cityRows : []);
      })
      .catch(() => {
        if (cancelled) return;
        setStats([]); setInterestCount(0); setCities([]);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [adminKey, baseUrl, since, until]);

  const sources = useMemo(() => {
    const map = new Map<string, number>();
    let total = 0;
    for (const s of stats) {
      if (!isPlanRow(s.planSpeed)) continue;
      if (isShareBot(s.source)) continue;
      map.set(s.source, (map.get(s.source) ?? 0) + s.total);
      total += s.total;
    }
    return {
      total,
      rows: Array.from(map.entries())
        .map(([source, value]) => ({
          source,
          value,
          pct: total > 0 ? Math.round((value / total) * 1000) / 10 : 0,
          color: colorForSource(source),
        }))
        .sort((a, b) => b.value - a.value),
    };
  }, [stats]);

  const totalCtas = sources.total;
  const conversionRate = totalCtas > 0 ? Math.round((interestCount / totalCtas) * 1000) / 10 : 0;

  const topPlans = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of stats) {
      if (!isPlanRow(s.planSpeed)) continue;
      if (isShareBot(s.source)) continue;
      const k = `${s.planSpeed} · ${s.planPrice}`;
      map.set(k, (map.get(k) ?? 0) + s.total);
    }
    return Array.from(map.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [stats]);

  const topCities = useMemo(() => {
    return cities
      .map((c) => ({
        city: c.city,
        total: c.totalClicks ?? c.total ?? 0,
        conv: c.conversions ?? 0,
      }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.conv - a.conv || b.total - a.total)
      .slice(0, 8);
  }, [cities]);

  if (loading) {
    return <div style={{ padding: 24, color: "var(--as-text3)" }}>Carregando CTAs…</div>;
  }

  return (
    <div data-testid="admin-ctas-analytics">
      <div className="admin-section-title">CTAs · Análise</div>
      <div className="admin-grid-4">
        <KpiCard
          accent="var(--as-blue)"
          icon={<MousePointerClick size={12} color="var(--as-blue)" />}
          label="Total de CTAs"
          value={totalCtas.toLocaleString("pt-BR")}
          sub="cliques humanos no período"
        />
        <KpiCard
          accent="var(--as-wpp)"
          icon={<Target size={12} color="var(--as-wpp)" />}
          label="Conversões"
          value={interestCount.toLocaleString("pt-BR")}
          sub={`${conversionRate}% de taxa`}
        />
        <KpiCard
          accent="var(--as-blue-md)"
          icon={<Target size={12} color="var(--as-blue-md)" />}
          label="Origem #1"
          value={sources.rows[0]?.source ?? "—"}
          sub={sources.rows[0] ? `${sources.rows[0].value.toLocaleString("pt-BR")} (${sources.rows[0].pct}%)` : "Sem dados"}
        />
        <KpiCard
          accent="var(--as-amber)"
          icon={<TrendingUp size={12} color="var(--as-amber)" />}
          label="Plano #1"
          value={topPlans[0]?.label.split(" · ")[0] ?? "—"}
          sub={topPlans[0] ? `${topPlans[0].total.toLocaleString("pt-BR")} cliques` : "Sem dados"}
        />
      </div>

      <div className="admin-card" style={{ marginTop: 12 }}>
        <div className="admin-card-title">
          Ranking de CTAs por origem
          <span className="admin-card-sub">{sources.rows.length} fontes</span>
        </div>
        {sources.rows.length === 0 ? (
          <div style={{ paddingTop: 30, textAlign: "center", fontSize: 12, color: "var(--as-text3)" }}>
            Sem dados no período
          </div>
        ) : (
          <ol style={{ display: "flex", flexDirection: "column", gap: 6, margin: 0, padding: 0, listStyle: "none" }}>
            {sources.rows.map((r, idx) => {
              const max = sources.rows[0]?.value || 1;
              const w = Math.max(4, Math.round((r.value / max) * 100));
              return (
                <li key={r.source} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <span style={{ width: 18, color: "var(--as-text3)", textAlign: "right" }}>{idx + 1}.</span>
                  <span style={{ width: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span
                      style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: r.color,
                        marginRight: 6,
                        verticalAlign: "middle",
                      }}
                    />
                    {r.source}
                  </span>
                  <div style={{ flex: 1, height: 8, background: "var(--as-bg)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${w}%`, background: r.color }} />
                  </div>
                  <span className="admin-funnel-pct" style={{ minWidth: 90, textAlign: "right" }}>
                    {r.value.toLocaleString("pt-BR")} ({r.pct}%)
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="admin-grid-2" style={{ marginTop: 12 }}>
        <div className="admin-card">
          <div className="admin-card-title">
            Top planos clicados
            <span className="admin-card-sub">{topPlans.length} planos</span>
          </div>
          <div style={{ width: "100%", height: 220 }}>
            {topPlans.length === 0 ? (
              <div style={{ paddingTop: 60, textAlign: "center", fontSize: 12, color: "var(--as-text3)" }}>
                Sem dados
              </div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={topPlans} layout="vertical" margin={{ top: 5, right: 10, bottom: 0, left: 90 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--as-border)" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "var(--as-text3)" }} />
                  <YAxis dataKey="label" type="category" tick={{ fontSize: 10, fill: "var(--as-text3)" }} width={90} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                  <Bar dataKey="total" fill="var(--as-blue)" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-title">
            Origem dos conversores (cidades)
            <span className="admin-card-sub">{topCities.length} cidades</span>
          </div>
          {topCities.length === 0 ? (
            <div style={{ paddingTop: 60, textAlign: "center", fontSize: 12, color: "var(--as-text3)" }}>
              Sem conversões no período
            </div>
          ) : (
            <ol style={{ display: "flex", flexDirection: "column", gap: 6, margin: 0, padding: 0, listStyle: "none" }}>
              {topCities.map((c, idx) => {
                const max = topCities[0]?.conv || topCities[0]?.total || 1;
                const w = Math.max(4, Math.round(((c.conv || c.total) / max) * 100));
                return (
                  <li key={c.city} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span style={{ width: 18, color: "var(--as-text3)", textAlign: "right" }}>{idx + 1}.</span>
                    <span style={{ width: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.city}</span>
                    <div style={{ flex: 1, height: 8, background: "var(--as-bg)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${w}%`, background: "var(--as-wpp)" }} />
                    </div>
                    <span className="admin-funnel-pct" style={{ minWidth: 80, textAlign: "right" }}>
                      {c.conv}c / {c.total}cl
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
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
