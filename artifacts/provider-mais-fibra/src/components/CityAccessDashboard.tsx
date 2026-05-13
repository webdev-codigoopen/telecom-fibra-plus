import { useEffect, useMemo, useState } from "react";

const COMPANY_CITIES = [
  "Barreiras",
  "Luís Eduardo Magalhães",
  "Angical",
  "Baianópolis",
  "Cristópolis",
  "São Desidério",
  "Jaborandi",
  "Cotegipe",
  "Wanderley",
  "Bom Jesus da Lapa",
  "Santa Maria da Vitória",
  "Correntina",
];

type ApiRow = { city: string; previews: number; signups: number };
type CityRow = { city: string; previews: number; signups: number; acessos: number };
type SortKey = "city" | "acessos" | "signups" | "pct";
type RangeId = "7d" | "30d" | "90d" | "all";

const RANGE_OPTIONS: { id: RangeId; label: string }[] = [
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "90d", label: "90 dias" },
  { id: "all", label: "Tudo" },
];

type Props = {
  adminKey: string;
  baseUrl: string;
};

export default function CityAccessDashboard({ adminKey, baseUrl }: Props) {
  const [rangeId, setRangeId] = useState<RangeId>("30d");
  const [data, setData] = useState<ApiRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("acessos");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (rangeId !== "all") {
        const now = new Date();
        const since = new Date(now);
        const days = rangeId === "7d" ? 7 : rangeId === "30d" ? 30 : 90;
        since.setDate(since.getDate() - days);
        params.set("since", since.toISOString());
        params.set("until", now.toISOString());
      }
      const qs = params.toString();
      try {
        const res = await fetch(
          `${baseUrl}/api/clicks/cities-conversion${qs ? `?${qs}` : ""}`,
          {
            headers: { Authorization: `Bearer ${adminKey}` },
            signal: controller.signal,
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: ApiRow[] = await res.json();
        setData(json);
      } catch (e) {
        if ((e as { name?: string })?.name !== "AbortError") {
          setError("Falha ao carregar acessos por cidade.");
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [adminKey, baseUrl, rangeId]);

  const companyRows: CityRow[] = useMemo(() => {
    const map = new Map<string, ApiRow>();
    for (const r of data) map.set(r.city, r);
    return COMPANY_CITIES.map((name) => {
      const r = map.get(name);
      const previews = r?.previews ?? 0;
      const signups = r?.signups ?? 0;
      return { city: name, previews, signups, acessos: previews + signups };
    });
  }, [data]);

  const totalAcessosAtendidas = companyRows.reduce((s, r) => s + r.acessos, 0);
  const cidadesAtivas = companyRows.filter((r) => r.acessos > 0).length;
  const topCidade = [...companyRows].sort((a, b) => b.acessos - a.acessos)[0];
  const totalGeral = data.reduce((s, r) => s + (r.previews ?? 0) + (r.signups ?? 0), 0);
  const pctAtendidas =
    totalGeral > 0 ? Math.round((totalAcessosAtendidas / totalGeral) * 100) : 0;

  const sortedRows = useMemo(() => {
    const arr = [...companyRows];
    arr.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === "city") {
        av = a.city.toLocaleLowerCase("pt-BR");
        bv = b.city.toLocaleLowerCase("pt-BR");
      } else if (sortKey === "acessos" || sortKey === "pct") {
        av = a.acessos;
        bv = b.acessos;
      } else {
        av = a.signups;
        bv = b.signups;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [companyRows, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "city" ? "asc" : "desc");
    }
  }

  function exportCsv() {
    const header = ["Cidade", "Acessos", "Previews", "Inscricoes", "% do total atendido"];
    const lines = [header.join(",")];
    for (const r of sortedRows) {
      const pct =
        totalAcessosAtendidas > 0
          ? ((r.acessos / totalAcessosAtendidas) * 100).toFixed(2)
          : "0.00";
      lines.push(
        [
          `"${r.city.replace(/"/g, '""')}"`,
          String(r.acessos),
          String(r.previews),
          String(r.signups),
          pct,
        ].join(","),
      );
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `acessos-cidades-${rangeId}-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const SortHeader = ({
    label,
    keyName,
    align = "left",
  }: {
    label: string;
    keyName: SortKey;
    align?: "left" | "right";
  }) => {
    const active = sortKey === keyName;
    return (
      <th
        className={`px-3 py-2 text-xs font-semibold text-[#7A7F8C] uppercase tracking-wide ${
          align === "right" ? "text-right" : "text-left"
        }`}
      >
        <button
          type="button"
          onClick={() => toggleSort(keyName)}
          className={`inline-flex items-center gap-1 hover:text-[#0D0D0D] transition-colors ${
            active ? "text-[#122AD5]" : ""
          }`}
        >
          {label}
          <span className="text-[10px]">
            {active ? (sortDir === "asc" ? "▲" : "▼") : ""}
          </span>
        </button>
      </th>
    );
  };

  return (
    <div className="space-y-6" data-testid="city-access-dashboard">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-[#0D0D0D] text-lg">Acessos por cidade</h2>
          <p className="text-sm text-[#7A7F8C]">
            Cliques registrados nas {COMPANY_CITIES.length} cidades atendidas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-lg border border-[#E0E3EB] bg-white p-0.5"
            role="tablist"
            aria-label="Período"
          >
            {RANGE_OPTIONS.map((opt) => {
              const active = rangeId === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRangeId(opt.id)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    active
                      ? "bg-[#122AD5] text-white"
                      : "text-[#7A7F8C] hover:text-[#0D0D0D]"
                  }`}
                  data-testid={`city-range-${opt.id}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={exportCsv}
            disabled={loading || companyRows.every((r) => r.acessos === 0)}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#122AD5] text-white px-3 py-1.5 text-sm font-semibold hover:bg-[#0E22B3] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid="city-export-csv"
          >
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Total de acessos"
          value={loading ? "—" : totalAcessosAtendidas.toLocaleString("pt-BR")}
          hint="Soma das cidades atendidas"
        />
        <MetricCard
          label="Cidades com tráfego"
          value={loading ? "—" : `${cidadesAtivas} / ${COMPANY_CITIES.length}`}
          hint="Cidades atendidas com 1+ acesso"
        />
        <MetricCard
          label="Cidade líder"
          value={
            loading || !topCidade || topCidade.acessos === 0
              ? "—"
              : topCidade.city
          }
          hint={
            loading || !topCidade || topCidade.acessos === 0
              ? "Sem dados"
              : `${topCidade.acessos.toLocaleString("pt-BR")} acessos`
          }
        />
        <MetricCard
          label="% das cidades atendidas"
          value={loading ? "—" : `${pctAtendidas}%`}
          hint="Acessos atendidos vs total geral"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#E0E3EB] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F7F8FB] border-b border-[#E0E3EB]">
              <tr>
                <SortHeader label="Cidade" keyName="city" />
                <SortHeader label="Acessos" keyName="acessos" align="right" />
                <SortHeader label="Inscrições" keyName="signups" align="right" />
                <SortHeader label="% do total" keyName="pct" align="right" />
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => {
                const pct =
                  totalAcessosAtendidas > 0
                    ? (r.acessos / totalAcessosAtendidas) * 100
                    : 0;
                return (
                  <tr
                    key={r.city}
                    className="border-b border-[#F1F2F6] last:border-b-0"
                  >
                    <td className="px-3 py-2.5 font-medium text-[#0D0D0D]">
                      {r.city}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#0D0D0D]">
                      {r.acessos.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#7A7F8C]">
                      {r.signups.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#7A7F8C]">
                      {pct.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-[#F7F8FB] border-t border-[#E0E3EB]">
              <tr>
                <td className="px-3 py-2.5 font-semibold text-[#0D0D0D]">Total</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-[#0D0D0D]">
                  {totalAcessosAtendidas.toLocaleString("pt-BR")}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-[#0D0D0D]">
                  {sortedRows
                    .reduce((s, r) => s + r.signups, 0)
                    .toLocaleString("pt-BR")}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-[#0D0D0D]">
                  100%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#E0E3EB] p-4">
      <div className="text-xs font-semibold text-[#7A7F8C] uppercase tracking-wide">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-[#0D0D0D] truncate">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-[#7A7F8C]">{hint}</div>}
    </div>
  );
}
