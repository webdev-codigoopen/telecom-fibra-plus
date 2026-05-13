import { db, demandInterestsTable, emailReportSubscriptionsTable } from "@workspace/db";
import { and, asc, eq, gt } from "drizzle-orm";
import { isEmailConfigured, sendEmail } from "./sendEmail";
import { logger } from "./logger";

export type DigestFrequency = "daily" | "weekly";

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

  for (const sub of digestSubs) {
    try {
      const frequency = sub.frequency as DigestFrequency;
      const lastSentAt = sub.lastSentAt ?? null;
      if (!isDueDigest(frequency, lastSentAt, now)) continue;

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
