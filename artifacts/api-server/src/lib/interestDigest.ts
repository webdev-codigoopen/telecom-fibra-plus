import { db, demandInterestsTable, appSettingsTable } from "@workspace/db";
import { and, asc, gt, inArray, sql } from "drizzle-orm";
import { isEmailConfigured, sendEmail } from "./sendEmail";
import { logger } from "./logger";

export type DigestFrequency = "daily" | "weekly";

const SETTING_KEYS = [
  "interest_notification_enabled",
  "interest_notification_email",
  "interest_notification_frequency",
  "interest_digest_last_sent_at",
] as const;

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

function isDueDigest(
  frequency: DigestFrequency,
  lastSentAt: Date | null,
  now: Date,
): boolean {
  if (!lastSentAt) return true;
  const elapsed = now.getTime() - lastSentAt.getTime();
  if (frequency === "daily") return elapsed >= 24 * 60 * 60 * 1000;
  return elapsed >= 7 * 24 * 60 * 60 * 1000;
}

async function readSettings(): Promise<Map<string, string>> {
  const rows = await db
    .select({ key: appSettingsTable.key, value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(inArray(appSettingsTable.key, SETTING_KEYS as unknown as string[]));
  return new Map(rows.map((r) => [r.key, r.value]));
}

async function writeLastSentAt(now: Date): Promise<void> {
  await db
    .insert(appSettingsTable)
    .values({ key: "interest_digest_last_sent_at", value: now.toISOString() })
    .onConflictDoUpdate({
      target: appSettingsTable.key,
      set: { value: now.toISOString(), updatedAt: sql`now()` },
    });
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

export async function sendDueInterestDigest(now: Date = new Date()): Promise<void> {
  const settings = await readSettings();
  const enabled = (settings.get("interest_notification_enabled") ?? "false") === "true";
  const to = (settings.get("interest_notification_email") ?? "").trim();
  const frequency = (settings.get("interest_notification_frequency") ?? "instant").trim();
  if (!enabled || !to) return;
  if (frequency !== "daily" && frequency !== "weekly") return;

  const lastSentRaw = (settings.get("interest_digest_last_sent_at") ?? "").trim();
  const lastSentAt = lastSentRaw ? new Date(lastSentRaw) : null;
  const lastSentValid = lastSentAt && !Number.isNaN(lastSentAt.getTime()) ? lastSentAt : null;

  if (!isDueDigest(frequency as DigestFrequency, lastSentValid, now)) return;

  if (!(await isEmailConfigured())) {
    logger.warn(
      { to, frequency },
      "Interest digest skipped: SMTP not configured",
    );
    return;
  }

  // Fetch interests created after the last digest. If none, still mark as sent
  // so we don't re-check on every tick — but skip the email itself.
  const conditions = lastSentValid
    ? [gt(demandInterestsTable.createdAt, lastSentValid)]
    : [];
  const baseSelect = db
    .select({
      city: demandInterestsTable.city,
      neighborhood: demandInterestsTable.neighborhood,
      whatsapp: demandInterestsTable.whatsapp,
      createdAt: demandInterestsTable.createdAt,
    })
    .from(demandInterestsTable);
  const filtered = conditions.length > 0
    ? baseSelect.where(conditions.length === 1 ? conditions[0]! : and(...conditions))
    : baseSelect;
  const rows = await filtered.orderBy(asc(demandInterestsTable.createdAt));

  if (rows.length === 0) {
    await writeLastSentAt(now);
    return;
  }

  const { subject, html, text } = buildDigestEmail(
    frequency as DigestFrequency,
    rows,
    lastSentValid,
    now,
  );
  await sendEmail({ to, subject, html, text });
  await writeLastSentAt(now);
  logger.info(
    { to, frequency, count: rows.length },
    "Interest digest sent",
  );
}
