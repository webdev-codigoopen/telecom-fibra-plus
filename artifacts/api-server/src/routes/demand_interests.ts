import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { createHash } from "crypto";
import { db, demandInterestsTable, planClicksTable } from "@workspace/db";
import { and, desc, eq, gte, lt, sql, type SQL } from "drizzle-orm";

const router: IRouter = Router();

function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env["ADMIN_SECRET"];
  if (!secret) {
    res.status(503).json({ error: "Admin access not configured" });
    return;
  }
  const key = req.headers["x-admin-key"];
  if (key !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_PER_WINDOW = 3;
const RATE_MIN_INTERVAL_MS = 15 * 1000;
const MAX_CITY_LEN = 80;
const MAX_NEIGHBORHOOD_LEN = 120;
const MAX_WHATSAPP_LEN = 20;

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
  } catch {
    res.status(500).json({ error: "Não foi possível registrar seu interesse. Tente novamente." });
  }
});

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

router.get("/demand/interests", requireAdminKey, async (req, res) => {
  try {
    const sinceDate = parseDate(req.query["since"]);
    const untilDate = parseDate(req.query["until"]);
    const cityParam = typeof req.query["city"] === "string" && req.query["city"].length > 0
      ? req.query["city"].slice(0, MAX_CITY_LEN)
      : undefined;
    const limitParam = typeof req.query["limit"] === "string" ? parseInt(req.query["limit"], 10) : NaN;
    const limit = Number.isFinite(limitParam) && limitParam > 0 && limitParam <= 1000 ? limitParam : 500;

    const conditions: SQL[] = [];
    if (sinceDate) conditions.push(gte(demandInterestsTable.createdAt, sinceDate));
    if (untilDate) conditions.push(lt(demandInterestsTable.createdAt, untilDate));
    if (cityParam) conditions.push(eq(demandInterestsTable.city, cityParam));

    const baseSelect = db
      .select({
        id: demandInterestsTable.id,
        city: demandInterestsTable.city,
        neighborhood: demandInterestsTable.neighborhood,
        whatsapp: demandInterestsTable.whatsapp,
        createdAt: demandInterestsTable.createdAt,
      })
      .from(demandInterestsTable);

    const filtered = conditions.length > 0
      ? baseSelect.where(conditions.length === 1 ? conditions[0]! : and(...conditions))
      : baseSelect;

    const rows = await filtered
      .orderBy(desc(demandInterestsTable.createdAt))
      .limit(limit);

    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch interests" });
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

    const baseSelect = db
      .select({
        createdAt: demandInterestsTable.createdAt,
        city: demandInterestsTable.city,
        neighborhood: demandInterestsTable.neighborhood,
        whatsapp: demandInterestsTable.whatsapp,
      })
      .from(demandInterestsTable);

    const filtered = conditions.length > 0
      ? baseSelect.where(conditions.length === 1 ? conditions[0]! : and(...conditions))
      : baseSelect;

    const rows = await filtered.orderBy(desc(demandInterestsTable.createdAt));

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

    const header = "created_at,city,neighborhood,whatsapp";
    const body = rows
      .map((r) => [escape(r.createdAt), escape(r.city), escape(r.neighborhood), escape(r.whatsapp)].join(","))
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

export default router;
