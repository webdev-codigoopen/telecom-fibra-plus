import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { createHash } from "crypto";
import { db, demandInterestsTable, planClicksTable, appSettingsTable, emailReportSubscriptionsTable } from "@workspace/db";
import { and, desc, eq, gte, inArray, lt, sql, type SQL } from "drizzle-orm";
import { isEmailConfigured, sendEmail } from "../lib/sendEmail";
import {
  buildDigestEmail,
  fetchInterestsSince,
  sendInterestDigestToSubscription,
  sendInterestDigestPreviewToSubscription,
} from "../lib/interestDigest";
import {
  loadWhatsappNotifyState,
  loadWhatsappQuietHoursSettings,
  sendWhatsappNotification,
} from "../lib/sendWhatsapp";
import {
  shouldNotifyNow,
  recipientQuietHours,
  isInRecipientQuietHours,
  loadQuietHoursSettings,
  isInQuietHours,
  type RecipientQuietHours,
} from "../lib/quietHours";
import { logger } from "../lib/logger";
import { requireAdmin as requireAdminKey } from "../lib/auth";

const router: IRouter = Router();


const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_PER_WINDOW = 3;
const RATE_MIN_INTERVAL_MS = 15 * 1000;
const MAX_CITY_LEN = 80;
const MAX_NEIGHBORHOOD_LEN = 120;
const MAX_WHATSAPP_LEN = 20;
const MAX_NOTE_LEN = 500;

const VALID_STATUSES = ["novo", "contatado", "convertido", "sem_retorno"] as const;
type InterestStatus = (typeof VALID_STATUSES)[number];
function isValidStatus(v: unknown): v is InterestStatus {
  return typeof v === "string" && (VALID_STATUSES as readonly string[]).includes(v);
}

type Bucket = { times: number[]; lastAt: number };
const ipBuckets = new Map<string, Bucket>();

