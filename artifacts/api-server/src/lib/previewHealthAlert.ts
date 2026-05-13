import {
  db,
  appSettingsTable,
  emailReportSubscriptionsTable,
  planClicksTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { logger } from "./logger";
import { isEmailConfigured, sendEmail } from "./sendEmail";

export const PREVIEW_HEALTH_ALERT_STATE_KEY = "preview_health_alert_state";

type AlertState = {
  lastAlertSentAt: string | null;
  lastAlertedBotFetchAt: string | null;
};

type HealthCounts = {
  humanPreviews24h: number;
  botPreviews24h: number;
  lastBotFetchAt: string | null;
  lastHumanPreviewAt: string | null;
};

async function readState(): Promise<AlertState> {
  try {
    const rows = await db
      .select()
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, PREVIEW_HEALTH_ALERT_STATE_KEY))
      .limit(1);
    const row = rows[0];
    if (!row) return { lastAlertSentAt: null, lastAlertedBotFetchAt: null };
    const parsed = JSON.parse(row.value) as Partial<AlertState>;
    return {
      lastAlertSentAt: parsed.lastAlertSentAt ?? null,
      lastAlertedBotFetchAt: parsed.lastAlertedBotFetchAt ?? null,
    };
  } catch {
    return { lastAlertSentAt: null, lastAlertedBotFetchAt: null };
  }
}

async function writeState(state: AlertState): Promise<void> {
  const value = JSON.stringify(state);
  const now = new Date();
  await db
    .insert(appSettingsTable)
    .values({ key: PREVIEW_HEALTH_ALERT_STATE_KEY, value, updatedAt: now })
    .onConflictDoUpdate({
      target: appSettingsTable.key,
      set: { value, updatedAt: now },
    });
}

async function fetchHealthCounts(now: Date): Promise<HealthCounts> {
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const isHumanPreview = sql`(${planClicksTable.source} = 'whatsapp-share' or ${planClicksTable.source} like 'whatsapp-share:%')`;
  const isBotPreview = sql`${planClicksTable.source} like 'whatsapp-share-bot%'`;
  const [counts] = await db
    .select({
      humanPreviews24h: sql<number>`cast(count(*) filter (where ${isHumanPreview} and ${planClicksTable.clickedAt} >= ${since24h}) as int)`,
      botPreviews24h: sql<number>`cast(count(*) filter (where ${isBotPreview} and ${planClicksTable.clickedAt} >= ${since24h}) as int)`,
      lastHumanPreviewAt: sql<string | null>`max(${planClicksTable.clickedAt}) filter (where ${isHumanPreview})`,
      lastBotFetchAt: sql<string | null>`max(${planClicksTable.clickedAt}) filter (where ${isBotPreview})`,
    })
    .from(planClicksTable);
  return {
    humanPreviews24h: counts?.humanPreviews24h ?? 0,
    botPreviews24h: counts?.botPreviews24h ?? 0,
    lastBotFetchAt: counts?.lastBotFetchAt ?? null,
    lastHumanPreviewAt: counts?.lastHumanPreviewAt ?? null,
  };
}

async function fetchSubscriberEmails(): Promise<string[]> {
  const rows = await db
    .select({ email: emailReportSubscriptionsTable.email })
    .from(emailReportSubscriptionsTable)
    .where(
      and(
        eq(emailReportSubscriptionsTable.enabled, true),
        eq(emailReportSubscriptionsTable.reportType, "city_comparison"),
      ),
    );
  const seen = new Set<string>();
  for (const r of rows) {
    const e = r.email.trim().toLowerCase();
    if (e) seen.add(e);
  }
  return [...seen];
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
  logger.warn(
    "ADMIN_DASHBOARD_URL / PUBLIC_BASE_URL / REPLIT_DEV_DOMAIN not set; preview-health alert email will use a relative '/admin' link that may not be clickable in some email clients.",
  );
  return "/admin";
}

