import { db, planClicksTable } from "@workspace/db";
import { and, eq, gte, lt, sql, type SQL } from "drizzle-orm";

export type Frequency = "weekly" | "monthly";

export type CityComparisonRow = {
  city: string;
  current: number;
  previous: number;
  abs: number;
  pct: number | null;
};

export type CityComparisonReport = {
  frequency: Frequency;
  windowDays: number;
  currentSince: Date;
  currentUntil: Date;
  previousSince: Date;
  previousUntil: Date;
  rows: CityComparisonRow[];
  topGrowers: CityComparisonRow[];
  topDecliners: CityComparisonRow[];
  totalCurrent: number;
  totalPrevious: number;
};

function windowDaysFor(frequency: Frequency): number {
  return frequency === "weekly" ? 7 : 30;
}

export function buildWindows(frequency: Frequency, now: Date = new Date()) {
  const days = windowDaysFor(frequency);
  const currentUntil = new Date(now);
  const currentSince = new Date(now);
  currentSince.setDate(currentSince.getDate() - days);
  const previousUntil = new Date(currentSince);
  const previousSince = new Date(currentSince);
  previousSince.setDate(previousSince.getDate() - days);
  return { currentSince, currentUntil, previousSince, previousUntil, days };
}

async function fetchCityTotals(since: Date, until: Date): Promise<Map<string, number>> {
  const conditions: SQL[] = [
    eq(planClicksTable.planSpeed, "city"),
    gte(planClicksTable.clickedAt, since),
    lt(planClicksTable.clickedAt, until),
  ];
  const rows = await db
    .select({
      planPrice: planClicksTable.planPrice,
      total: sql<number>`cast(count(*) as int)`,
    })
    .from(planClicksTable)
    .where(and(...conditions))
    .groupBy(planClicksTable.planPrice);
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.planPrice, (m.get(r.planPrice) ?? 0) + Number(r.total ?? 0));
  return m;
}

export async function generateCityComparisonReport(
  frequency: Frequency,
  now: Date = new Date(),
): Promise<CityComparisonReport> {
  const { currentSince, currentUntil, previousSince, previousUntil, days } =
    buildWindows(frequency, now);

  const [currentMap, previousMap] = await Promise.all([
    fetchCityTotals(currentSince, currentUntil),
    fetchCityTotals(previousSince, previousUntil),
  ]);

  const allCities = new Set<string>();
  for (const k of currentMap.keys()) allCities.add(k);
  for (const k of previousMap.keys()) allCities.add(k);

  const rows: CityComparisonRow[] = [];
  for (const city of allCities) {
    const current = currentMap.get(city) ?? 0;
    const previous = previousMap.get(city) ?? 0;
    const abs = current - previous;
    const pct = previous === 0 ? (current === 0 ? 0 : null) : (abs / previous) * 100;
    rows.push({ city, current, previous, abs, pct });
  }
  rows.sort((a, b) => {
    if (b.current !== a.current) return b.current - a.current;
    return a.city.localeCompare(b.city, "pt-BR");
  });

  const movers = rows.filter((r) => r.current > 0 || r.previous > 0);
  const topGrowers = [...movers]
    .filter((r) => r.abs > 0)
    .sort((a, b) => {
      if (b.abs !== a.abs) return b.abs - a.abs;
      const pa = a.pct ?? Number.POSITIVE_INFINITY;
      const pb = b.pct ?? Number.POSITIVE_INFINITY;
      return pb - pa;
    })
    .slice(0, 5);
  const topDecliners = [...movers]
    .filter((r) => r.abs < 0)
    .sort((a, b) => a.abs - b.abs)
    .slice(0, 5);

  const totalCurrent = rows.reduce((s, r) => s + r.current, 0);
  const totalPrevious = rows.reduce((s, r) => s + r.previous, 0);

  return {
    frequency,
    windowDays: days,
    currentSince,
    currentUntil,
    previousSince,
    previousUntil,
    rows,
    topGrowers,
    topDecliners,
    totalCurrent,
    totalPrevious,
  };
}

