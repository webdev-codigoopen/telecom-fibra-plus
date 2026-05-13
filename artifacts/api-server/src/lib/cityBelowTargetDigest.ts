import {
  db,
  appSettingsTable,
  emailReportSubscriptionsTable,
  planClicksTable,
} from "@workspace/db";
import { and, eq, gte, lt, sql, inArray } from "drizzle-orm";
import { logger } from "./logger";
import { isEmailConfigured, sendEmail } from "./sendEmail";

export type BelowTargetFrequency = "daily" | "weekly";

export const CITY_BELOW_TARGET_REPORT_TYPE = "city_below_target";

export const DEFAULT_BELOW_TARGET_PCT = 10;
export const DEFAULT_BELOW_TARGET_MIN_PREVIEWS = 5;
const PER_CITY_TARGETS_KEY = "map_per_city_targets";
const SETTING_DEFAULT_PCT_KEY = "below_target_default_pct";
const SETTING_MIN_PREVIEWS_KEY = "below_target_min_previews";

type PerCityTargets = Record<string, number>;

type CityConversionRow = { city: string; previews: number; signups: number };

export type BelowTargetRow = {
  city: string;
  previews: number;
  signups: number;
  ratePct: number;
  targetPct: number;
  gapPct: number;
  isPerCityTarget: boolean;
};

