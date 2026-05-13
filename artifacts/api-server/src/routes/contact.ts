import { Router, type IRouter, type Request } from "express";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { logger } from "../lib/logger";
import { loadRecaptchaConfig, verifyRecaptcha } from "../lib/recaptcha";
import {
  extractWhatsappDigits,
  sanitizeMessage,
  sanitizeName,
  validateCity,
  validateEmail,
  validateMessage,
  validateName,
  validateReason,
  validateWhatsapp,
  type FieldError,
} from "../lib/contact-validation";

const router: IRouter = Router();

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_PER_WINDOW = 5;
const RATE_MIN_INTERVAL_MS = 10 * 1000;
const MIN_FORM_AGE_MS = 2000;
const MAX_FORM_AGE_MS = 30 * 60 * 1000;

const ALLOWED_CITIES = [
  "Barreiras",
  "Luís Eduardo Magalhães",
  "Correntina",
  "Wanderley",
  "Santa Rita de Cássia",
  "Barra",
  "Buritirama",
  "Mansidão",
  "Múquem de São Francisco",
  "Posto Rosário",
  "Roda Velha",
  "Javi",
];

type Bucket = { times: number[]; lastAt: number };
const ipBuckets = new Map<string, Bucket>();

function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0]!.trim();
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0]!.split(",")[0]!.trim();
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

function hashIp(ip: string): string {
  const salt = process.env["INTEREST_IP_SALT"] ?? "provider-mais-fibra";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 16);
}

// HMAC-signed time-trap token. The client asks for a token at form mount and
// returns it on submit. The server verifies the signature and that the issue
// time falls in [MIN_FORM_AGE_MS, MAX_FORM_AGE_MS]. Because the secret never
// leaves the server, bots cannot forge a fresh-looking token.
function trapSecret(): string {
  return (
    process.env["CONTACT_TRAP_SECRET"] ??
    process.env["INTEREST_IP_SALT"] ??
    "provider-mais-fibra-contact-trap"
  );
}

function signTrapToken(ts: number): string {
  const sig = createHmac("sha256", trapSecret())
    .update(String(ts))
    .digest("hex")
    .slice(0, 24);
  return `${ts}.${sig}`;
}

function verifyTrapToken(token: unknown):
  | { ok: true; ts: number }
  | { ok: false; reason: "missing" | "malformed" | "bad_sig" | "too_fast" | "expired" } {
  if (typeof token !== "string" || token.length === 0)
    return { ok: false, reason: "missing" };
  const idx = token.indexOf(".");
  if (idx <= 0) return { ok: false, reason: "malformed" };
  const tsStr = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const ts = parseInt(tsStr, 10);
  if (!Number.isFinite(ts)) return { ok: false, reason: "malformed" };
  const expected = signTrapToken(ts).slice(idx + 1);
  if (sig.length !== expected.length) return { ok: false, reason: "bad_sig" };
  let equal = false;
  try {
    equal = timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return { ok: false, reason: "bad_sig" };
  }
  if (!equal) return { ok: false, reason: "bad_sig" };
  const age = Date.now() - ts;
  if (age < MIN_FORM_AGE_MS) return { ok: false, reason: "too_fast" };
  if (age > MAX_FORM_AGE_MS) return { ok: false, reason: "expired" };
  return { ok: true, ts };
}

router.get("/contact/token", (_req, res) => {
  const ts = Date.now();
  res.json({ token: signTrapToken(ts), ts });
});

function checkRate(ip: string):
  | { ok: true }
  | { ok: false; reason: string; retryAfterSec: number } {
  const now = Date.now();
  const bucket = ipBuckets.get(ip) ?? { times: [], lastAt: 0 };
  bucket.times = bucket.times.filter((t) => now - t < RATE_WINDOW_MS);
  if (bucket.lastAt && now - bucket.lastAt < RATE_MIN_INTERVAL_MS) {
    const retry = Math.ceil((RATE_MIN_INTERVAL_MS - (now - bucket.lastAt)) / 1000);
    return {
      ok: false,
      reason: "Aguarde alguns segundos antes de enviar novamente.",
      retryAfterSec: retry,
    };
  }
  if (bucket.times.length >= RATE_MAX_PER_WINDOW) {
    const oldest = bucket.times[0]!;
    const retry = Math.ceil((RATE_WINDOW_MS - (now - oldest)) / 1000);
    return {
      ok: false,
      reason: "Muitos envios deste dispositivo. Tente novamente mais tarde.",
      retryAfterSec: retry,
    };
  }
  bucket.times.push(now);
  bucket.lastAt = now;
  ipBuckets.set(ip, bucket);
  return { ok: true };
}

// reCAPTCHA helpers moved to ../lib/recaptcha (shared with auth login).