function buildHtml(counts: HealthCounts, dashboardUrl: string): string {
  const lastBot = fmtDateTimeBR(counts.lastBotFetchAt);
  const lastHuman = fmtDateTimeBR(counts.lastHumanPreviewAt);
  const linkAttr = escapeHtml(dashboardUrl);
  const linkText = escapeHtml(dashboardUrl);
  return `<!doctype html>
<html lang="pt-BR">
<body style="font-family: Arial, sans-serif; color:#0D0D0D; max-width:640px; margin:0 auto; padding:24px;">
  <h2 style="margin:0 0 8px; color:#A11A1A;">⚠️ Pré-visualização do WhatsApp pode estar quebrada</h2>
  <p style="margin:0 0 12px;">
    Nas últimas 24 horas, <strong>${counts.humanPreviews24h}</strong> pessoa(s) abriram páginas
    de compartilhamento, mas <strong>nenhum crawler</strong> do WhatsApp/Facebook buscou a
    página para gerar a pré-visualização. Isso geralmente significa que os links no WhatsApp
    estão sendo enviados sem imagem/título.
  </p>
  <ul style="margin:0 0 16px; padding-left:20px;">
    <li>Último acesso humano à página de share: <strong>${escapeHtml(lastHuman)}</strong></li>
    <li>Última busca por crawler (WhatsApp/Facebook): <strong>${escapeHtml(lastBot)}</strong></li>
  </ul>
  <p style="margin:0 0 16px;">
    Abra o painel para ver detalhes e diagnosticar:
    <br/>
    <a href="${linkAttr}" style="color:#0A55C2;">${linkText}</a>
  </p>
  <p style="color:#7A7F8C; font-size:12px; margin-top:24px;">
    Você está recebendo este alerta porque tem uma assinatura de relatórios ativa.
    Apenas um e-mail é enviado por incidente — você só receberá outro depois que os
    crawlers voltarem a buscar a página e o problema acontecer novamente.
  </p>
</body>
</html>`;
}

export type PreviewHealthAlertResult =
  | { sent: false; reason: string }
  | { sent: true; recipients: string[]; lastBotFetchAt: string | null };

export async function checkAndSendPreviewHealthAlert(
  now: Date = new Date(),
): Promise<PreviewHealthAlertResult> {
  const counts = await fetchHealthCounts(now);

  // Alert condition mirrors the dashboard banner.
  if (counts.humanPreviews24h <= 0 || counts.botPreviews24h > 0) {
    return { sent: false, reason: "condition-not-met" };
  }

  const state = await readState();
  // Throttle: one alert per "gap". A gap is identified by the most recent
  // bot-fetch timestamp (or the sentinel "none" when no bot fetch ever
  // happened). Once that value changes (a new crawler hit, then a new
  // outage), the next alert can be sent.
  const currentBotKey = counts.lastBotFetchAt ?? "none";
  if (state.lastAlertedBotFetchAt === currentBotKey) {
    return { sent: false, reason: "already-alerted-for-this-gap" };
  }

  if (!(await isEmailConfigured())) {
    logger.warn("Email not configured; skipping preview-health alert.");
    return { sent: false, reason: "email-not-configured" };
  }

  const recipients = await fetchSubscriberEmails();
  if (recipients.length === 0) {
    return { sent: false, reason: "no-subscribers" };
  }

  const dashboardUrl = adminDashboardUrl();
  const html = buildHtml(counts, dashboardUrl);
  const subject =
    "⚠️ Pré-visualização do WhatsApp não está sendo gerada (últimas 24h)";

  try {
    await sendEmail({ to: recipients, subject, html });
  } catch (err) {
    logger.error({ err }, "Failed to send preview-health alert email");
    return { sent: false, reason: "send-failed" };
  }

  await writeState({
    lastAlertSentAt: now.toISOString(),
    lastAlertedBotFetchAt: currentBotKey,
  });

  logger.info(
    { recipients, lastBotFetchAt: counts.lastBotFetchAt },
    "Preview-health alert sent",
  );
  return { sent: true, recipients, lastBotFetchAt: counts.lastBotFetchAt };
}
