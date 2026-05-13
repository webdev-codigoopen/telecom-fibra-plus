import nodemailer, { type Transporter } from "nodemailer";
import { db, appSettingsTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { logger } from "./logger";

export type EmailAttachment = {
  filename: string;
  content: string | Buffer;
  contentType?: string;
};

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
};

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
};

const SMTP_KEYS = [
  "smtp_host",
  "smtp_port",
  "smtp_secure",
  "smtp_user",
  "smtp_password",
  "smtp_from_email",
  "smtp_from_name",
] as const;

let cachedTransport: Transporter | null = null;
let cachedFrom: string | null = null;
let cacheKey = "";

// ---------------------------------------------------------------------------
// Loads SMTP settings from the database (the admin panel writes them there).
// Falls back to environment variables for backward compatibility with the
// legacy single-tenant setup.
// ---------------------------------------------------------------------------
async function loadConfig(): Promise<SmtpConfig | null> {
  let host = "";
  let portRaw = "";
  let secureRaw = "auto";
  let user = "";
  let pass = "";
  let fromEmail = "";
  let fromName = "";
  try {
    const rows = await db
      .select({ key: appSettingsTable.key, value: appSettingsTable.value })
      .from(appSettingsTable)
      .where(inArray(appSettingsTable.key, SMTP_KEYS as unknown as string[]));
    const map = new Map(rows.map((r) => [r.key, r.value]));
    host = (map.get("smtp_host") ?? "").trim();
    portRaw = (map.get("smtp_port") ?? "").trim();
    secureRaw = (map.get("smtp_secure") ?? "auto").trim();
    user = (map.get("smtp_user") ?? "").trim();
    pass = map.get("smtp_password") ?? "";
    fromEmail = (map.get("smtp_from_email") ?? "").trim();
    fromName = (map.get("smtp_from_name") ?? "").trim();
  } catch (err) {
    logger.warn({ err }, "smtp: could not read settings from db, falling back to env");
  }

  // Env-var fallback (legacy)
  host = host || process.env["SMTP_HOST"] || "";
  portRaw = portRaw || process.env["SMTP_PORT"] || "";
  user = user || process.env["SMTP_USER"] || "";
  pass = pass || process.env["SMTP_PASS"] || "";
  fromEmail = fromEmail || process.env["SMTP_FROM"] || user;

  if (!host || !portRaw || !user || !pass || !fromEmail) return null;
  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0 || port > 65535) return null;

  let secure: boolean;
  if (secureRaw === "true") secure = true;
  else if (secureRaw === "false") secure = false;
  else secure = port === 465;

  return { host, port, secure, user, pass, fromEmail, fromName };
}

function configKey(c: SmtpConfig): string {
  return `${c.host}|${c.port}|${c.secure}|${c.user}|${c.pass.length}|${c.fromEmail}|${c.fromName}`;
}

function buildTransport(c: SmtpConfig): { transport: Transporter; from: string } {
  const transport = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: { user: c.user, pass: c.pass },
  });
  const from = c.fromName ? `"${c.fromName.replace(/"/g, "")}" <${c.fromEmail}>` : c.fromEmail;
  return { transport, from };
}

export async function isEmailConfigured(): Promise<boolean> {
  return (await loadConfig()) !== null;
}

export function invalidateEmailCache(): void {
  cachedTransport = null;
  cachedFrom = null;
  cacheKey = "";
}

async function getTransport(): Promise<{ transport: Transporter; from: string }> {
  const cfg = await loadConfig();
  if (!cfg) {
    throw new Error(
      "Servidor de e-mail não configurado. Preencha SMTP no painel (aba Relatórios por email).",
    );
  }
  const key = configKey(cfg);
  if (!cachedTransport || key !== cacheKey) {
    const built = buildTransport(cfg);
    cachedTransport = built.transport;
    cachedFrom = built.from;
    cacheKey = key;
  }
  return { transport: cachedTransport, from: cachedFrom! };
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const { transport, from } = await getTransport();
  const recipients = Array.isArray(input.to) ? input.to : [input.to];
  await transport.sendMail({
    from,
    to: recipients.join(", "),
    subject: input.subject,
    html: input.html,
    text: input.text,
    attachments: input.attachments,
  });
  logger.info({ to: recipients, subject: input.subject }, "Email sent");
}

export async function verifySmtp(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { transport } = await getTransport();
    await transport.verify();
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
