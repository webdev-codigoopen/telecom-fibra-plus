import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Eye, MousePointerClick, MessageCircle, ShieldCheck } from "lucide-react";
import { adminFetch } from "../../lib/adminFetch";
import ClicksHeatmap from "./ClicksHeatmap";

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

type BotSummary = {
  sharePageBots: number;
  sharePageHumans: number;
  otherBots: number;
  otherHumans: number;
};

type Props = {
  adminKey: string;
  baseUrl: string;
  since?: string;
  until?: string;
};

function isBotSource(s: string): boolean {
  return s.startsWith("whatsapp-share-bot");
}
function isPreview(s: string): boolean {
  return s === "whatsapp-share" || s.startsWith("whatsapp-share:");
}

export default function DashboardOverview({ adminKey, baseUrl, since, until }: Props) {
  const [stats, setStats] = useState<ClickStat[]>([]);
  const [series, setSeries] = useState<TimeseriesRow[]>([]);
  const [bots, setBots] = useState<BotSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (since) params.set("since", since);
    if (until) params.set("until", until);
    const seriesParams = new URLSearchParams(params);
    seriesParams.set("bucket", "day");
    const qs = params.toString() ? `?${params.toString()}` : "";
    const sQs = `?${seriesParams.toString()}`;
    Promise.all([
      adminFetch(`${baseUrl}/api/clicks/stats${qs}`, {
        headers: { Authorization: `Bearer ${adminKey}` },
      }).then((r) => (r.ok ? r.json() : [])) as Promise<ClickStat[]>,
      adminFetch(`${baseUrl}/api/clicks/timeseries${sQs}`, {
        headers: { Authorization: `Bearer ${adminKey}` },
      }).then((r) => (r.ok ? r.json() : [])) as Promise<TimeseriesRow[]>,
      adminFetch(`${baseUrl}/api/clicks/bot-summary${qs}`, {
        headers: { Authorization: `Bearer ${adminKey}` },
      }).then((r) => (r.ok ? r.json() : null)) as Promise<BotSummary | null>,
    ])
      .then(([s, t, b]) => {
        if (cancelled) return;
        setStats(Array.isArray(s) ? s : []);
        setSeries(Array.isArray(t) ? t : []);
        setBots(b);
      })
      .catch(() => {
        if (cancelled) return;
        setStats([]); setSeries([]); setBots(null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [adminKey, baseUrl, since, until]);

  const kpis = useMemo(() => {
    let totalClicks = 0;
    let ctaClicks = 0;
    let previews = 0;
    let signups = 0;
    for (const s of stats) {
      if (s.planSpeed === "city") continue;
      if (isBotSource(s.source)) continue;
      totalClicks += s.total;
      if (isPreview(s.source)) {
        previews += s.total;
      } else {
        ctaClicks += s.total;
        signups += s.total;
      }
    }
    const accesses = totalClicks;
    const ctaRate = accesses > 0 ? Math.round((ctaClicks / accesses) * 100) : 0;
    const wppRate = ctaClicks > 0 ? Math.round((signups / ctaClicks) * 1000) / 10 : 0;
    const botsTotal = bots ? bots.sharePageBots + bots.otherBots : 0;
    return { accesses, ctaClicks, ctaRate, signups, wppRate, previews, botsTotal };
  }, [stats, bots]);

  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of series) {
      if (isBotSource(r.source)) continue;
      const date = new Date(r.bucket);
      const label = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      const key = `${date.getTime()}|${label}`;
      map.set(key, (map.get(key) ?? 0) + r.total);
    }
    return Array.from(map.entries())
      .map(([k, v]) => {
        const [ts, label] = k.split("|");
        return { ts: Number(ts), label, total: v };
      })
      .sort((a, b) => a.ts - b.ts);
  }, [series]);

  const funnel = useMemo(() => {
    const accesses = kpis.accesses;
    const ctas = kpis.ctaClicks;
    const conv = kpis.signups;
    const pct = (n: number, base: number) => (base > 0 ? Math.round((n / base) * 1000) / 10 : 0);
    return [
      { label: "Acessos", value: accesses, pct: 100, color: "var(--as-blue)" },
      { label: "Cliques em CTA", value: ctas, pct: pct(ctas, accesses), color: "var(--as-blue-md)" },
      { label: "Conversões WhatsApp", value: conv, pct: pct(conv, accesses), color: "var(--as-wpp)" },
    ];
  }, [kpis]);

  if (loading) {
    return <div style={{ padding: 24, color: "var(--as-text3)" }}>Carregando dashboard…</div>;
  }

  return (
    <div data-testid="admin-dashboard-overview">
      <div className="admin-section-title">visão geral</div>
      <div className="admin-grid-4">
        <KpiCard
          accent="var(--as-blue)"
          icon={<Eye size={12} color="var(--as-blue)" />}
          label="Acessos totais"
          value={kpis.accesses.toLocaleString("pt-BR")}
          sub="cliques humanos no período"
        />
        <KpiCard
          accent="var(--as-blue-md)"
          icon={<MousePointerClick size={12} color="var(--as-blue-md)" />}
          label="Cliques em CTAs"
          value={kpis.ctaClicks.toLocaleString("pt-BR")}
          sub={`taxa ${kpis.ctaRate}%`}
        />
        <KpiCard
          accent="var(--as-wpp)"
          icon={<MessageCircle size={12} color="var(--as-wpp)" />}
          label="Conversões WhatsApp"
          value={kpis.signups.toLocaleString("pt-BR")}
          sub={`${kpis.wppRate}% dos cliques`}
        />
        <KpiCard
          accent="var(--as-green)"
          icon={<ShieldCheck size={12} color="var(--as-green)" />}
          label="Robôs detectados"
          value={kpis.botsTotal.toLocaleString("pt-BR")}
          sub={kpis.botsTotal === 0 ? "Tráfego limpo" : "Filtrados das métricas"}
          subClass={kpis.botsTotal === 0 ? "admin-up" : undefined}
        />
      </div>

      <div className="admin-grid-2" style={{ marginTop: 12 }}>
        <div className="admin-card">
          <div className="admin-card-title">
            Cliques por dia
            <span className="admin-card-sub">{chartData.length} pontos</span>
          </div>
          <div style={{ width: "100%", height: 200 }}>
            {chartData.length === 0 ? (
              <div style={{ paddingTop: 60, textAlign: "center", fontSize: 12, color: "var(--as-text3)" }}>
                Sem dados no período
              </div>
            ) : (
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--as-border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--as-text3)" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--as-text3)" }} />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 6,
                      border: "1px solid var(--as-border)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="var(--as-blue)"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-title">
            Funil de conversão
            <span className="admin-card-sub">acesso → CTA → WhatsApp</span>
          </div>
          {funnel.map((f) => {
            const max = funnel[0].value || 1;
            const width = Math.max(8, Math.round((f.value / max) * 100));
            return (
              <div className="admin-funnel-step" key={f.label}>
                <div className="admin-funnel-label">{f.label}</div>
                <div
                  className="admin-funnel-bar"
                  style={{ width: `${width}%`, background: f.color }}
                >
                  {f.value.toLocaleString("pt-BR")}
                </div>
                <div className="admin-funnel-pct">{f.pct}%</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <ClicksHeatmap adminKey={adminKey} baseUrl={baseUrl} since={since} until={until} />
      </div>
    </div>
  );
}

function KpiCard({
  accent, icon, label, value, sub, subClass,
}: {
  accent: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  subClass?: string;
}) {
  return (
    <div className="admin-metric-card" style={{ ["--accent" as never]: accent }}>
      <div className="admin-mc-label">{icon} {label}</div>
      <div className="admin-mc-value">{value}</div>
      <div className={`admin-mc-sub ${subClass ?? ""}`}>{sub}</div>
    </div>
  );
}
