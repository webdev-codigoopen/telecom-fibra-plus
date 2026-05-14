import {
  db,
  appSettingsTable,
  demandInterestsTable,
  emailReportSubscriptionsTable,
  type DbEmailReportSubscription,
} from "@workspace/db";
import { and, asc, eq, gt, inArray, lte } from "drizzle-orm";
import { isEmailConfigured, sendEmail } from "./sendEmail";
import {
  isWhatsappNotifyEnabled,
  sendWhatsappNotification,
} from "./sendWhatsapp";
import { logger } from "./logger";

const TIME_ZONE = "America/Sao_Paulo";

export type QuietHoursSettings = {
  enabled: boolean;
  start: string;
  end: string;
  muteWeekends: boolean;
  digestEnabled: boolean;
  activeSince: Date | null;
  lastDigestSentAt: Date | null;
};

const QUIET_HOURS_KEYS = [
  "quiet_hours_enabled",
  "quiet_hours_start",
  "quiet_hours_end",
  "quiet_hours_weekends",
  "quiet_hours_digest_enabled",
  "quiet_hours_active_since",
  "quiet_hours_digest_last_sent_at",
] as const;

function parseDateOrNull(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isValidHHMM(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export async function loadQuietHoursSettings(): Promise<QuietHoursSettings> {
  const rows = await db
    .select({ key: appSettingsTable.key, value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(inArray(appSettingsTable.key, QUIET_HOURS_KEYS as unknown as string[]));
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const start = (map.get("quiet_hours_start") ?? "22:00").trim();
  const end = (map.get("quiet_hours_end") ?? "08:00").trim();
  return {
    enabled: (map.get("quiet_hours_enabled") ?? "false") === "true",
    start: isValidHHMM(start) ? start : "22:00",
    end: isValidHHMM(end) ? end : "08:00",
    muteWeekends: (map.get("quiet_hours_weekends") ?? "false") === "true",
    digestEnabled: (map.get("quiet_hours_digest_enabled") ?? "false") === "true",
    activeSince: parseDateOrNull(map.get("quiet_hours_active_since")),
    lastDigestSentAt: parseDateOrNull(map.get("quiet_hours_digest_last_sent_at")),
  };
}

type LocalParts = { hour: number; minute: number; weekday: number };

function localPartsInTz(now: Date): LocalParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const parts = fmt.formatToParts(now);
  let hour = 0;
  let minute = 0;
  let weekdayStr = "Mon";
  for (const p of parts) {
    if (p.type === "hour") hour = parseInt(p.value, 10) % 24;
    else if (p.type === "minute") minute = parseInt(p.value, 10);
    else if (p.type === "weekday") weekdayStr = p.value;
  }
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return { hour, minute, weekday: map[weekdayStr] ?? 1 };
}

function hhmmToMinutes(s: string): number {
  const [h, m] = s.split(":");
  return parseInt(h ?? "0", 10) * 60 + parseInt(m ?? "0", 10);
}

export function isInQuietHours(now: Date, s: QuietHoursSettings): boolean {
  if (!s.enabled) return false;
  const { hour, minute, weekday } = localPartsInTz(now);
  if (s.muteWeekends && (weekday === 0 || weekday === 6)) return true;
  if (s.start === s.end) return false;
  const cur = hour * 60 + minute;
  const start = hhmmToMinutes(s.start);
  const end = hhmmToMinutes(s.end);
  if (start < end) return cur >= start && cur < end;
  return cur >= start || cur < end;
}

/**
 * Returns the timestamp at which the currently-active muted streak began.
 * Walks back in 1-minute steps until quiet hours stop being active. This
 * decouples the digest window start from the scheduler cadence: if the daily
 * window starts at 22:00 but the first tick we observe is 22:04, we still
 * report 22:00 as the start so leads received in those 4 minutes are included
 * in the digest.
 *
 * Returns null if the supplied moment is not currently inside quiet hours.
 */
export function computeMutedSince(now: Date, s: QuietHoursSettings): Date | null {
  if (!isInQuietHours(now, s)) return null;
  const STEP_MS = 60_000;
  // Cap walk-back at 8 days — covers a long weekend mute followed by a daily
  // window with plenty of headroom.
  const MAX_STEPS = 8 * 24 * 60;
  let candidate = now;
  for (let i = 0; i < MAX_STEPS; i++) {
    const prev = new Date(candidate.getTime() - STEP_MS);
    if (!isInQuietHours(prev, s)) return candidate;
    candidate = prev;
  }
  return candidate;
}

async function setSetting(key: string, value: string, now: Date): Promise<void> {
  await db
    .insert(appSettingsTable)
    .values({ key, value })
    .onConflictDoUpdate({
      target: appSettingsTable.key,
      set: { value, updatedAt: now },
    });
}

export async function shouldNotifyNow(now: Date = new Date()): Promise<boolean> {
  try {
    const s = await loadQuietHoursSettings();
    return !isInQuietHours(now, s);
  } catch (err) {
    logger.error({ err }, "Failed to evaluate quiet hours; allowing notification");
    return true;
  }
}

// ---------------------------------------------------------------------------
// Per-recipient quiet hours. Each interest_notification subscription can
// configure its own muted window (start/end/weekends) and choose what to do
// with messages that arrive during that window: "skip" them entirely or
// "queue" them and send a single digest at the end of the window.
// ---------------------------------------------------------------------------

export type RecipientQuietHours = {
  enabled: boolean;
  start: string;
  end: string;
  muteWeekends: boolean;
  mode: "queue" | "skip";
};

export function recipientQuietHours(
  sub: Pick<
    DbEmailReportSubscription,
    | "quietHoursEnabled"
    | "quietHoursStart"
    | "quietHoursEnd"
    | "quietHoursWeekends"
    | "quietHoursMode"
  >,
): RecipientQuietHours {
  const start = isValidHHMM(sub.quietHoursStart) ? sub.quietHoursStart : "22:00";
  const end = isValidHHMM(sub.quietHoursEnd) ? sub.quietHoursEnd : "08:00";
  const mode = sub.quietHoursMode === "skip" ? "skip" : "queue";
  return {
    enabled: !!sub.quietHoursEnabled,
    start,
    end,
    muteWeekends: !!sub.quietHoursWeekends,
    mode,
  };
}

export function isInRecipientQuietHours(
  now: Date,
  r: RecipientQuietHours,
): boolean {
  if (!r.enabled) return false;
  return isInQuietHours(now, {
    enabled: true,
    start: r.start,
    end: r.end,
    muteWeekends: r.muteWeekends,
    digestEnabled: false,
    activeSince: null,
    lastDigestSentAt: null,
  });
}

function computeRecipientMutedSince(
  now: Date,
  r: RecipientQuietHours,
): Date | null {
  return computeMutedSince(now, {
    enabled: r.enabled,
    start: r.start,
    end: r.end,
    muteWeekends: r.muteWeekends,
    digestEnabled: false,
    activeSince: null,
    lastDigestSentAt: null,
  });
}

/**
 * Per-recipient version of `tickQuietHours`. For each interest_notification
 * subscription that has its own quiet-hours window configured, anchor the
 * muted-streak start while inside the window and, on exit, send a digest of
 * leads received during the muted period (only when the recipient's mode is
 * "queue"). For "skip" recipients the marker is just cleared.
 */
export async function tickRecipientQuietHours(
  now: Date = new Date(),
): Promise<void> {
  try {
    const subs = await db
      .select()
      .from(emailReportSubscriptionsTable)
      .where(
        and(
          eq(emailReportSubscriptionsTable.reportType, "interest_notification"),
          eq(emailReportSubscriptionsTable.frequency, "instant"),
          eq(emailReportSubscriptionsTable.enabled, true),
          eq(emailReportSubscriptionsTable.quietHoursEnabled, true),
        ),
      );
    if (subs.length === 0) return;

    let smtpReady: boolean | null = null;
    async function ensureSmtp(): Promise<boolean> {
      if (smtpReady !== null) return smtpReady;
      smtpReady = await isEmailConfigured();
      return smtpReady;
    }

    for (const sub of subs) {
      try {
        const r = recipientQuietHours(sub);
        const inWindow = isInRecipientQuietHours(now, r);

        if (inWindow) {
          if (!sub.quietHoursActiveSince) {
            const mutedSince = computeRecipientMutedSince(now, r) ?? now;
            await db
              .update(emailReportSubscriptionsTable)
              .set({ quietHoursActiveSince: mutedSince, updatedAt: now })
              .where(eq(emailReportSubscriptionsTable.id, sub.id));
          }
          continue;
        }

        if (!sub.quietHoursActiveSince) continue;

        const activeSince = sub.quietHoursActiveSince;
        await db
          .update(emailReportSubscriptionsTable)
          .set({ quietHoursActiveSince: null, updatedAt: now })
          .where(eq(emailReportSubscriptionsTable.id, sub.id));

        if (r.mode !== "queue") continue;
        if (!(await ensureSmtp())) {
          logger.warn(
            { subscriptionId: sub.id },
            "Per-recipient quiet-hours digest skipped: SMTP not configured",
          );
          continue;
        }

        const rows = await fetchInterestsBetween(activeSince, now);
        if (rows.length === 0) {
          await db
            .update(emailReportSubscriptionsTable)
            .set({ quietHoursLastDigestSentAt: now, updatedAt: now })
            .where(eq(emailReportSubscriptionsTable.id, sub.id));
          continue;
        }
        const { subject, html, text } = buildQuietDigestEmail(
          rows,
          activeSince,
          now,
        );
        try {
          await sendEmail({ to: sub.email, subject, html, text });
          await db
            .update(emailReportSubscriptionsTable)
            .set({ quietHoursLastDigestSentAt: now, updatedAt: now })
            .where(eq(emailReportSubscriptionsTable.id, sub.id));
          logger.info(
            { to: sub.email, leads: rows.length },
            "Per-recipient quiet-hours digest sent",
          );
        } catch (err) {
          logger.error(
            { err, to: sub.email },
            "Failed to send per-recipient quiet-hours digest",
          );
        }
      } catch (err) {
        logger.error(
          { err, subscriptionId: sub.id },
          "Per-recipient quiet hours tick failed for subscription",
        );
      }
    }
  } catch (err) {
    logger.error({ err }, "tickRecipientQuietHours failed");
  }
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

function fmtDateTimeBR(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: TIME_ZONE,
  }).format(d);
}

async function fetchInterestsBetween(
  fromExclusive: Date,
  toInclusive: Date,
): Promise<
  Array<{ city: string; neighborhood: string; whatsapp: string; createdAt: Date }>
> {
  return db
    .select({
      city: demandInterestsTable.city,
      neighborhood: demandInterestsTable.neighborhood,
      whatsapp: demandInterestsTable.whatsapp,
      createdAt: demandInterestsTable.createdAt,
    })
    .from(demandInterestsTable)
    .where(
      and(
        gt(demandInterestsTable.createdAt, fromExclusive),
        lte(demandInterestsTable.createdAt, toInclusive),
      ),
    )
    .orderBy(asc(demandInterestsTable.createdAt));
}

async function getInstantInterestRecipients(): Promise<string[]> {
  const { emailReportSubscriptionsTable, appSettingsTable: settingsTable } =
    await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  const subs = await db
    .select({ email: emailReportSubscriptionsTable.email })
    .from(emailReportSubscriptionsTable)
    .where(
      and(
        eq(emailReportSubscriptionsTable.reportType, "interest_notification"),
        eq(emailReportSubscriptionsTable.frequency, "instant"),
        eq(emailReportSubscriptionsTable.enabled, true),
        // Recipients with their own quiet-hours configured opt out of the
        // global digest entirely — they get their own per-recipient digest at
        // the end of their own window via tickRecipientQuietHours.
        eq(emailReportSubscriptionsTable.quietHoursEnabled, false),
      ),
    );
  // Backward-compat with the legacy single-email setting (mirrors
  // notifyAdminOfNewInterest in demand_interests.ts).
  const legacyRows = await db
    .select({ key: settingsTable.key, value: settingsTable.value })
    .from(settingsTable)
    .where(
      inArray(settingsTable.key, [
        "interest_notification_enabled",
        "interest_notification_email",
        "interest_notification_frequency",
      ]),
    );
  const m = new Map(legacyRows.map((r) => [r.key, r.value]));
  const recipients = new Set<string>();
  for (const s of subs) recipients.add(s.email.trim().toLowerCase());
  if (
    (m.get("interest_notification_enabled") ?? "false") === "true" &&
    (m.get("interest_notification_frequency") ?? "instant") === "instant"
  ) {
    const email = (m.get("interest_notification_email") ?? "").trim();
    if (email) recipients.add(email.toLowerCase());
  }
  return Array.from(recipients);
}

function buildQuietDigestEmail(
  rows: Array<{
    city: string;
    neighborhood: string;
    whatsapp: string;
    createdAt: Date;
  }>,
  windowStart: Date,
  now: Date,
): { subject: string; html: string; text: string } {
  const subject = `Resumo do silêncio noturno (${rows.length}) — ${fmtDateTimeBR(now)}`;
  const itemsHtml = rows
    .map((r) => {
      const link = whatsappLink(r.whatsapp);
      return `
<tr>
  <td style="padding:10px 8px;border-bottom:1px solid #E0E3EB;font-size:13px;color:#7A7F8C;white-space:nowrap">${escapeHtml(fmtDateTimeBR(r.createdAt))}</td>
  <td style="padding:10px 8px;border-bottom:1px solid #E0E3EB;font-size:14px;font-weight:600;color:#0D0D0D">${escapeHtml(r.city)}</td>
  <td style="padding:10px 8px;border-bottom:1px solid #E0E3EB;font-size:14px;color:#0D0D0D">${escapeHtml(r.neighborhood)}</td>
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
<h2 style="margin:0 0 4px;font-size:18px">Interesses recebidos durante o silêncio noturno</h2>
<p style="margin:0 0 16px;color:#7A7F8C;font-size:13px">
  ${rows.length} cadastro(s) chegaram entre ${escapeHtml(fmtDateTimeBR(windowStart))} e ${escapeHtml(fmtDateTimeBR(now))}.
  Eles ficaram salvos no painel e este resumo é enviado agora que o horário de silêncio terminou.
</p>
<table style="width:100%;border-collapse:collapse">
  <thead>
    <tr style="background:#F5F7FA">
      <th align="left" style="padding:8px;font-size:12px;color:#7A7F8C;border-bottom:1px solid #E0E3EB">Recebido</th>
      <th align="left" style="padding:8px;font-size:12px;color:#7A7F8C;border-bottom:1px solid #E0E3EB">Cidade</th>
      <th align="left" style="padding:8px;font-size:12px;color:#7A7F8C;border-bottom:1px solid #E0E3EB">Bairro/Rua</th>
      <th align="right" style="padding:8px;font-size:12px;color:#7A7F8C;border-bottom:1px solid #E0E3EB"></th>
    </tr>
  </thead>
  <tbody>${itemsHtml}</tbody>
</table>
</div>
</body></html>`.trim();

  const text = [
    `Interesses recebidos durante o silêncio noturno — ${rows.length} cadastro(s)`,
    `Período: ${fmtDateTimeBR(windowStart)} até ${fmtDateTimeBR(now)}`,
    "",
    ...rows.map(
      (r) =>
        `- ${fmtDateTimeBR(r.createdAt)} | ${r.city} / ${r.neighborhood} | ${whatsappLink(r.whatsapp)}`,
    ),
  ].join("\n");
  return { subject, html, text };
}

function buildQuietDigestWhatsappText(
  rows: Array<{
    city: string;
    neighborhood: string;
    whatsapp: string;
    createdAt: Date;
  }>,
  windowStart: Date,
  now: Date,
): string {
  const MAX_LEN = 3500;
  const header = [
    `*Resumo do silêncio noturno* — ${rows.length} cadastro(s)`,
    `Período: ${fmtDateTimeBR(windowStart)} até ${fmtDateTimeBR(now)}`,
    "",
  ].join("\n");
  const lines: string[] = [];
  let included = 0;
  for (const r of rows) {
    const line = `• ${fmtDateTimeBR(r.createdAt)} — ${r.city} / ${r.neighborhood}\n  ${whatsappLink(r.whatsapp)}`;
    const projected = header.length + lines.join("\n").length + line.length + 2;
    if (projected > MAX_LEN) break;
    lines.push(line);
    included += 1;
  }
  let body = header + lines.join("\n");
  if (included < rows.length) {
    body += `\n\n…e mais ${rows.length - included} cadastro(s). Veja todos no painel.`;
  }
  return body;
}

/**
 * Tracks transitions in/out of the configured quiet-hours window and, when
 * configured, sends a digest of the muted interests at the end of the window.
 *
 * Called periodically by the scheduler tick. Safe to call frequently — it's a
 * no-op when nothing has changed.
 */
export async function tickQuietHours(now: Date = new Date()): Promise<void> {
  try {
    const s = await loadQuietHoursSettings();
    const inWindow = isInQuietHours(now, s);

    if (inWindow) {
      // Anchor the start of this muted streak the first time we observe it.
      // We compute it deterministically from the configured window (rather
      // than using `now`) so the digest covers leads that arrived between
      // the actual quiet-hours boundary and the first scheduler tick inside
      // the window.
      if (!s.activeSince) {
        const mutedSince = computeMutedSince(now, s) ?? now;
        await setSetting("quiet_hours_active_since", mutedSince.toISOString(), now);
      }
      return;
    }

    // Outside quiet hours.
    if (!s.activeSince) return;

    // We just exited a quiet window. Always clear the marker so subsequent
    // ticks don't re-process.
    await setSetting("quiet_hours_active_since", "", now);

    if (!s.digestEnabled) return;

    const recipients = await getInstantInterestRecipients();
    const smtpReady = await isEmailConfigured();
    const whatsappReady = await isWhatsappNotifyEnabled();

    if (recipients.length === 0 && !whatsappReady) return;
    if (recipients.length > 0 && !smtpReady) {
      logger.warn(
        { count: recipients.length },
        "Quiet-hours digest email skipped: SMTP not configured",
      );
    }

    const rows = await fetchInterestsBetween(s.activeSince, now);
    if (rows.length === 0) {
      await setSetting("quiet_hours_digest_last_sent_at", now.toISOString(), now);
      return;
    }

    let emailDelivered = 0;
    let whatsappDelivered = false;

    if (recipients.length > 0 && smtpReady) {
      const { subject, html, text } = buildQuietDigestEmail(
        rows,
        s.activeSince,
        now,
      );
      const results = await Promise.all(
        recipients.map((to) =>
          sendEmail({ to, subject, html, text })
            .then(() => true)
            .catch((err) => {
              logger.error(
                { err, to },
                "Failed to send quiet-hours digest to recipient",
              );
              return false;
            }),
        ),
      );
      emailDelivered = results.filter(Boolean).length;
    }

    if (whatsappReady) {
      const waText = buildQuietDigestWhatsappText(rows, s.activeSince, now);
      try {
        const result = await sendWhatsappNotification(waText);
        if (!result.ok) {
          logger.error(
            { error: result.error },
            "Failed to send quiet-hours digest via WhatsApp",
          );
        } else {
          whatsappDelivered = true;
          logger.info(
            { leads: rows.length },
            "Quiet-hours digest sent via WhatsApp",
          );
        }
      } catch (err) {
        logger.error({ err }, "Failed to send quiet-hours digest via WhatsApp");
      }
    }

    if (emailDelivered > 0 || whatsappDelivered) {
      await setSetting("quiet_hours_digest_last_sent_at", now.toISOString(), now);
      logger.info(
        {
          emailDelivered,
          whatsappDelivered,
          leads: rows.length,
        },
        "Quiet-hours digest sent",
      );
    } else {
      logger.warn(
        { leads: rows.length },
        "Quiet-hours digest had no successful delivery on any channel",
      );
    }
  } catch (err) {
    logger.error({ err }, "tickQuietHours failed");
  }
}