function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) {
    return fwd.split(",")[0]!.trim();
  }
  if (Array.isArray(fwd) && fwd.length > 0) {
    return fwd[0]!.split(",")[0]!.trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

function hashIp(ip: string): string {
  const salt = process.env["INTEREST_IP_SALT"] ?? "provider-mais-fibra";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

function checkRate(ip: string): { ok: true } | { ok: false; reason: string; retryAfterSec: number } {
  const now = Date.now();
  const bucket = ipBuckets.get(ip) ?? { times: [], lastAt: 0 };
  bucket.times = bucket.times.filter((t) => now - t < RATE_WINDOW_MS);
  if (bucket.lastAt && now - bucket.lastAt < RATE_MIN_INTERVAL_MS) {
    const retry = Math.ceil((RATE_MIN_INTERVAL_MS - (now - bucket.lastAt)) / 1000);
    return { ok: false, reason: "Aguarde alguns segundos antes de enviar novamente.", retryAfterSec: retry };
  }
  if (bucket.times.length >= RATE_MAX_PER_WINDOW) {
    const oldest = bucket.times[0]!;
    const retry = Math.ceil((RATE_WINDOW_MS - (now - oldest)) / 1000);
    return { ok: false, reason: "Muitos cadastros recentes deste dispositivo. Tente novamente mais tarde.", retryAfterSec: retry };
  }
  bucket.times.push(now);
  bucket.lastAt = now;
  ipBuckets.set(ip, bucket);
  return { ok: true };
}

function normalizeWhatsapp(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) return null;
  return digits;
}

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

router.post("/demand/interest", async (req, res) => {
  const body = req.body ?? {};

  // Honeypot — bots tend to fill every field. Real users see this hidden.
  if (typeof body.website === "string" && body.website.trim().length > 0) {
    res.status(201).json({ ok: true });
    return;
  }

  const city = cleanText(body.city, MAX_CITY_LEN);
  const neighborhood = cleanText(body.neighborhood, MAX_NEIGHBORHOOD_LEN);
  const whatsappRaw = cleanText(body.whatsapp, MAX_WHATSAPP_LEN * 2);
  const whatsapp = normalizeWhatsapp(whatsappRaw);

  if (!city || city.length < 2) {
    res.status(400).json({ error: "Informe a cidade." });
    return;
  }
  if (!neighborhood || neighborhood.length < 2) {
    res.status(400).json({ error: "Informe o bairro ou rua." });
    return;
  }
  if (!whatsapp) {
    res.status(400).json({ error: "Informe um WhatsApp válido com DDD." });
    return;
  }

  const ip = clientIp(req);
  const rate = checkRate(ip);
  if (!rate.ok) {
    res.setHeader("Retry-After", String(rate.retryAfterSec));
    res.status(429).json({ error: rate.reason });
    return;
  }

  const ipHash = hashIp(ip);
  const userAgent = typeof req.headers["user-agent"] === "string"
    ? req.headers["user-agent"].slice(0, 300)
    : null;

  try {
    await db.insert(demandInterestsTable).values({
      city,
      neighborhood,
      whatsapp,
      ipHash,
      userAgent,
    });
    // Also record as a city click so it shows up on the public demand map immediately.
    await db.insert(planClicksTable).values({
      planSpeed: "city",
      planPrice: city,
      source: "interest",
      city,
    });
    res.status(201).json({ ok: true });
    // Fire-and-forget admin notifications (email + WhatsApp) — never blocks or fails the request.
    const createdAt = new Date();
    void notifyAdminOfNewInterest({ city, neighborhood, whatsapp, createdAt });
    void notifyAdminOfNewInterestViaWhatsapp({ city, neighborhood, whatsapp, createdAt });
  } catch {
    res.status(500).json({ error: "Não foi possível registrar seu interesse. Tente novamente." });
  }
});

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

async function notifyAdminOfNewInterest(payload: {
  city: string;
  neighborhood: string;
  whatsapp: string;
  createdAt: Date;
}): Promise<void> {
  try {
    const globalAllowed = await shouldNotifyNow(payload.createdAt);

    // Collect all enabled "instant" recipients from the subscriptions table.
    const subs = await db
      .select({
        email: emailReportSubscriptionsTable.email,
        quietHoursEnabled: emailReportSubscriptionsTable.quietHoursEnabled,
        quietHoursStart: emailReportSubscriptionsTable.quietHoursStart,
        quietHoursEnd: emailReportSubscriptionsTable.quietHoursEnd,
        quietHoursWeekends: emailReportSubscriptionsTable.quietHoursWeekends,
        quietHoursMode: emailReportSubscriptionsTable.quietHoursMode,
      })
      .from(emailReportSubscriptionsTable)
      .where(
        and(
          eq(emailReportSubscriptionsTable.reportType, "interest_notification"),
          eq(emailReportSubscriptionsTable.frequency, "instant"),
          eq(emailReportSubscriptionsTable.enabled, true),
        ),
      );

    // Backward-compat: if the legacy single-email setting is still enabled and
    // set to "instant", include it too. This keeps things working until the
    // admin opens the new UI (which migrates the legacy setting away).
    const settingRows = await db
      .select({ key: appSettingsTable.key, value: appSettingsTable.value })
      .from(appSettingsTable)
      .where(
        inArray(appSettingsTable.key, [
          "interest_notification_enabled",
          "interest_notification_email",
          "interest_notification_frequency",
        ]),
      );
    const settingsMap = new Map(settingRows.map((r) => [r.key, r.value]));
    const legacyEnabled =
      (settingsMap.get("interest_notification_enabled") ?? "false") === "true";
    const legacyEmail = (settingsMap.get("interest_notification_email") ?? "").trim();
    const legacyFreq = (settingsMap.get("interest_notification_frequency") ?? "instant").trim();

    // Filter recipients per-quiet-hours. A recipient with their own quiet
    // hours always uses their own window (overrides the global setting). A
    // recipient without per-recipient quiet hours falls back to the global
    // setting — when global quiet hours are active, they are skipped (and the
    // global digest, if enabled, will surface the lead later).
    type Out = { email: string; r: RecipientQuietHours };
    const dedup = new Map<string, Out>();
    for (const s of subs) {
      const r = recipientQuietHours(s);
      if (r.enabled) {
        if (isInRecipientQuietHours(payload.createdAt, r)) {
          if (r.mode === "skip") {
            logger.info(
              { to: s.email, city: payload.city },
              "Interest email skipped by recipient quiet hours",
            );
          } else {
            logger.info(
              { to: s.email, city: payload.city },
              "Interest email queued by recipient quiet hours; will be sent in digest",
            );
          }
          continue;
        }
      } else if (!globalAllowed) {
        logger.info(
          { to: s.email, city: payload.city },
          "Interest email suppressed by global quiet hours",
        );
        continue;
      }
      dedup.set(s.email.trim().toLowerCase(), {
        email: s.email.trim().toLowerCase(),
        r,
      });
    }
    if (legacyEnabled && legacyEmail && legacyFreq === "instant" && globalAllowed) {
      const key = legacyEmail.toLowerCase();
      if (!dedup.has(key)) {
        dedup.set(key, {
          email: key,
          r: {
            enabled: false,
            start: "22:00",
            end: "08:00",
            muteWeekends: false,
            mode: "queue",
          },
        });
      }
    }
    const recipients = Array.from(dedup.values()).map((o) => o.email);
    if (recipients.length === 0) return;

    if (!(await isEmailConfigured())) {
      logger.warn(
        { count: recipients.length },
        "Interest notification skipped: SMTP not configured",
      );
      return;
    }
    const link = whatsappLink(payload.whatsapp);
    const display = formatWhatsappDisplay(payload.whatsapp);
    const timestampDisplay = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(payload.createdAt);
    const subject = `Novo interesse em ${payload.city} — ${payload.neighborhood}`;
    const html = `
<!doctype html>
<html lang="pt-BR"><body style="font-family:Arial,sans-serif;color:#0D0D0D;background:#F5F7FA;padding:20px">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #E0E3EB;border-radius:12px;padding:24px">
<h2 style="margin:0 0 8px;font-size:18px">Novo interesse no mapa de demanda</h2>
<p style="margin:0 0 16px;color:#7A7F8C;font-size:13px">Alguém pediu fibra na rua dele agora.</p>
<table style="width:100%;border-collapse:collapse;font-size:14px">
<tr><td style="padding:6px 0;color:#7A7F8C;width:120px">Cidade</td><td style="padding:6px 0;font-weight:600">${escapeHtml(payload.city)}</td></tr>
<tr><td style="padding:6px 0;color:#7A7F8C">Bairro/Rua</td><td style="padding:6px 0">${escapeHtml(payload.neighborhood)}</td></tr>
<tr><td style="padding:6px 0;color:#7A7F8C">WhatsApp</td><td style="padding:6px 0;font-family:monospace">${escapeHtml(display)}</td></tr>
<tr><td style="padding:6px 0;color:#7A7F8C">Recebido em</td><td style="padding:6px 0">${escapeHtml(timestampDisplay)}</td></tr>
</table>
<p style="margin:20px 0 0">
  <a href="${link}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:8px">
    Abrir conversa no WhatsApp
  </a>
</p>
<p style="margin:14px 0 0;color:#7A7F8C;font-size:12px">${escapeHtml(link)}</p>
</div>
</body></html>`.trim();
    const text = [
      "Novo interesse no mapa de demanda",
      `Cidade: ${payload.city}`,
      `Bairro/Rua: ${payload.neighborhood}`,
      `WhatsApp: ${display}`,
      `Recebido em: ${timestampDisplay}`,
      `Link: ${link}`,
    ].join("\n");
    await Promise.all(
      Array.from(recipients).map((to) =>
        sendEmail({ to, subject, html, text }).catch((err) => {
          logger.error({ err, to }, "Failed to send interest notification email to recipient");
        }),
      ),
    );
  } catch (err) {
    logger.error({ err }, "Failed to send interest notification email");
  }
}

async function notifyAdminOfNewInterestViaWhatsapp(payload: {
  city: string;
  neighborhood: string;
  whatsapp: string;
  createdAt: Date;
}): Promise<void> {
  try {
    const { enabled, credentials } = await loadWhatsappNotifyState();
    if (!enabled || !credentials) return;
    // Per-recipient cadence: sendWhatsappNotification fans out only to
    // destinations whose own frequency is "instant"; daily/weekly recipients
    // are picked up later by the digest loop.
    const waQuiet = await loadWhatsappQuietHoursSettings();
    if (waQuiet.enabled && !(await shouldNotifyNow(payload.createdAt))) {
      logger.info(
        { city: payload.city, digestEnabled: waQuiet.digestEnabled },
        waQuiet.digestEnabled
          ? "Interest WhatsApp notification queued for quiet-hours digest"
          : "Interest WhatsApp notification suppressed by quiet hours",
      );
      return;
    }
    const link = whatsappLink(payload.whatsapp);
    const display = formatWhatsappDisplay(payload.whatsapp);
    const timestampDisplay = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(payload.createdAt);
    const text = [
      "🔔 *Novo interesse no mapa de demanda*",
      "",
      `📍 *Cidade:* ${payload.city}`,
      `🏘️ *Bairro/Rua:* ${payload.neighborhood}`,
      `📱 *WhatsApp:* ${display}`,
      `🕒 *Recebido em:* ${timestampDisplay}`,
      "",
      `Abrir conversa: ${link}`,
    ].join("\n");
    const result = await sendWhatsappNotification(text);
    if (!result.ok) {
      // No instant recipients is an expected configuration when every
      // destination is on a daily/weekly cadence — those will be picked up
      // by the digest. Demote to info to avoid noisy error logs.
      const expected = result.error.includes("instantânea");
      if (expected) {
        logger.info(
          { reason: result.error, city: payload.city },
          "Interest WhatsApp notification deferred to digest (no instant recipients)",
        );
      } else {
        logger.error(
          { error: result.error },
          "Failed to send interest notification via WhatsApp",
        );
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to send interest notification via WhatsApp");
  }
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

router.get("/demand/interests/count", requireAdminKey, async (req, res) => {
  try {
    const sinceDate = parseDate(req.query["since"]);
    const untilDate = parseDate(req.query["until"]);
    const cityParam = typeof req.query["city"] === "string" && req.query["city"].length > 0
      ? req.query["city"].slice(0, MAX_CITY_LEN)
      : undefined;
    const mutedOnly = req.query["mutedOnly"] === "true" || req.query["mutedOnly"] === "1";
    const statusParam = typeof req.query["status"] === "string" && isValidStatus(req.query["status"])
      ? (req.query["status"] as InterestStatus)
      : undefined;

    const conditions: SQL[] = [];
    if (sinceDate) conditions.push(gte(demandInterestsTable.createdAt, sinceDate));
    if (untilDate) conditions.push(lt(demandInterestsTable.createdAt, untilDate));
    if (cityParam) conditions.push(eq(demandInterestsTable.city, cityParam));
    if (statusParam) conditions.push(eq(demandInterestsTable.status, statusParam));

    if (mutedOnly) {
      // We need the row timestamps to apply the quiet-hours predicate, since
      // `mutedByQuietHours` is computed at read-time from the global window.
      const baseSelect = db
        .select({ createdAt: demandInterestsTable.createdAt })
        .from(demandInterestsTable);
      const filtered = conditions.length > 0
        ? baseSelect.where(conditions.length === 1 ? conditions[0]! : and(...conditions))
        : baseSelect;
      const rows = await filtered;
      const quietSettings = await loadQuietHoursSettings();
      const total = rows.reduce(
        (acc, r) => (isInQuietHours(r.createdAt, quietSettings) ? acc + 1 : acc),
        0,
      );
      res.json({ total });
      return;
    }

    const baseSelect = db
      .select({ total: sql<number>`cast(count(*) as int)` })
      .from(demandInterestsTable);
    const filtered = conditions.length > 0
      ? baseSelect.where(conditions.length === 1 ? conditions[0]! : and(...conditions))
      : baseSelect;
    const rows = await filtered;
    res.json({ total: rows[0]?.total ?? 0 });
  } catch {
    res.status(500).json({ error: "Failed to count interests" });
  }
});

router.get("/demand/interests", requireAdminKey, async (req, res) => {
  try {
    const sinceDate = parseDate(req.query["since"]);
    const untilDate = parseDate(req.query["until"]);
    const cityParam = typeof req.query["city"] === "string" && req.query["city"].length > 0
      ? req.query["city"].slice(0, MAX_CITY_LEN)
      : undefined;
    const limitParam = typeof req.query["limit"] === "string" ? parseInt(req.query["limit"], 10) : NaN;
    const limit = Number.isFinite(limitParam) && limitParam > 0 && limitParam <= 1000 ? limitParam : 500;
    const mutedOnly = req.query["mutedOnly"] === "true" || req.query["mutedOnly"] === "1";

    const conditions: SQL[] = [];
    if (sinceDate) conditions.push(gte(demandInterestsTable.createdAt, sinceDate));
    if (untilDate) conditions.push(lt(demandInterestsTable.createdAt, untilDate));
    if (cityParam) conditions.push(eq(demandInterestsTable.city, cityParam));

    const statusParam = typeof req.query["status"] === "string" && isValidStatus(req.query["status"])
      ? (req.query["status"] as InterestStatus)
      : undefined;
    if (statusParam) conditions.push(eq(demandInterestsTable.status, statusParam));

    const baseSelect = db
      .select({
        id: demandInterestsTable.id,
        city: demandInterestsTable.city,
        neighborhood: demandInterestsTable.neighborhood,
        whatsapp: demandInterestsTable.whatsapp,
        status: demandInterestsTable.status,
        note: demandInterestsTable.note,
        createdAt: demandInterestsTable.createdAt,
        updatedAt: demandInterestsTable.updatedAt,
      })
      .from(demandInterestsTable);

    const filtered = conditions.length > 0
      ? baseSelect.where(conditions.length === 1 ? conditions[0]! : and(...conditions))
      : baseSelect;

    const rows = await filtered
      .orderBy(desc(demandInterestsTable.createdAt))
      .limit(mutedOnly ? Math.min(limit * 4, 1000) : limit);

    const quietSettings = await loadQuietHoursSettings();
    const enriched = rows.map((r) => ({
      ...r,
      mutedByQuietHours: isInQuietHours(r.createdAt, quietSettings),
    }));

    const out = mutedOnly
      ? enriched.filter((r) => r.mutedByQuietHours).slice(0, limit)
      : enriched;
    res.json(out);
  } catch {
    res.status(500).json({ error: "Failed to fetch interests" });
  }
});

router.patch("/demand/interests/:id", requireAdminKey, async (req, res) => {
  try {
    const rawId = req.params["id"];
    const idStr = Array.isArray(rawId) ? rawId[0] ?? "" : rawId ?? "";
    const idNum = parseInt(idStr, 10);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      res.status(400).json({ error: "ID inválido." });
      return;
    }
    const body = req.body ?? {};
    const updates: { status?: InterestStatus; note?: string | null; updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (body.status !== undefined) {
      if (!isValidStatus(body.status)) {
        res.status(400).json({ error: "Status inválido." });
        return;
      }
      updates.status = body.status;
    }
    if (body.note !== undefined) {
      if (body.note === null || (typeof body.note === "string" && body.note.trim() === "")) {
        updates.note = null;
      } else if (typeof body.note === "string") {
        updates.note = body.note.trim().slice(0, MAX_NOTE_LEN);
      } else {
        res.status(400).json({ error: "Nota inválida." });
        return;
      }
    }
    if (updates.status === undefined && updates.note === undefined) {
      res.status(400).json({ error: "Nada para atualizar." });
      return;
    }
    const result = await db
      .update(demandInterestsTable)
      .set(updates)
      .where(eq(demandInterestsTable.id, idNum))
      .returning({
        id: demandInterestsTable.id,
        status: demandInterestsTable.status,
        note: demandInterestsTable.note,
        updatedAt: demandInterestsTable.updatedAt,
      });
    if (result.length === 0) {
      res.status(404).json({ error: "Interesse não encontrado." });
      return;
    }
    res.json(result[0]);
  } catch {
    res.status(500).json({ error: "Failed to update interest" });
  }
});

router.get("/demand/interests/cities", requireAdminKey, async (_req, res) => {
  try {
    const rows = await db
      .select({
        city: demandInterestsTable.city,
        total: sql<number>`cast(count(*) as int)`,
      })
      .from(demandInterestsTable)
      .groupBy(demandInterestsTable.city)
      .orderBy(desc(sql`count(*)`));
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch interest cities" });
  }
});

router.get("/demand/interests/export", requireAdminKey, async (req, res) => {
  try {
    const sinceDate = parseDate(req.query["since"]);
    const untilDate = parseDate(req.query["until"]);
    const cityParam = typeof req.query["city"] === "string" && req.query["city"].length > 0
      ? req.query["city"].slice(0, MAX_CITY_LEN)
      : undefined;

    const conditions: SQL[] = [];
    if (sinceDate) conditions.push(gte(demandInterestsTable.createdAt, sinceDate));
    if (untilDate) conditions.push(lt(demandInterestsTable.createdAt, untilDate));
    if (cityParam) conditions.push(eq(demandInterestsTable.city, cityParam));
    const statusParam = typeof req.query["status"] === "string" && isValidStatus(req.query["status"])
      ? (req.query["status"] as InterestStatus)
      : undefined;
    if (statusParam) conditions.push(eq(demandInterestsTable.status, statusParam));

    const baseSelect = db
      .select({
        createdAt: demandInterestsTable.createdAt,
        city: demandInterestsTable.city,
        neighborhood: demandInterestsTable.neighborhood,
        whatsapp: demandInterestsTable.whatsapp,
        status: demandInterestsTable.status,
        note: demandInterestsTable.note,
      })
      .from(demandInterestsTable);

    const filtered = conditions.length > 0
      ? baseSelect.where(conditions.length === 1 ? conditions[0]! : and(...conditions))
      : baseSelect;

    const rows = await filtered.orderBy(desc(demandInterestsTable.createdAt));
    const quietSettings = await loadQuietHoursSettings();
    const mutedOnly = req.query["mutedOnly"] === "true" || req.query["mutedOnly"] === "1";
    const enrichedAll = rows.map((r) => ({
      ...r,
      mutedByQuietHours: isInQuietHours(r.createdAt, quietSettings),
    }));
    const enriched = mutedOnly
      ? enrichedAll.filter((r) => r.mutedByQuietHours)
      : enrichedAll;

    const escape = (val: string | Date | null | undefined): string => {
      let s = val == null ? "" : val instanceof Date ? val.toISOString() : String(val);
      if (s.length > 0 && /^[=+\-@\t\r]/.test(s)) {
        s = `'${s}`;
      }
      if (/[",\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const header = "created_at,city,neighborhood,whatsapp,status,note,muted_by_quiet_hours";
    const body = enriched
      .map((r) =>
        [
          escape(r.createdAt),
          escape(r.city),
          escape(r.neighborhood),
          escape(r.whatsapp),
          escape(r.status),
          escape(r.note),
          r.mutedByQuietHours ? "true" : "false",
        ].join(","),
      )
      .join("\n");
    const csv = `${header}\n${body}${body ? "\n" : ""}`;

    let filename: string;
    if (sinceDate && untilDate) {
      const fromStamp = sinceDate.toISOString().slice(0, 10);
      const toStamp = new Date(untilDate.getTime() - 1).toISOString().slice(0, 10);
      filename = `interesses-${fromStamp}_to_${toStamp}.csv`;
    } else {
      const stamp = new Date().toISOString().slice(0, 10);
      filename = `interesses-${stamp}.csv`;
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch {
    res.status(500).json({ error: "Failed to export interests" });
  }
});

router.post(
  "/demand/interests/digest/:id/send-now",
  requireAdminKey,
  async (req, res) => {
    const id = Number(req.params["id"]);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "ID inválido." });
      return;
    }
    if (!(await isEmailConfigured())) {
      res.status(503).json({
        error:
          "Servidor de e-mail (SMTP) não configurado. Preencha no painel, aba 'Relatórios por email'.",
      });
      return;
    }
    try {
      const [sub] = await db
        .select()
        .from(emailReportSubscriptionsTable)
        .where(
          and(
            eq(emailReportSubscriptionsTable.id, id),
            eq(emailReportSubscriptionsTable.reportType, "interest_notification"),
          ),
        );
      if (!sub) {
        res.status(404).json({ error: "Destinatário não encontrado." });
        return;
      }
      if (sub.frequency !== "daily" && sub.frequency !== "weekly") {
        res.status(400).json({
          error:
            "Esse destinatário está configurado como instantâneo. Mude para diário ou semanal para enviar um resumo.",
        });
        return;
      }
      const now = new Date();
      const { count } = await sendInterestDigestToSubscription(
        {
          id: sub.id,
          email: sub.email,
          frequency: sub.frequency,
          lastSentAt: sub.lastSentAt ?? null,
        },
        now,
      );
      res.json({ ok: true, count, lastSentAt: now.toISOString() });
    } catch (err) {
      logger.error({ err }, "Failed to send interest digest now");
      res.status(500).json({
        error:
          "Falha ao enviar resumo de teste. Verifique as credenciais SMTP e tente novamente.",
      });
    }
  },
);

router.post(
  "/demand/interests/digest/:id/send-preview",
  requireAdminKey,
  async (req, res) => {
    const id = Number(req.params["id"]);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "ID inválido." });
      return;
    }
    if (!(await isEmailConfigured())) {
      res.status(503).json({
        error:
          "Servidor de e-mail (SMTP) não configurado. Preencha no painel, aba 'Relatórios por email'.",
      });
      return;
    }
    try {
      const [sub] = await db
        .select()
        .from(emailReportSubscriptionsTable)
        .where(
          and(
            eq(emailReportSubscriptionsTable.id, id),
            eq(emailReportSubscriptionsTable.reportType, "interest_notification"),
          ),
        );
      if (!sub) {
        res.status(404).json({ error: "Destinatário não encontrado." });
        return;
      }
      if (sub.frequency !== "daily" && sub.frequency !== "weekly") {
        res.status(400).json({
          error:
            "Esse destinatário está configurado como instantâneo. Mude para diário ou semanal para enviar uma prévia.",
        });
        return;
      }
      const { count } = await sendInterestDigestPreviewToSubscription({
        id: sub.id,
        email: sub.email,
        frequency: sub.frequency,
        lastSentAt: sub.lastSentAt ?? null,
      });
      res.json({ ok: true, count });
    } catch (err) {
      logger.error({ err }, "Failed to send interest digest preview");
      res.status(500).json({
        error:
          "Falha ao enviar a prévia do resumo. Verifique as credenciais SMTP e tente novamente.",
      });
    }
  },
);

router.get(
  "/demand/interests/digest/:id/preview",
  requireAdminKey,
  async (req, res) => {
    const id = Number(req.params["id"]);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "ID inválido." });
      return;
    }
    try {
      const [sub] = await db
        .select()
        .from(emailReportSubscriptionsTable)
        .where(
          and(
            eq(emailReportSubscriptionsTable.id, id),
            eq(emailReportSubscriptionsTable.reportType, "interest_notification"),
          ),
        );
      if (!sub) {
        res.status(404).json({ error: "Destinatário não encontrado." });
        return;
      }
      if (sub.frequency !== "daily" && sub.frequency !== "weekly") {
        res.status(400).json({
          error:
            "Esse destinatário está configurado como instantâneo. Mude para diário ou semanal para pré-visualizar um resumo.",
        });
        return;
      }
      const now = new Date();
      const lastSentAt = sub.lastSentAt ?? null;
      const rows = await fetchInterestsSince(lastSentAt);
      const { html } = buildDigestEmail(sub.frequency, rows, lastSentAt, now);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.send(html);
    } catch (err) {
      logger.error({ err }, "Failed to build interest digest preview");
      res.status(500).json({ error: "Falha ao gerar pré-visualização do resumo." });
    }
  },
);

export default router;
