import {
  db,
  appSettingsTable,
  botCleanupRunsTable,
  emailReportSubscriptionsTable,
} from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { logger } from "./logger";
import { isEmailConfigured, sendEmail } from "./sendEmail";
import type { BotCleanupStatus } from "./botClickBackfillScheduler";
import { fetchSystemAlertRecipients } from "./systemAlertSubscriptions";

export const BOT_CLEANUP_ALERT_STATE_KEY = "bot_cleanup_alert_state";
export const BOT_CLEANUP_ALERT_HISTORY_KEY = "bot_cleanup_alert_history";

const STALE_THRESHOLD_MS = 36 * 60 * 60 * 1000;
const ALERT_HISTORY_LIMIT = 20;

export type BotCleanupAlertKind = "failure" | "stale" | "test";

export type BotCleanupAlertHistoryEntry = {
  kind: BotCleanupAlertKind;
  sentAt: string;
  recipients: string[];
  subject: string;
  detail?: string | null;
};

async function readAlertHistory(): Promise<BotCleanupAlertHistoryEntry[]> {
  try {
    const rows = await db
      .select()
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, BOT_CLEANUP_ALERT_HISTORY_KEY))
      .limit(1);
    const row = rows[0];
    if (!row) return [];
    const parsed = JSON.parse(row.value) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: BotCleanupAlertHistoryEntry[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const r = item as Record<string, unknown>;
      const kind = r["kind"];
      const sentAt = r["sentAt"];
      const recipients = r["recipients"];
      const subject = r["subject"];
      if (
        (kind === "failure" || kind === "stale" || kind === "test") &&
        typeof sentAt === "string" &&
        Array.isArray(recipients) &&
        typeof subject === "string"
      ) {
        out.push({
          kind,
          sentAt,
          recipients: recipients.filter((x): x is string => typeof x === "string"),
          subject,
          detail:
            typeof r["detail"] === "string" ? (r["detail"] as string) : null,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function appendAlertHistory(
  entry: BotCleanupAlertHistoryEntry,
): Promise<void> {
  try {
    const current = await readAlertHistory();
    const next = [entry, ...current].slice(0, ALERT_HISTORY_LIMIT);
    const value = JSON.stringify(next);
    const now = new Date();
    await db
      .insert(appSettingsTable)
      .values({ key: BOT_CLEANUP_ALERT_HISTORY_KEY, value, updatedAt: now })
      .onConflictDoUpdate({
        target: appSettingsTable.key,
        set: { value, updatedAt: now },
      });
  } catch (err) {
    logger.warn(
      { err },
      "[bot-cleanup-alert] failed to append to alert history",
    );
  }
}

export async function getBotCleanupAlertHistory(): Promise<
  BotCleanupAlertHistoryEntry[]
> {
  return readAlertHistory();
}

type AlertState = {
  lastFailureAlertedAt: string | null;
  lastFailureStartedAt: string | null;
  lastStaleAlertedAt: string | null;
  lastStaleSuccessAt: string | null;
};

const EMPTY_STATE: AlertState = {
  lastFailureAlertedAt: null,
  lastFailureStartedAt: null,
  lastStaleAlertedAt: null,
  lastStaleSuccessAt: null,
};

async function readState(): Promise<AlertState> {
  try {
    const rows = await db
      .select()
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, BOT_CLEANUP_ALERT_STATE_KEY))
      .limit(1);
    const row = rows[0];
    if (!row) return { ...EMPTY_STATE };
    const parsed = JSON.parse(row.value) as Partial<AlertState>;
    return {
      lastFailureAlertedAt: parsed.lastFailureAlertedAt ?? null,
      lastFailureStartedAt: parsed.lastFailureStartedAt ?? null,
      lastStaleAlertedAt: parsed.lastStaleAlertedAt ?? null,
      lastStaleSuccessAt: parsed.lastStaleSuccessAt ?? null,
    };
  } catch {
    return { ...EMPTY_STATE };
  }
}

async function writeState(state: AlertState): Promise<void> {
  const value = JSON.stringify(state);
  const now = new Date();
  await db
    .insert(appSettingsTable)
    .values({ key: BOT_CLEANUP_ALERT_STATE_KEY, value, updatedAt: now })
    .onConflictDoUpdate({
      target: appSettingsTable.key,
      set: { value, updatedAt: now },
    });
}

async function fetchRecipients(): Promise<string[]> {
  // Preferred channel: dedicated system_alert subscribers. Once the admin
  // has configured this list (any row exists, enabled or not), we honor it
  // exactly — including an empty enabled set, which means "send to nobody".
  // We only fall back to legacy audiences when the list has never been
  // configured (truly pre-migration).
  let systemConfigured = false;
  const recipients = new Set<string>();
  try {
    const result = await fetchSystemAlertRecipients();
    systemConfigured = result.configured;
    for (const e of result.recipients) recipients.add(e);
  } catch (err) {
    logger.warn(
      { err },
      "[bot-cleanup-alert] failed to read system_alert subscriptions",
    );
  }

  if (systemConfigured) {
    return Array.from(recipients);
  }

  // Pre-migration fallback only: include the previous audience
  // (city_comparison subscribers + legacy interest_notification email) so
  // cleanup alerts continue to be delivered until an admin configures the
  // new dedicated list.
  try {
    const subs = await db
      .select({ email: emailReportSubscriptionsTable.email })
      .from(emailReportSubscriptionsTable)
      .where(
        and(
          eq(emailReportSubscriptionsTable.enabled, true),
          eq(emailReportSubscriptionsTable.reportType, "city_comparison"),
        ),
      );
    for (const r of subs) {
      const e = r.email.trim().toLowerCase();
      if (e) recipients.add(e);
    }
  } catch (err) {
    logger.warn(
      { err },
      "[bot-cleanup-alert] failed to read city_comparison fallback subscriptions",
    );
  }

  try {
    const legacyRows = await db
      .select({ key: appSettingsTable.key, value: appSettingsTable.value })
      .from(appSettingsTable)
      .where(
        inArray(appSettingsTable.key, [
          "interest_notification_email",
          "interest_notification_enabled",
        ]),
      );
    const m = new Map(legacyRows.map((r) => [r.key, r.value]));
    if ((m.get("interest_notification_enabled") ?? "false") === "true") {
      const email = (m.get("interest_notification_email") ?? "").trim();
      if (email) recipients.add(email.toLowerCase());
    }
  } catch (err) {
    logger.warn(
      { err },
      "[bot-cleanup-alert] failed to read legacy notification email",
    );
  }

  return Array.from(recipients);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtDateTimeBR(iso: string | null): string {
  if (!iso) return "nunca";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
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

function buildFailureHtml(status: BotCleanupStatus, dashboardUrl: string): string {
  const link = escapeHtml(dashboardUrl);
  const startedAt = escapeHtml(fmtDateTimeBR(status.startedAt));
  const finishedAt = escapeHtml(fmtDateTimeBR(status.finishedAt));
  const errorMsg = escapeHtml(status.error ?? "(sem mensagem de erro)");
  return `<!doctype html>
<html lang="pt-BR">
<body style="font-family: Arial, sans-serif; color:#0D0D0D; max-width:640px; margin:0 auto; padding:24px;">
  <h2 style="margin:0 0 8px; color:#A11A1A;">⚠️ Limpeza noturna falhou</h2>
  <p style="margin:0 0 12px;">
    A rotina diária de re-rotulagem de cliques de bots terminou com erro.
  </p>
  <ul style="margin:0 0 16px; padding-left:20px;">
    <li>Início: <strong>${startedAt}</strong></li>
    <li>Fim: <strong>${finishedAt}</strong></li>
    <li>Duração: <strong>${status.durationMs} ms</strong></li>
  </ul>
  <p style="margin:0 0 8px;"><strong>Mensagem de erro:</strong></p>
  <pre style="background:#F4F5F7;border:1px solid #E0E3EB;padding:12px;border-radius:6px;white-space:pre-wrap;font-size:12px;color:#0D0D0D;">${errorMsg}</pre>
  <p style="margin:16px 0 0;">
    Painel: <a href="${link}" style="color:#0A55C2;">${link}</a>
  </p>
</body>
</html>`;
}

function buildStaleHtml(
  lastSuccessAt: string | null,
  hoursSince: number,
  dashboardUrl: string,
): string {
  const link = escapeHtml(dashboardUrl);
  const last = escapeHtml(fmtDateTimeBR(lastSuccessAt));
  const hours = hoursSince.toFixed(1);
  return `<!doctype html>
<html lang="pt-BR">
<body style="font-family: Arial, sans-serif; color:#0D0D0D; max-width:640px; margin:0 auto; padding:24px;">
  <h2 style="margin:0 0 8px; color:#A11A1A;">⚠️ Limpeza noturna não roda há mais de 36 horas</h2>
  <p style="margin:0 0 12px;">
    A rotina diária de re-rotulagem de cliques de bots não teve sucesso recente.
  </p>
  <ul style="margin:0 0 16px; padding-left:20px;">
    <li>Última execução bem-sucedida: <strong>${last}</strong></li>
    <li>Horas desde o último sucesso: <strong>${hours}h</strong></li>
  </ul>
  <p style="margin:16px 0 0;">
    Painel: <a href="${link}" style="color:#0A55C2;">${link}</a>
  </p>
</body>
</html>`;
}

export type BotCleanupAlertResult =
  | { sent: false; reason: string }
  | { sent: true; recipients: string[] };

export async function notifyOnBotCleanupFailure(
  status: BotCleanupStatus,
): Promise<BotCleanupAlertResult> {
  if (status.ok) return { sent: false, reason: "ok" };

  const state = await readState();
  if (state.lastFailureStartedAt === status.startedAt) {
    return { sent: false, reason: "already-alerted" };
  }

  if (!(await isEmailConfigured())) {
    logger.warn(
      "[bot-cleanup-alert] email not configured; skipping failure alert",
    );
    return { sent: false, reason: "email-not-configured" };
  }

  const recipients = await fetchRecipients();
  if (recipients.length === 0) {
    return { sent: false, reason: "no-recipients" };
  }

  const dashboardUrl = adminDashboardUrl();
  const html = buildFailureHtml(status, dashboardUrl);
  const subject = `⚠️ Limpeza noturna falhou (${fmtDateTimeBR(status.startedAt)})`;

  try {
    await sendEmail({ to: recipients, subject, html });
  } catch (err) {
    logger.error(
      { err },
      "[bot-cleanup-alert] failed to send failure alert email",
    );
    return { sent: false, reason: "send-failed" };
  }

  const sentAt = new Date().toISOString();
  await writeState({
    ...state,
    lastFailureAlertedAt: sentAt,
    lastFailureStartedAt: status.startedAt,
  });
  await appendAlertHistory({
    kind: "failure",
    sentAt,
    recipients,
    subject,
    detail: status.error ?? null,
  });
  logger.info(
    { recipients, startedAt: status.startedAt },
    "[bot-cleanup-alert] failure alert sent",
  );
  return { sent: true, recipients };
}

export async function checkAndAlertIfStale(
  now: Date = new Date(),
): Promise<BotCleanupAlertResult> {
  let lastSuccessAt: Date | null = null;
  try {
    const rows = await db
      .select({ finishedAt: botCleanupRunsTable.finishedAt })
      .from(botCleanupRunsTable)
      .where(eq(botCleanupRunsTable.ok, true))
      .orderBy(desc(botCleanupRunsTable.finishedAt))
      .limit(1);
    lastSuccessAt = rows[0]?.finishedAt ?? null;
  } catch (err) {
    logger.error(
      { err },
      "[bot-cleanup-alert] failed to read cleanup history",
    );
    return { sent: false, reason: "history-read-failed" };
  }

  // Avoid alerting on a fresh deploy where no run has ever happened — the
  // scheduler waits 5 min after boot before the first run, and we don't want
  // a spurious "stale" alert before that has had a chance to complete.
  if (!lastSuccessAt) return { sent: false, reason: "no-history-yet" };

  const ageMs = now.getTime() - lastSuccessAt.getTime();
  if (ageMs < STALE_THRESHOLD_MS) {
    return { sent: false, reason: "not-stale" };
  }

  const state = await readState();
  const lastSuccessIso = lastSuccessAt.toISOString();
  // Throttle: one alert per stale period. A new alert is only allowed after a
  // newer successful run shows up.
  if (state.lastStaleSuccessAt === lastSuccessIso) {
    return { sent: false, reason: "already-alerted-for-this-gap" };
  }

  if (!(await isEmailConfigured())) {
    logger.warn(
      "[bot-cleanup-alert] email not configured; skipping stale alert",
    );
    return { sent: false, reason: "email-not-configured" };
  }

  const recipients = await fetchRecipients();
  if (recipients.length === 0) {
    return { sent: false, reason: "no-recipients" };
  }

  const hoursSince = ageMs / (60 * 60 * 1000);
  const dashboardUrl = adminDashboardUrl();
  const html = buildStaleHtml(lastSuccessIso, hoursSince, dashboardUrl);
  const subject = `⚠️ Limpeza noturna sem sucesso há ${hoursSince.toFixed(1)}h`;

  try {
    await sendEmail({ to: recipients, subject, html });
  } catch (err) {
    logger.error(
      { err },
      "[bot-cleanup-alert] failed to send stale alert email",
    );
    return { sent: false, reason: "send-failed" };
  }

  const sentAt = now.toISOString();
  await writeState({
    ...state,
    lastStaleAlertedAt: sentAt,
    lastStaleSuccessAt: lastSuccessIso,
  });
  await appendAlertHistory({
    kind: "stale",
    sentAt,
    recipients,
    subject,
    detail: `Última execução bem-sucedida: ${fmtDateTimeBR(lastSuccessIso)} (${hoursSince.toFixed(1)}h atrás)`,
  });
  logger.info(
    { recipients, lastSuccessAt: lastSuccessIso, hoursSince },
    "[bot-cleanup-alert] stale alert sent",
  );
  return { sent: true, recipients };
}

function buildTestHtml(dashboardUrl: string): string {
  const link = escapeHtml(dashboardUrl);
  const when = escapeHtml(fmtDateTimeBR(new Date().toISOString()));
  return `<!doctype html>
<html lang="pt-BR">
<body style="font-family: Arial, sans-serif; color:#0D0D0D; max-width:640px; margin:0 auto; padding:24px;">
  <h2 style="margin:0 0 8px; color:#0A6B41;">✅ Alerta de teste — Limpeza noturna</h2>
  <p style="margin:0 0 12px;">
    Este é um e-mail de teste enviado a partir do painel admin para verificar
    a configuração de SMTP e a lista de destinatários de alertas do sistema.
  </p>
  <ul style="margin:0 0 16px; padding-left:20px;">
    <li>Disparado em: <strong>${when}</strong></li>
  </ul>
  <p style="margin:16px 0 0;">
    Painel: <a href="${link}" style="color:#0A55C2;">${link}</a>
  </p>
</body>
</html>`;
}

export type BotCleanupTestAlertResult =
  | { sent: false; reason: string }
  | { sent: true; recipients: string[]; sentAt: string; subject: string };

export async function sendBotCleanupTestAlert(): Promise<BotCleanupTestAlertResult> {
  if (!(await isEmailConfigured())) {
    return { sent: false, reason: "email-not-configured" };
  }
  const recipients = await fetchRecipients();
  if (recipients.length === 0) {
    return { sent: false, reason: "no-recipients" };
  }
  const dashboardUrl = adminDashboardUrl();
  const html = buildTestHtml(dashboardUrl);
  const subject = `✅ Teste de alerta — Limpeza noturna (${fmtDateTimeBR(new Date().toISOString())})`;
  try {
    await sendEmail({ to: recipients, subject, html });
  } catch (err) {
    logger.error({ err }, "[bot-cleanup-alert] failed to send test alert email");
    return { sent: false, reason: "send-failed" };
  }
  const sentAt = new Date().toISOString();
  await appendAlertHistory({
    kind: "test",
    sentAt,
    recipients,
    subject,
    detail: "Disparado manualmente do painel admin.",
  });
  logger.info({ recipients }, "[bot-cleanup-alert] test alert sent");
  return { sent: true, recipients, sentAt, subject };
}
