import { useEffect, useMemo, useState } from "react";
import { adminFetch } from "../../lib/adminFetch";

type Cell = { dow: number; hour: number; total: number };
type HeatmapResponse = { tz: string; includeBots: boolean; cells: Cell[] };

type Props = {
  adminKey: string;
  baseUrl: string;
  since?: string;
  until?: string;
  city?: string | null;
};

const DOW_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function ClicksHeatmap({ adminKey, baseUrl, since, until, city }: Props) {
  const [data, setData] = useState<HeatmapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (since) params.set("since", since);
    if (until) params.set("until", until);
    if (city) params.set("city", city);
    const qs = params.toString();
    adminFetch(`${baseUrl}/api/clicks/heatmap${qs ? `?${qs}` : ""}`, {
      headers: { Authorization: `Bearer ${adminKey}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as HeatmapResponse;
      })
      .then((json) => { if (!cancelled) setData(json); })
      .catch((err) => { if (!cancelled) setError(err.message ?? "Erro"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [adminKey, baseUrl, since, until, city]);

  const grid = useMemo(() => {
    const m = new Map<string, number>();
    let max = 0;
    if (data) {
      for (const c of data.cells) {
        m.set(`${c.dow}-${c.hour}`, c.total);
        if (c.total > max) max = c.total;
      }
    }
    return { lookup: m, max };
  }, [data]);

  function bucketClass(v: number, max: number): string {
    if (v === 0 || max === 0) return "admin-hm-cell";
    const r = v / max;
    if (r > 0.75) return "admin-hm-cell admin-hm-h5";
    if (r > 0.5) return "admin-hm-cell admin-hm-h4";
    if (r > 0.25) return "admin-hm-cell admin-hm-h3";
    if (r > 0.1) return "admin-hm-cell admin-hm-h2";
    return "admin-hm-cell admin-hm-h1";
  }

  return (
    <div className="admin-card" data-testid="clicks-heatmap">
      <div className="admin-card-title">
        Mapa de calor — dia × hora
        <span className="admin-card-sub">somente humanos · {data?.tz ?? "America/Bahia"}</span>
      </div>
      {loading && <div style={{ fontSize: 12, color: "var(--as-text3)" }}>Carregando…</div>}
      {error && <div style={{ fontSize: 12, color: "var(--as-red)" }}>Erro: {error}</div>}
      {!loading && !error && (
        <>
          <div className="admin-hm-grid">
            <div />
            {Array.from({ length: 24 }, (_, h) => (
              <div key={`h-${h}`} className="admin-hm-col-label">{h % 3 === 0 ? h : ""}</div>
            ))}
            {DOW_LABELS.map((label, dow) => (
              <div key={`r-${dow}`} style={{ display: "contents" }}>
                <div className="admin-hm-row-label">{label}</div>
                {Array.from({ length: 24 }, (_, hour) => {
                  const v = grid.lookup.get(`${dow}-${hour}`) ?? 0;
                  return (
                    <div
                      key={`${dow}-${hour}`}
                      className={bucketClass(v, grid.max)}
                      title={`${DOW_LABELS[dow]} ${hour}h: ${v} clique${v === 1 ? "" : "s"}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "var(--as-text3)" }}>
            <span>Pico: {grid.max} cliques/hora</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              menos
              <span className="admin-hm-cell" style={{ width: 12 }} />
              <span className="admin-hm-cell admin-hm-h2" style={{ width: 12 }} />
              <span className="admin-hm-cell admin-hm-h3" style={{ width: 12 }} />
              <span className="admin-hm-cell admin-hm-h4" style={{ width: 12 }} />
              <span className="admin-hm-cell admin-hm-h5" style={{ width: 12 }} />
              mais
            </span>
          </div>
        </>
      )}
    </div>
  );
}