function parsePerCityTargets(raw: string | undefined | null): PerCityTargets {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: PerCityTargets = {};
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

async function loadDigestSettings(): Promise<{
  perCityTargets: PerCityTargets;
  defaultPct: number;
  minPreviews: number;
}> {
  const rows = await db
    .select({ key: appSettingsTable.key, value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(
      inArray(appSettingsTable.key, [
        PER_CITY_TARGETS_KEY,
        SETTING_DEFAULT_PCT_KEY,
        SETTING_MIN_PREVIEWS_KEY,
      ]),
    );
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const perCityTargets = parsePerCityTargets(map.get(PER_CITY_TARGETS_KEY));

  let defaultPct = DEFAULT_BELOW_TARGET_PCT;
  const rawPct = Number(map.get(SETTING_DEFAULT_PCT_KEY));
  if (Number.isFinite(rawPct) && rawPct > 0 && rawPct <= 100) defaultPct = rawPct;

  let minPreviews = DEFAULT_BELOW_TARGET_MIN_PREVIEWS;
  const rawMin = Number(map.get(SETTING_MIN_PREVIEWS_KEY));
  if (Number.isFinite(rawMin) && rawMin >= 1 && rawMin <= 1000) {
    minPreviews = Math.floor(rawMin);
  }

  return { perCityTargets, defaultPct, minPreviews };
}

async function fetchCityConversion(
  since: Date,
  until: Date,
): Promise<CityConversionRow[]> {
  const previewExpr = sql<number>`cast(count(*) filter (where ${planClicksTable.source} = 'whatsapp-share' or ${planClicksTable.source} like 'whatsapp-share:%') as int)`;
  const signupExpr = sql<number>`cast(count(*) filter (where ${planClicksTable.source} not like 'whatsapp-share%') as int)`;

  const rows = await db
    .select({
      city: planClicksTable.city,
      previews: previewExpr,
      signups: signupExpr,
    })
    .from(planClicksTable)
    .where(
      and(
        gte(planClicksTable.clickedAt, since),
        lt(planClicksTable.clickedAt, until),
      ),
    )
    .groupBy(planClicksTable.city);

  return rows
    .filter((r): r is { city: string; previews: number; signups: number } =>
      typeof r.city === "string" && r.city.length > 0,
    )
    .map((r) => ({ city: r.city, previews: r.previews, signups: r.signups }));
}

export function windowForFrequency(
  frequency: BelowTargetFrequency,
  now: Date,
): { since: Date; until: Date; days: number } {
  const days = frequency === "weekly" ? 7 : 1;
  const until = new Date(now);
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { since, until, days };
}

export async function computeBelowTargetRows(
  frequency: BelowTargetFrequency,
  now: Date = new Date(),
): Promise<{
  rows: BelowTargetRow[];
  defaultPct: number;
  minPreviews: number;
  windowDays: number;
  since: Date;
  until: Date;
}> {
  const { perCityTargets, defaultPct, minPreviews } = await loadDigestSettings();
  const { since, until, days } = windowForFrequency(frequency, now);
  const conv = await fetchCityConversion(since, until);

  const rows: BelowTargetRow[] = [];
  for (const c of conv) {
    if (c.previews < minPreviews) continue;
    const override = perCityTargets[c.city];
    const isPerCityTarget = Number.isFinite(override) && override > 0 && override <= 100;
    const targetPct = isPerCityTarget ? (override as number) : defaultPct;
    if (!Number.isFinite(targetPct) || targetPct <= 0) continue;
    const ratePct = (c.signups / c.previews) * 100;
    if (ratePct >= targetPct) continue;
    rows.push({
      city: c.city,
      previews: c.previews,
      signups: c.signups,
      ratePct,
      targetPct,
      gapPct: targetPct - ratePct,
      isPerCityTarget,
    });
  }
  rows.sort((a, b) => {
    if (b.gapPct !== a.gapPct) return b.gapPct - a.gapPct;
    return a.city.localeCompare(b.city, "pt-BR");
  });
  return { rows, defaultPct, minPreviews, windowDays: days, since, until };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtDateBR(d: Date): string {
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

function fmtPct(n: number): string {
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

export function buildDigestSubject(
  frequency: BelowTargetFrequency,
  rowsCount: number,
): string {
  const periodo = frequency === "weekly" ? "semanal" : "diário";
  if (rowsCount === 0) {
    return `✅ Resumo ${periodo}: nenhuma cidade abaixo da meta`;
  }
  const plural = rowsCount === 1 ? "cidade" : "cidades";
  return `⚠️ Resumo ${periodo}: ${rowsCount} ${plural} abaixo da meta`;
}

export function buildDigestHtml(
  frequency: BelowTargetFrequency,
  result: Awaited<ReturnType<typeof computeBelowTargetRows>>,
): string {
  const periodoLabel = frequency === "weekly" ? "últimos 7 dias" : "últimas 24 horas";
  const dashboardUrl = adminDashboardUrl();
  const linkAttr = escapeHtml(dashboardUrl);

  const headerNote =
    result.rows.length === 0
      ? `<p style="margin:0 0 12px;">Boas notícias: nenhuma cidade ficou abaixo da meta de conversão nas <strong>${periodoLabel}</strong> (mínimo de ${result.minPreviews} prévias para considerar).</p>`
      : `<p style="margin:0 0 12px;">As cidades abaixo tiveram pelo menos <strong>${result.minPreviews}</strong> prévias do WhatsApp nas <strong>${periodoLabel}</strong> e ficaram abaixo da meta de conversão configurada.</p>`;

  let table = "";
  if (result.rows.length > 0) {
    const rowsHtml = result.rows
      .map((r) => {
        const tag = r.isPerCityTarget ? "específica" : "padrão";
        return `<tr>
  <td style="padding:8px 10px; border-top:1px solid #E0E3EB; color:#0D0D0D; font-weight:600;">${escapeHtml(r.city)}</td>
  <td style="padding:8px 10px; border-top:1px solid #E0E3EB; color:#A11A1A; font-weight:700;">${fmtPct(r.ratePct)}%</td>
  <td style="padding:8px 10px; border-top:1px solid #E0E3EB; color:#2A2D38;">${fmtPct(r.targetPct)}% <span style="color:#7A7F8C; font-size:11px;">(${tag})</span></td>
  <td style="padding:8px 10px; border-top:1px solid #E0E3EB; color:#A11A1A;">−${fmtPct(r.gapPct)} p.p.</td>
  <td style="padding:8px 10px; border-top:1px solid #E0E3EB; color:#2A2D38;">${r.previews}</td>
  <td style="padding:8px 10px; border-top:1px solid #E0E3EB; color:#2A2D38;">${r.signups}</td>
</tr>`;
      })
      .join("\n");
    table = `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse; width:100%; font-size:13px; margin:0 0 16px;">
<thead>
  <tr style="background:#F5F7FA; color:#7A7F8C; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.04em;">
    <th style="padding:8px 10px;">Cidade</th>
    <th style="padding:8px 10px;">Conversão</th>
    <th style="padding:8px 10px;">Meta</th>
    <th style="padding:8px 10px;">Diferença</th>
    <th style="padding:8px 10px;">Prévias</th>
    <th style="padding:8px 10px;">Cadastros</th>
  </tr>
</thead>
<tbody>
${rowsHtml}
</tbody>
</table>`;
  }

  return `<!doctype html>
<html lang="pt-BR">
<body style="font-family: Arial, sans-serif; color:#0D0D0D; max-width:720px; margin:0 auto; padding:24px;">
  <h2 style="margin:0 0 8px; color:${result.rows.length === 0 ? "#0E7D3D" : "#A11A1A"};">${result.rows.length === 0 ? "✅" : "⚠️"} Cidades abaixo da meta — resumo ${frequency === "weekly" ? "semanal" : "diário"}</h2>
  <p style="margin:0 0 4px; color:#7A7F8C; font-size:12px;">Período: ${escapeHtml(fmtDateBR(result.since))} a ${escapeHtml(fmtDateBR(result.until))}</p>
  ${headerNote}
  ${table}
  <p style="margin:0 0 16px;">
    <a href="${linkAttr}" style="color:#0A55C2;">Abrir o painel administrativo</a> para ver detalhes e ajustar metas por cidade.
  </p>
  <p style="color:#7A7F8C; font-size:12px; margin-top:24px;">
    Você está recebendo este resumo porque assinou os alertas de cidades abaixo da meta.
    Para cancelar ou pausar, abra o painel admin → aba "Relatórios por email".
  </p>
</body>
</html>`;
}

function isDue(
  frequency: BelowTargetFrequency,
  lastSentAt: Date | null,
  now: Date,
): boolean {
  if (!lastSentAt) return true;
  const elapsed = now.getTime() - lastSentAt.getTime();
  if (frequency === "weekly") return elapsed >= 7 * 24 * 60 * 60 * 1000;
  // daily — allow a small grace so a 5-min tick that runs at slightly different
  // wall-clock times each day still fires once per day.
  return elapsed >= 23 * 60 * 60 * 1000;
}

export async function sendBelowTargetDigest(opts: {
  to: string | string[];
  frequency: BelowTargetFrequency;
  now?: Date;
}): Promise<{ rowsCount: number }> {
  const now = opts.now ?? new Date();
  const result = await computeBelowTargetRows(opts.frequency, now);
  const subject = buildDigestSubject(opts.frequency, result.rows.length);
  const html = buildDigestHtml(opts.frequency, result);
  await sendEmail({ to: opts.to, subject, html });
  return { rowsCount: result.rows.length };
}

export async function tickBelowTargetDigest(now: Date = new Date()): Promise<void> {
  const subs = await db
    .select()
    .from(emailReportSubscriptionsTable)
    .where(
      and(
        eq(emailReportSubscriptionsTable.enabled, true),
        eq(emailReportSubscriptionsTable.reportType, CITY_BELOW_TARGET_REPORT_TYPE),
      ),
    );

  const due = subs.filter((s) => {
    const f = s.frequency as BelowTargetFrequency;
    if (f !== "daily" && f !== "weekly") return false;
    return isDue(f, s.lastSentAt, now);
  });
  if (due.length === 0) return;

  if (!(await isEmailConfigured())) {
    logger.warn(
      { dueCount: due.length },
      "Email not configured; skipping below-target digest.",
    );
    return;
  }

  // Cache results per frequency since the digest is identical per frequency.
  const cache = new Map<
    BelowTargetFrequency,
    Awaited<ReturnType<typeof computeBelowTargetRows>>
  >();

  for (const sub of due) {
    const freq = sub.frequency as BelowTargetFrequency;
    try {
      let result = cache.get(freq);
      if (!result) {
        result = await computeBelowTargetRows(freq, now);
        cache.set(freq, result);
      }
      // Avoid noise: don't email when nothing is below target. Still
      // advance lastSentAt so the next due window is from "now", and the
      // admin can still trigger an empty-state preview via /send-now.
      if (result.rows.length === 0) {
        await db
          .update(emailReportSubscriptionsTable)
          .set({ lastSentAt: now, updatedAt: now })
          .where(eq(emailReportSubscriptionsTable.id, sub.id));
        continue;
      }
      const subject = buildDigestSubject(freq, result.rows.length);
      const html = buildDigestHtml(freq, result);
      await sendEmail({ to: sub.email, subject, html });
      await db
        .update(emailReportSubscriptionsTable)
        .set({ lastSentAt: now, updatedAt: now })
        .where(eq(emailReportSubscriptionsTable.id, sub.id));
    } catch (err) {
      logger.error(
        { err, subscriptionId: sub.id, email: sub.email, frequency: freq },
        "Failed to send below-target digest",
      );
    }
  }
}
