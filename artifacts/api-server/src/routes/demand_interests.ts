import { Router, type IRouter, type Request } from "express";
import { createHash } from "crypto";
import { db, demandInterestsTable, planClicksTable } from "@workspace/db";

const router: IRouter = Router();

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

export default router;
