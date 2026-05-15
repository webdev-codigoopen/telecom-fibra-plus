import {
  db,
  appSettingsTable,
  emailReportSubscriptionsTable,
  planClicksTable,
} from "@workspace/db";
import { and, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { logger } from "./logger";
import { isEmailConfigured, sendEmail } from "./sendEmail";
import { CITY_BELOW_TARGET_REPORT_TYPE } from "./cityBelowTargetDigest";

// Recipients of this alert reuse the existing "city_below_target" subscriber
// audience: those admins already opted into city-conversion alerts, and a
// persistent underperformance alert is the same family of signal (just with a
// stronger threshold). This avoids requiring a brand-new subscription type
// and admin UI.

const STATE_KEY = "persistent_underperf_last_cities";

// Defaults mirror the /clicks/cities-persistent-underperformance endpoint.
export const DEFAULT_PERIODS = 4;
export const DEFAULT_PERIOD_DAYS = 7;
export const DEFAULT_MIN_BELOW = 3;
export const DEFAULT_MIN_PREVIEWS = 5;

const PER_CITY_TARGETS_KEY = "map_per_city_targets";
const SETTING_DEFAULT_PCT_KEY = "below_target_default_pct";
const SETTING_MIN_PREVIEWS_KEY = "below_target_min_previews";
const FALLBACK_DEFAULT_PCT = 10;

export type PersistentUnderperfRow = {
  city: string;
  targetPct: number;
  isPerCityTarget: boolean;
  periodsBelow: number;
  periodsEligible: number;
  consecutiveBelow: number;
  currentRatePct: number | null;
  currentPreviews: number;
  currentSignups: number;
};

export type PersistentUnderperfResult = {
  rows: PersistentUnderperfRow[];
  periods: number;
  periodDays: number;
  minBelow: number;
  minPreviews: number;
  defaultTargetPct: number;
  windowSince: Date;
  windowUntil: Date;
};

function parsePerCityTargets(raw: string | undefined | null): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const n = Number(v);
      if (typeof k === "string" && k && Number.isFinite(n) && n > 0 && n <= 100) {
        out[k] = n;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export async function computePersistentUnderperformance(
  now: Date = new Date(),
  opts: {
    periods?: number;
    periodDays?: number;
    minBelow?: number;
    minPreviews?: number;
  } = {},
): Promise<PersistentUnderperfResult> {
  const periods = Math.max(2, Math.min(12, Math.floor(opts.periods ?? DEFAULT_PERIODS)));
  const periodDays = Math.max(1, Math.min(60, Math.floor(opts.periodDays ?? DEFAULT_PERIOD_DAYS)));
  const minBelow = Math.max(1, Math.min(periods, Math.floor(opts.minBelow ?? DEFAULT_MIN_BELOW)));
  const minPreviews = Math.max(
    1,
    Math.min(1000, Math.floor(opts.minPreviews ?? DEFAULT_MIN_PREVIEWS)),
  );

  const totalDays = periodDays * periods;
  const windowSince = new Date(now.getTime() - totalDays * 86400 * 1000);

  const settingsRows = await db
    .select({ key: appSettingsTable.key, value: appSettingsTable.value })
    .from(appSettingsTable);
  const settingsMap = new Map(settingsRows.map((r) => [r.key, r.value]));
  const perCityTargets = parsePerCityTargets(settingsMap.get(PER_CITY_TARGETS_KEY));
  let defaultTargetPct = FALLBACK_DEFAULT_PCT;
  const rawPct = Number(settingsMap.get(SETTING_DEFAULT_PCT_KEY));
  if (Number.isFinite(rawPct) && rawPct > 0 && rawPct <= 100) defaultTargetPct = rawPct;
  const rawMin = Number(settingsMap.get(SETTING_MIN_PREVIEWS_KEY));
  const effMinPreviews =
    Number.isFinite(rawMin) && rawMin >= 1 && rawMin <= 1000
      ? Math.floor(rawMin)
      : minPreviews;

  const bucketExpr = sql<number>`cast(floor(extract(epoch from (${now} - ${planClicksTable.clickedAt})) / ${periodDays * 86400}) as int)`;
  const previewExpr = sql<number>`cast(count(*) filter (where ${planClicksTable.source} = 'whatsapp-share' or ${planClicksTable.source} like 'whatsapp-share:%') as int)`;
  const signupExpr = sql<number>`cast(count(*) filter (where ${planClicksTable.source} not like 'whatsapp-share%') as int)`;

  const rawRows = await db
    .select({
      city: planClicksTable.city,
      bucket: bucketExpr,
      previews: previewExpr,
      signups: signupExpr,
    })
    .from(planClicksTable)
    .where(
      and(
        gte(planClicksTable.clickedAt, windowSince),
        lt(planClicksTable.clickedAt, now),
        isNotNull(planClicksTable.city),
      ),
    )
    .groupBy(planClicksTable.city, bucketExpr);

  type CityAgg = Map<number, { previews: number; signups: number }>;
  const byCity = new Map<string, CityAgg>();
  for (const r of rawRows) {
    if (!r.city) continue;
    if (r.bucket < 0 || r.bucket >= periods) continue;
    let agg = byCity.get(r.city);
    if (!agg) {
      agg = new Map();
      byCity.set(r.city, agg);
    }
    const cur = agg.get(r.bucket) ?? { previews: 0, signups: 0 };
    cur.previews += r.previews;
    cur.signups += r.signups;
    agg.set(r.bucket, cur);
  }

  const out: PersistentUnderperfRow[] = [];
  for (const [city, agg] of byCity.entries()) {
    const override = perCityTargets[city];
    const isPerCityTarget = Number.isFinite(override) && (override as number) > 0;
    const targetPct = isPerCityTarget ? (override as number) : defaultTargetPct;
    if (!Number.isFinite(targetPct) || targetPct <= 0) continue;

    let periodsBelow = 0;
    let periodsEligible = 0;
    let consecutiveBelow = 0;
    let consecutiveBroken = false;
    let recentRate: number | null = null;
    let recentPreviews = 0;
    let recentSignups = 0;

    for (let i = 0; i < periods; i++) {
      const v = agg.get(i) ?? { previews: 0, signups: 0 };
      const eligible = v.previews >= effMinPreviews;
      const ratePct = v.previews > 0 ? (v.signups / v.previews) * 100 : null;
      if (i === 0) {
        recentRate = ratePct;
        recentPreviews = v.previews;
        recentSignups = v.signups;
      }
      if (eligible && ratePct != null) {
        const below = ratePct < targetPct;
        periodsEligible += 1;
        if (below) {
          periodsBelow += 1;
          if (!consecutiveBroken) consecutiveBelow += 1;
        } else {
          consecutiveBroken = true;
        }
      }
    }

    if (periodsBelow < minBelow) continue;

    out.push({
      city,
      targetPct,
      isPerCityTarget,
      periodsBelow,
      periodsEligible,
      consecutiveBelow,
      currentRatePct: recentRate,
      currentPreviews: recentPreviews,
      currentSignups: recentSignups,
    });
  }

  out.sort((a, b) => {
    if (b.periodsBelow !== a.periodsBelow) return b.periodsBelow - a.periodsBelow;
    if (b.consecutiveBelow !== a.consecutiveBelow)
      return b.consecutiveBelow - a.consecutiveBelow;
    return a.city.localeCompare(b.city, "pt-BR");
  });

  return {
    rows: out,
    periods,
    periodDays,
    minBelow,
    minPreviews: effMinPreviews,
    defaultTargetPct,
    windowSince,
    windowUntil: now,
  };
}

export function parseStoredCities(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string" && x.length > 0);
  } catch {
    return [];
  }
}

async function loadStoredCities(): Promise<string[]> {
  const rows = await db
    .select({ value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, STATE_KEY))
    .limit(1);
  return parseStoredCities(rows[0]?.value);
}

async function saveStoredCities(cities: string[], now: Date): Promise<void> {
  const value = JSON.stringify(cities);
  await db
    .insert(appSettingsTable)
    .values({ key: STATE_KEY, value, updatedAt: now })
    .onConflictDoUpdate({
      target: appSettingsTable.key,
      set: { value, updatedAt: now },
    });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n >= 10 ? n.toFixed(0) : n.toFixed(1);
}

function adminDashboardUrl(): string {
  const explicit = process.env["ADMIN_DASHBOARD_URL"]?.trim();
  if (explicit) return explicit;
  const base = process.env["PUBLIC_BASE_URL"]?.trim();
  if (base) return `${base.replace(/\/$/, "")}/admin`;
  const dev = process.env["REPLIT_DEV_DOMAIN"]?.trim();
  if (dev) return `https://${dev}/admin`;
  return "/admin";
}

export function buildPersistentUnderperfSubject(
  newCitiesCount: number,
  result: PersistentUnderperfResult,
): string {
  const plural = newCitiesCount === 1 ? "cidade" : "cidades";
  return `🚨 ${newCitiesCount} ${plural} em queda persistente (≥${result.minBelow} de ${result.periods} semanas abaixo da meta)`;
}

export function buildPersistentUnderperfHtml(
  newRows: PersistentUnderperfRow[],
  result: PersistentUnderperfResult,
): string {
  const dashboardUrl = adminDashboardUrl();
  const linkAttr = escapeHtml(dashboardUrl);
  const periodLabel =
    result.periodDays === 7
      ? "semanas"
      : result.periodDays === 1
        ? "dias"
        : `períodos de ${result.periodDays} dias`;

  const rowsHtml = newRows
    .map((r) => {
      const tag = r.isPerCityTarget ? "específica" : "padrão";
      const recentRate = fmtPct(r.currentRatePct);
      return `<tr>
  <td style="padding:8px 10px; border-top:1px solid #E0E3EB; color:#0D0D0D; font-weight:600;">${escapeHtml(r.city)}</td>
  <td style="padding:8px 10px; border-top:1px solid #E0E3EB; color:#A11A1A; font-weight:700;">${r.periodsBelow} de ${result.periods}</td>
  <td style="padding:8px 10px; border-top:1px solid #E0E3EB; color:#2A2D38;">${fmtPct(r.targetPct)}% <span style="color:#7A7F8C; font-size:11px;">(${tag})</span></td>
  <td style="padding:8px 10px; border-top:1px solid #E0E3EB; color:#A11A1A;">${recentRate}%</td>
  <td style="padding:8px 10px; border-top:1px solid #E0E3EB; color:#2A2D38;">${r.currentPreviews}</td>
  <td style="padding:8px 10px; border-top:1px solid #E0E3EB; color:#2A2D38;">${r.currentSignups}</td>
</tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="pt-BR">
<body style="font-family: Arial, sans-serif; color:#0D0D0D; max-width:720px; margin:0 auto; padding:24px;">
  <h2 style="margin:0 0 8px; color:#A11A1A;">🚨 Cidades em queda persistente</h2>
  <p style="margin:0 0 12px;">As cidades abaixo entraram agora no estado de <strong>queda persistente</strong>: ficaram abaixo da meta de conversão em pelo menos <strong>${result.minBelow} das últimas ${result.periods} ${periodLabel}</strong> (mínimo de ${result.minPreviews} prévias por período).</p>
  <p style="margin:0 0 12px; color:#7A7F8C; font-size:12px;">Você não receberá outro alerta para a mesma cidade até que ela volte a atingir a meta e caia novamente neste estado.</p>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse; width:100%; font-size:13px; margin:0 0 16px;">
<thead>
  <tr style="background:#F5F7FA; color:#7A7F8C; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.04em;">
    <th style="padding:8px 10px;">Cidade</th>
    <th style="padding:8px 10px;">${periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1)} abaixo</th>
    <th style="padding:8px 10px;">Meta</th>
    <th style="padding:8px 10px;">Conversão atual</th>
    <th style="padding:8px 10px;">Prévias (atual)</th>
    <th style="padding:8px 10px;">Cadastros (atual)</th>
  </tr>
</thead>
<tbody>
${rowsHtml}
</tbody>
</table>
  <p style="margin:0 0 16px;">
    <a href="${linkAttr}" style="color:#0A55C2;">Abrir o painel administrativo</a> para investigar e marcar as cidades como vistas.
  </p>
  <p style="color:#7A7F8C; font-size:12px; margin-top:24px;">
    Você está recebendo este alerta porque assinou os alertas de cidades abaixo da meta.
    Para cancelar ou pausar, abra o painel admin → aba "Relatórios por email".
  </p>
</body>
</html>`;
}

export async function tickPersistentUnderperformanceAlert(
  now: Date = new Date(),
): Promise<void> {
  const result = await computePersistentUnderperformance(now);
  const currentCities = result.rows.map((r) => r.city);
  const previous = new Set(await loadStoredCities());
  const currentSet = new Set(currentCities);

  // Newly entered = present now, not previously alerted.
  const newRows = result.rows.filter((r) => !previous.has(r.city));

  // Always persist the latest set so cities that recover (drop out) can later
  // re-enter and trigger a fresh alert. This also handles the very first run
  // — if previous is empty and lots of cities are flagged, they all get one
  // initial email, then we won't re-spam them.
  if (newRows.length === 0) {
    // Update stored list anyway so recoveries (cities that left the set)
    // are reflected for next time.
    if (
      previous.size !== currentSet.size ||
      [...previous].some((c) => !currentSet.has(c))
    ) {
      await saveStoredCities(currentCities, now);
    }
    return;
  }

  // Find subscribers (reuse city_below_target audience).
  const subs = await db
    .select()
    .from(emailReportSubscriptionsTable)
    .where(
      and(
        eq(emailReportSubscriptionsTable.enabled, true),
        eq(
          emailReportSubscriptionsTable.reportType,
          CITY_BELOW_TARGET_REPORT_TYPE,
        ),
      ),
    );
  const recipients = Array.from(
    new Set(
      subs
        .map((s) => s.email.trim().toLowerCase())
        .filter((e) => e.length > 0),
    ),
  );

  if (recipients.length === 0) {
    // No one to notify, but still record state so the same cities don't all
    // queue up forever waiting for a first subscriber.
    await saveStoredCities(currentCities, now);
    return;
  }

  if (!(await isEmailConfigured())) {
    logger.warn(
      { newCount: newRows.length, recipients: recipients.length },
      "Email not configured; skipping persistent-underperformance alert.",
    );
    return;
  }

  try {
    const subject = buildPersistentUnderperfSubject(newRows.length, result);
    const html = buildPersistentUnderperfHtml(newRows, result);
    await sendEmail({ to: recipients, subject, html });
    await saveStoredCities(currentCities, now);
    logger.info(
      {
        newCities: newRows.map((r) => r.city),
        recipients: recipients.length,
      },
      "Sent persistent-underperformance alert",
    );
  } catch (err) {
    logger.error(
      { err, newCount: newRows.length },
      "Failed to send persistent-underperformance alert",
    );
  }
}