function csvEscape(val: string): string {
  if (/[",\n;]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
  return val;
}

export function reportToCsv(report: CityComparisonReport): string {
  const header = ["city", "current_total", "previous_total", "change_abs", "change_pct"];
  const lines = report.rows
    .filter((r) => r.current > 0 || r.previous > 0)
    .map((r) => {
      let pctStr = "";
      if (r.previous === 0) {
        pctStr = r.current === 0 ? "0.0" : "";
      } else if (r.pct !== null) {
        pctStr = r.pct.toFixed(1);
      }
      return [
        csvEscape(r.city),
        String(r.current),
        String(r.previous),
        String(r.abs),
        pctStr,
      ].join(",");
    });
  return "\uFEFF" + [header.join(","), ...lines].join("\n") + "\n";
}

function fmtDateBR(d: Date): string {
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtRange(report: CityComparisonReport): string {
  const curEnd = new Date(report.currentUntil.getTime() - 1);
  const prevEnd = new Date(report.previousUntil.getTime() - 1);
  return `${fmtDateBR(report.currentSince)} – ${fmtDateBR(curEnd)} vs. ${fmtDateBR(report.previousSince)} – ${fmtDateBR(prevEnd)}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function rowLine(r: CityComparisonRow): string {
  const sign = r.abs > 0 ? "+" : "";
  const pct = r.pct === null ? "novo" : `${r.pct > 0 ? "+" : ""}${r.pct.toFixed(0)}%`;
  return `${escapeHtml(r.city)} — <strong>${r.current}</strong> (${sign}${r.abs}, ${pct}); anterior ${r.previous}`;
}

export function reportToHtml(report: CityComparisonReport): string {
  const periodLabel =
    report.frequency === "weekly" ? "últimos 7 dias vs. 7 anteriores" : "últimos 30 dias vs. 30 anteriores";
  const totalDiff = report.totalCurrent - report.totalPrevious;
  const totalPct =
    report.totalPrevious === 0
      ? null
      : (totalDiff / report.totalPrevious) * 100;
  const totalLine =
    `Total de cliques em cidades: <strong>${report.totalCurrent}</strong>` +
    ` (anterior: ${report.totalPrevious}` +
    (totalPct !== null
      ? `, ${totalPct > 0 ? "+" : ""}${totalPct.toFixed(0)}%`
      : "") +
    `)`;

  const growersHtml =
    report.topGrowers.length === 0
      ? "<li><em>Nenhuma cidade em crescimento neste período.</em></li>"
      : report.topGrowers.map((r) => `<li>${rowLine(r)}</li>`).join("");
  const declinersHtml =
    report.topDecliners.length === 0
      ? "<li><em>Nenhuma cidade em queda neste período.</em></li>"
      : report.topDecliners.map((r) => `<li>${rowLine(r)}</li>`).join("");

  return `<!doctype html>
<html lang="pt-BR">
<body style="font-family: Arial, sans-serif; color:#0D0D0D; max-width:640px; margin:0 auto; padding:24px;">
  <h2 style="margin:0 0 4px;">Comparativo de cidades</h2>
  <p style="color:#7A7F8C; margin:0 0 16px;">
    ${escapeHtml(periodLabel)}<br/>
    ${escapeHtml(fmtRange(report))}
  </p>
  <p style="margin:0 0 16px;">${totalLine}</p>

  <h3 style="margin:16px 0 8px; color:#0A7B2C;">📈 Top cidades em crescimento</h3>
  <ul style="margin:0 0 16px; padding-left:20px;">${growersHtml}</ul>

  <h3 style="margin:16px 0 8px; color:#A11A1A;">📉 Top cidades em queda</h3>
  <ul style="margin:0 0 16px; padding-left:20px;">${declinersHtml}</ul>

  <p style="color:#7A7F8C; font-size:12px; margin-top:24px;">
    O CSV completo (atual vs. anterior, com variação absoluta e percentual) está em anexo.
    Esse é o mesmo arquivo gerado pelo botão "Exportar CSV" no comparativo de cidades do painel.
  </p>
</body>
</html>`;
}

export function reportFilename(report: CityComparisonReport): string {
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const fromStamp = fmt(report.currentSince);
  const toStamp = fmt(new Date(report.currentUntil.getTime() - 1));
  return `comparativo-cidades_${fromStamp}_a_${toStamp}.csv`;
}

export function reportSubject(report: CityComparisonReport): string {
  const label = report.frequency === "weekly" ? "semanal" : "mensal";
  const curEnd = new Date(report.currentUntil.getTime() - 1);
  return `Comparativo de cidades (${label}) — ${fmtDateBR(report.currentSince)} a ${fmtDateBR(curEnd)}`;
}