function whatsappLinkFromForm(args: {
  phoneDigits: string;
  name: string;
  email: string;
  city: string;
  reason: string;
  message: string;
}): string {
  // Target number is the company's WhatsApp; we encode the user's data as the
  // pre-filled message text so the company sees who's reaching out.
  const target = "5577998444757";
  const lines = [
    `Olá! Meu nome é *${args.name}*.`,
    "",
    `📍 Cidade: ${args.city}`,
    `📧 E-mail: ${args.email}`,
    `📋 Assunto: ${args.reason}`,
    `📱 WhatsApp: ${args.phoneDigits}`,
  ];
  if (args.message) {
    lines.push("", `💬 Mensagem: ${args.message}`);
  }
  return `https://wa.me/${target}?text=${encodeURIComponent(lines.join("\n"))}`;
}

router.post("/contact", async (req, res) => {
  try {
    const body: Record<string, unknown> = (req.body && typeof req.body === "object"
      ? (req.body as Record<string, unknown>)
      : {}) ?? {};

    // ---------------------------------------------------------------------
    // Layer 1 — honeypot. Bots fill every field; humans never see "website".
    // We respond 200 so the bot thinks it succeeded and moves on.
    // ---------------------------------------------------------------------
    if (typeof body["website"] === "string" && (body["website"] as string).trim().length > 0) {
      logger.info({ ip: hashIp(clientIp(req)) }, "contact: honeypot triggered");
      res.status(200).json({ ok: true });
      return;
    }

    // ---------------------------------------------------------------------
    // Layer 2 — time-trap with HMAC-signed token. The client fetches a token
    // from GET /contact/token at form mount and returns it here. We verify
    // the signature and that the issue time falls inside the valid window.
    // Bots can't forge a fresh-looking token without the server secret.
    // ---------------------------------------------------------------------
    const trap = verifyTrapToken(body["_t"]);
    if (!trap.ok) {
      const map: Record<typeof trap.reason, string> = {
        missing: "Sessão inválida. Recarregue a página.",
        malformed: "Sessão inválida. Recarregue a página.",
        bad_sig: "Sessão inválida. Recarregue a página.",
        too_fast: "Envio muito rápido. Tente novamente.",
        expired: "Sessão expirada. Recarregue a página.",
      };
      res.status(400).json({ ok: false, error: map[trap.reason] });
      return;
    }

    // ---------------------------------------------------------------------
    // Layer 3 — per-IP rate limit.
    // ---------------------------------------------------------------------
    const ip = clientIp(req);
    const rate = checkRate(ip);
    if (!rate.ok) {
      res.setHeader("Retry-After", String(rate.retryAfterSec));
      res.status(429).json({ ok: false, error: rate.reason });
      return;
    }

    // ---------------------------------------------------------------------
    // Layer 4 — field validation (name, email, phone, city, reason, message).
    // ---------------------------------------------------------------------
    const errors: FieldError[] = [];
    const push = (e: FieldError | null) => {
      if (e) errors.push(e);
    };
    push(validateName(body["name"]));
    push(validateEmail(body["email"]));
    push(validateWhatsapp(body["phone"]));
    push(validateCity(body["city"], ALLOWED_CITIES));
    push(validateReason(body["reason"]));
    push(validateMessage(body["message"]));

    // privacy checkbox must be accepted
    if (body["accept"] !== true && body["accept"] !== "true") {
      errors.push({ field: "accept", message: "Aceite a Política de Privacidade." });
    }

    if (errors.length > 0) {
      res.status(400).json({ ok: false, errors });
      return;
    }

    // ---------------------------------------------------------------------
    // Layer 5 — reCAPTCHA v3 (only if enabled and configured).
    // ---------------------------------------------------------------------
    const cfg = await loadRecaptchaConfig();
    if (cfg.enabled && cfg.secret) {
      const token =
        typeof body["recaptchaToken"] === "string"
          ? (body["recaptchaToken"] as string)
          : "";
      const verdict = await verifyRecaptcha(token, cfg.secret, "contact", cfg.minScore, ip);
      if (!verdict.ok) {
        logger.info(
          { ip: hashIp(ip), reason: verdict.reason },
          "contact: reCAPTCHA rejected",
        );
        res.status(400).json({
          ok: false,
          error: "Verificação anti-robô falhou. Recarregue e tente novamente.",
        });
        return;
      }
    }

    // ---------------------------------------------------------------------
    // All checks passed — return the WhatsApp URL for the client to open.
    // We do NOT persist the message; it's a redirect-only contact form.
    // ---------------------------------------------------------------------
    const name = sanitizeName(String(body["name"]));
    const email = String(body["email"]).trim().toLowerCase();
    const phoneDigits = extractWhatsappDigits(body["phone"]);
    const city = String(body["city"]).trim();
    const reason = String(body["reason"]).trim();
    const message = sanitizeMessage(String(body["message"] ?? ""));

    const whatsappUrl = whatsappLinkFromForm({
      phoneDigits,
      name,
      email,
      city,
      reason,
      message,
    });

    logger.info({ ip: hashIp(ip), city, reason }, "contact: submission accepted");

    res.status(200).json({ ok: true, whatsappUrl });
  } catch (err) {
    logger.error({ err }, "contact: unexpected error");
    res.status(500).json({ ok: false, error: "Erro interno. Tente novamente." });
  }
});

export default router;
