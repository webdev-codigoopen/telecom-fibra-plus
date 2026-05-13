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
import { MessageCircle, Eye, Share2, MapPin } from "lucide-react";
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

type Props = {
  adminKey: string;
  baseUrl: string;
  since?: string;
  until?: string;
};

function isWppCta(s: string): boolean {
  return s === "whatsapp-cta" || s === "whatsapp-plan" || s.startsWith("whatsapp-");
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (since) params.set("since", since);
    if (until) params.set("until", until);
    const tsParams = new URLSearchParams(params);
    tsParams.set("bucket", "day");
    const intParams = new URLSearchParams(params);
    intParams.set("limit", "1000");
    const qs = params.toString() ? `?${params.toString()}` : "";
    Promise.all([
      adminFetch(`${baseUrl}/api/clicks/stats${qs}`, {
        headers: { Authorization: `Bearer ${adminKey}` },
      }).then((r) => (r.ok ? r.json() : [])) as Promise<ClickStat[]>,
      adminFetch(`${baseUrl}/api/clicks/timeseries?${tsParams.toString()}`, {
        headers: { Authorization: `Bearer ${adminKey}` },
      }).then((r) => (r.ok ? r.json() : [])) as Promise<TimeseriesRow[]>,
      adminFetch(`${baseUrl}/api/demand/interests?${intParams.toString()}`, {
        headers: { Authorization: `Bearer ${adminKey}` },
      }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([s, t, i]) => {
        if (cancelled) return;
        setStats(Array.isArray(s) ? s : []);
        setSeries(Array.isArray(t) ? t : []);
        const rows = Array.isArray(i) ? i : (i?.rows ?? []);
        setInterestCount(Array.isArray(rows) ? rows.length : 0);
      })
      .catch(() => {
        if (cancelled) return;
        setStats([]); setSeries([]); setInterestCount(0);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [adminKey, baseUrl, since, until]);

  const kpis = useMemo(() => {
    let ctaClicks = 0;
    let previews = 0;
    let bots = 0;
    for (const s of stats) {
      if (!isPlanRow(s.planSpeed)) continue;
      if (isShareBot(s.source)) { bots += s.total; continue; }
      if (isPreview(s.source)) previews += s.total;
      else if (isWppCta(s.source)) ctaClicks += s.total;
    }
    const conversions = interestCount;
    const convRate = ctaClicks > 0 ? Math.round((conversions / ctaClicks) * 1000) / 10 : 0;
    return { ctaClicks, previews, bots, conversions, convRate };
  }, [stats, interestCount]);

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
          sub="botões de WhatsApp clicados"
        />
        <KpiCard
          accent="var(--as-blue)"
          icon={<Eye size={12} color="var(--as-blue)" />}
          label="Previews compartilhados"
          value={kpis.previews.toLocaleString("pt-BR")}
          sub="visitas via /share (humanos)"
        />
        <KpiCard
          accent="var(--as-blue-md)"
          icon={<Share2 size={12} color="var(--as-blue-md)" />}
          label="Conversões (interesses)"
          value={kpis.conversions.toLocaleString("pt-BR")}
          sub={`${kpis.convRate}% dos cliques em CTA`}
        />
        <KpiCard
          accent="var(--as-amber)"
          icon={<Eye size={12} color="var(--as-amber)" />}
          label="Bots de prévia"
          value={kpis.bots.toLocaleString("pt-BR")}
          sub="filtrados das métricas"
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
              <div style={{ paddingTop: 60, textAlign: "center", fontSize: 12, color: "var(--as-text3)" }}>
                Sem dados no período
              </div>
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
            Top planos por cliques no WhatsApp
            <span className="admin-card-sub">{topPlans.length} planos</span>
          </div>
          <div style={{ width: "100%", height: 200 }}>
            {topPlans.length === 0 ? (
              <div style={{ paddingTop: 60, textAlign: "center", fontSize: 12, color: "var(--as-text3)" }}>
                Sem dados no período
              </div>
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

      <div className="admin-card" style={{ marginTop: 12, fontSize: 12, color: "var(--as-text2)" }}>
        <MapPin size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
        Para distribuição por cidade, veja a aba <strong>Mapa de cliques</strong>.
      </div>
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
      <div className="admin-mc-value">{value}</div>
      <div className="admin-mc-sub">{sub}</div>
    </div>
  );
}
