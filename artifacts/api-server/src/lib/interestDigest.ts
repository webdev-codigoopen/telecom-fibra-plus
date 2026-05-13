import {
  db,
  appSettingsTable,
  demandInterestsTable,
  emailReportSubscriptionsTable,
} from "@workspace/db";
import { and, asc, eq, gt, inArray } from "drizzle-orm";
import { isEmailConfigured, sendEmail } from "./sendEmail";
import { logger } from "./logger";

export type DigestFrequency = "daily" | "weekly";

const TIME_ZONE = "America/Sao_Paulo";

export type DigestSchedule = { hour: number; weekday: number };

const DEFAULT_DIGEST_HOUR = 8;
const DEFAULT_DIGEST_WEEKDAY = 1; // Monday

export async function loadDigestSchedule(): Promise<DigestSchedule> {
  const rows = await db
    .select({ key: appSettingsTable.key, value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(
      inArray(appSettingsTable.key, [
        "interest_digest_hour",
        "interest_digest_weekday",
      ]),
    );
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const hourRaw = map.get("interest_digest_hour");
  const weekdayRaw = map.get("interest_digest_weekday");
  const hour =
    hourRaw != null && /^([0-9]|1[0-9]|2[0-3])$/.test(hourRaw.trim())
      ? parseInt(hourRaw.trim(), 10)
      : DEFAULT_DIGEST_HOUR;
  const weekday =
    weekdayRaw != null && /^[0-6]$/.test(weekdayRaw.trim())
      ? parseInt(weekdayRaw.trim(), 10)
      : DEFAULT_DIGEST_WEEKDAY;
  return { hour, weekday };
}

type SPParts = { year: number; month: number; day: number; hour: number; weekday: number };

function spParts(now: Date): SPParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    weekday: "short",
  });
  const parts = fmt.formatToParts(now);
  let year = 1970;
  let month = 1;
  let day = 1;
  let hour = 0;
  let weekdayStr = "Mon";
  for (const p of parts) {
    if (p.type === "year") year = parseInt(p.value, 10);
    else if (p.type === "month") month = parseInt(p.value, 10);
    else if (p.type === "day") day = parseInt(p.value, 10);
    else if (p.type === "hour") hour = parseInt(p.value, 10) % 24;
    else if (p.type === "weekday") weekdayStr = p.value;
  }
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return { year, month, day, hour, weekday: weekdayMap[weekdayStr] ?? 1 };
}

// Returns the UTC instant for `year-month-day hour:00` interpreted in
// America/Sao_Paulo. Uses Intl to derive the offset (handles potential DST
// reintroduction defensively).
function spWallToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, 0, 0, 0);
  // Compute the actual offset SP has at that instant.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = fmt.formatToParts(new Date(guess));
  let gy = 0,
    gm = 0,
    gd = 0,
    gh = 0,
    gmi = 0;
  for (const p of parts) {
    if (p.type === "year") gy = parseInt(p.value, 10);
    else if (p.type === "month") gm = parseInt(p.value, 10);
    else if (p.type === "day") gd = parseInt(p.value, 10);
    else if (p.type === "hour") gh = parseInt(p.value, 10) % 24;
    else if (p.type === "minute") gmi = parseInt(p.value, 10);
  }
  const localAsUtc = Date.UTC(gy, gm - 1, gd, gh, gmi, 0, 0);
  const offset = localAsUtc - guess; // SP wall - UTC
  return new Date(guess - offset);
}

// Most recent SP "today at hour" instant that has already occurred (or now).
function lastDailySlot(now: Date, hour: number): Date {
  const sp = spParts(now);
  let candidate = spWallToUtc(sp.year, sp.month, sp.day, hour);
  if (candidate.getTime() > now.getTime()) {
    // Today's SP slot hasn't happened yet — anchor at noon UTC of the prior
    // calendar day to safely land on the previous SP-local day regardless
    // of the SP UTC offset.
    const prev = new Date(
      Date.UTC(sp.year, sp.month - 1, sp.day - 1, 12, 0, 0, 0),
    );
    const prevSp = spParts(prev);
    candidate = spWallToUtc(prevSp.year, prevSp.month, prevSp.day, hour);
  }
  return candidate;
}

