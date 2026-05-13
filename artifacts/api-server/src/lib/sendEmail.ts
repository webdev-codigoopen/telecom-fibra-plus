import nodemailer, { type Transporter } from "nodemailer";
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

let cachedTransport: Transporter | null = null;
let cachedFrom: string | null = null;

function buildTransport(): { transport: Transporter; from: string } | null {
  const host = process.env["SMTP_HOST"];
  const portRaw = process.env["SMTP_PORT"];
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];
  const from = process.env["SMTP_FROM"] ?? user ?? null;

  if (!host || !portRaw || !user || !pass || !from) {
    return null;
  }
  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0) {
    return null;
  }
  const secure =
    (process.env["SMTP_SECURE"] ?? "").toLowerCase() === "true" || port === 465;

  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  return { transport, from };
}

export function isEmailConfigured(): boolean {
  return buildTransport() !== null;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  if (!cachedTransport) {
    const built = buildTransport();
    if (!built) {
      throw new Error(
        "Email transport not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.",
      );
    }
    cachedTransport = built.transport;
    cachedFrom = built.from;
  }

  const recipients = Array.isArray(input.to) ? input.to : [input.to];
  await cachedTransport.sendMail({
    from: cachedFrom!,
    to: recipients.join(", "),
    subject: input.subject,
    html: input.html,
    text: input.text,
    attachments: input.attachments,
  });
  logger.info(
    { to: recipients, subject: input.subject },
    "Email sent",
  );
}