// Most recent SP "weekday at hour" instant that has already occurred (or now).
function lastWeeklySlot(now: Date, weekday: number, hour: number): Date {
  const sp = spParts(now);
  const daysBack = (sp.weekday - weekday + 7) % 7;
  const stepBack = new Date(
    Date.UTC(sp.year, sp.month - 1, sp.day - daysBack, 12, 0, 0, 0),
  );
  const back = spParts(stepBack);
  let candidate = spWallToUtc(back.year, back.month, back.day, hour);
  if (candidate.getTime() > now.getTime()) {
    // Slot today (target weekday) but hour not yet reached — go back a week.
    const prev = new Date(candidate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const prevSp = spParts(prev);
    candidate = spWallToUtc(prevSp.year, prevSp.month, prevSp.day, hour);
  }
  return candidate;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function whatsappLink(digits: string): string {
  const d = digits.replace(/\D/g, "");
  const withCountry = d.length <= 11 ? `55${d}` : d;
  return `https://wa.me/${withCountry}`;
}

function formatWhatsappDisplay(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("55")) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  if (d.length === 12 && d.startsWith("55")) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  }
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digits;
}

function fmtDateTimeBR(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(d);
}

function fmtDateBR(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(d);
}

export function isDueDigest(
  frequency: DigestFrequency,
  lastSentAt: Date | null,
  now: Date,
  schedule: DigestSchedule,
): boolean {
  const slot =
    frequency === "daily"
      ? lastDailySlot(now, schedule.hour)
      : lastWeeklySlot(now, schedule.weekday, schedule.hour);
  if (slot.getTime() > now.getTime()) return false;
  if (!lastSentAt) return true;
  return lastSentAt.getTime() < slot.getTime();
}

function buildDigestEmail(
  frequency: DigestFrequency,
  rows: Array<{
    city: string;
    neighborhood: string;
    whatsapp: string;
    createdAt: Date;
  }>,
  since: Date | null,
  now: Date,
): { subject: string; html: string; text: string } {
  const label = frequency === "daily" ? "diário" : "semanal";
  const periodLabel = since
    ? `${fmtDateTimeBR(since)} até ${fmtDateTimeBR(now)}`
    : `até ${fmtDateTimeBR(now)}`;
  const subject = `Resumo ${label} de interesses (${rows.length}) — ${fmtDateBR(now)}`;

  const itemsHtml = rows
    .map((r) => {
      const link = whatsappLink(r.whatsapp);
      const display = formatWhatsappDisplay(r.whatsapp);
      return `
<tr>
  <td style="padding:10px 8px;border-bottom:1px solid #E0E3EB;font-size:13px;color:#7A7F8C;white-space:nowrap">${escapeHtml(fmtDateTimeBR(r.createdAt))}</td>
  <td style="padding:10px 8px;border-bottom:1px solid #E0E3EB;font-size:14px;font-weight:600;color:#0D0D0D">${escapeHtml(r.city)}</td>
  <td style="padding:10px 8px;border-bottom:1px solid #E0E3EB;font-size:14px;color:#0D0D0D">${escapeHtml(r.neighborhood)}</td>
  <td style="padding:10px 8px;border-bottom:1px solid #E0E3EB;font-size:13px;font-family:monospace;color:#0D0D0D">${escapeHtml(display)}</td>
  <td style="padding:10px 8px;border-bottom:1px solid #E0E3EB;text-align:right">
    <a href="${link}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;font-weight:700;padding:6px 12px;border-radius:6px;font-size:12px">WhatsApp</a>
  </td>
</tr>`;
    })
    .join("");

  const html = `
<!doctype html>
<html lang="pt-BR"><body style="font-family:Arial,sans-serif;color:#0D0D0D;background:#F5F7FA;padding:20px">
<div style="max-width:720px;margin:0 auto;background:#fff;border:1px solid #E0E3EB;border-radius:12px;padding:24px">
<h2 style="margin:0 0 4px;font-size:18px">Resumo ${escapeHtml(label)} de interesses</h2>
<p style="margin:0 0 16px;color:#7A7F8C;font-size:13px">
  ${rows.length} novo(s) cadastro(s) em /demanda<br/>
  Período: ${escapeHtml(periodLabel)}
</p>
<table style="width:100%;border-collapse:collapse">
  <thead>
    <tr style="background:#F5F7FA">
      <th align="left" style="padding:8px;font-size:12px;color:#7A7F8C;border-bottom:1px solid #E0E3EB">Recebido</th>
      <th align="left" style="padding:8px;font-size:12px;color:#7A7F8C;border-bottom:1px solid #E0E3EB">Cidade</th>
      <th align="left" style="padding:8px;font-size:12px;color:#7A7F8C;border-bottom:1px solid #E0E3EB">Bairro/Rua</th>
      <th align="left" style="padding:8px;font-size:12px;color:#7A7F8C;border-bottom:1px solid #E0E3EB">WhatsApp</th>
      <th align="right" style="padding:8px;font-size:12px;color:#7A7F8C;border-bottom:1px solid #E0E3EB"></th>
    </tr>
  </thead>
  <tbody>${itemsHtml}</tbody>
</table>
<p style="margin:18px 0 0;color:#7A7F8C;font-size:12px">
  Você está recebendo este resumo porque a frequência de notificações de interesse está configurada como "${escapeHtml(label)}" no painel.
</p>
</div>
</body></html>`.trim();

  const textLines = [
    `Resumo ${label} de interesses — ${rows.length} novo(s) cadastro(s)`,
    `Período: ${periodLabel}`,
    "",
    ...rows.map(
      (r) =>
        `- ${fmtDateTimeBR(r.createdAt)} | ${r.city} / ${r.neighborhood} | ${formatWhatsappDisplay(r.whatsapp)} | ${whatsappLink(r.whatsapp)}`,
    ),
  ];
  return { subject, html, text: textLines.join("\n") };
}

async function fetchInterestsSince(since: Date | null): Promise<
  Array<{ city: string; neighborhood: string; whatsapp: string; createdAt: Date }>
> {
  const baseSelect = db
    .select({
      city: demandInterestsTable.city,
      neighborhood: demandInterestsTable.neighborhood,
      whatsapp: demandInterestsTable.whatsapp,
      createdAt: demandInterestsTable.createdAt,
    })
    .from(demandInterestsTable);
  const filtered = since
    ? baseSelect.where(gt(demandInterestsTable.createdAt, since))
    : baseSelect;
  return filtered.orderBy(asc(demandInterestsTable.createdAt));
}

export async function sendInterestDigestToSubscription(
  sub: {
    id: number;
    email: string;
    frequency: string;
    lastSentAt: Date | null;
  },
  now: Date = new Date(),
): Promise<{ count: number }> {
  if (sub.frequency !== "daily" && sub.frequency !== "weekly") {
    throw new Error(
      `Cannot send interest digest for frequency "${sub.frequency}" (must be daily or weekly).`,
    );
  }
  const frequency: DigestFrequency = sub.frequency;
  const lastSentAt = sub.lastSentAt ?? null;
  const rows = await fetchInterestsSince(lastSentAt);
  const { subject, html, text } = buildDigestEmail(frequency, rows, lastSentAt, now);
  await sendEmail({ to: sub.email, subject, html, text });
  await db
    .update(emailReportSubscriptionsTable)
    .set({ lastSentAt: now, updatedAt: now })
    .where(eq(emailReportSubscriptionsTable.id, sub.id));
  return { count: rows.length };
}

export async function sendDueInterestDigest(now: Date = new Date()): Promise<void> {
  // Fetch all enabled digest subscriptions (daily/weekly).
  const subs = await db
    .select()
    .from(emailReportSubscriptionsTable)
    .where(
      and(
        eq(emailReportSubscriptionsTable.reportType, "interest_notification"),
        eq(emailReportSubscriptionsTable.enabled, true),
      ),
    );
  const digestSubs = subs.filter(
    (s) => s.frequency === "daily" || s.frequency === "weekly",
  );
  if (digestSubs.length === 0) return;

  if (!(await isEmailConfigured())) {
    logger.warn(
      { count: digestSubs.length },
      "Interest digest skipped: SMTP not configured",
    );
    return;
  }

  // Cache fetched interest rows per "since" timestamp to avoid re-querying for
  // recipients that share the same cutoff.
  const rowsCache = new Map<string, Awaited<ReturnType<typeof fetchInterestsSince>>>();

  const schedule = await loadDigestSchedule();

  for (const sub of digestSubs) {
    try {
      const frequency = sub.frequency as DigestFrequency;
      const lastSentAt = sub.lastSentAt ?? null;
      if (!isDueDigest(frequency, lastSentAt, now, schedule)) continue;

      const cacheKey = lastSentAt ? lastSentAt.toISOString() : "__all__";
      let rows = rowsCache.get(cacheKey);
      if (!rows) {
        rows = await fetchInterestsSince(lastSentAt);
        rowsCache.set(cacheKey, rows);
      }

      if (rows.length === 0) {
        await db
          .update(emailReportSubscriptionsTable)
          .set({ lastSentAt: now, updatedAt: now })
          .where(eq(emailReportSubscriptionsTable.id, sub.id));
        continue;
      }

      const { subject, html, text } = buildDigestEmail(
        frequency,
        rows,
        lastSentAt,
        now,
      );
      await sendEmail({ to: sub.email, subject, html, text });
      await db
        .update(emailReportSubscriptionsTable)
        .set({ lastSentAt: now, updatedAt: now })
        .where(eq(emailReportSubscriptionsTable.id, sub.id));
      logger.info(
        { to: sub.email, frequency, count: rows.length },
        "Interest digest sent",
      );
    } catch (err) {
      logger.error(
        { err, subId: sub.id, email: sub.email },
        "Failed to send interest digest to recipient",
      );
    }
  }
}
