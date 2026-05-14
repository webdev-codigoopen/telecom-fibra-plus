import { Router, type IRouter, type Request } from "express";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { and, desc, eq, or, ilike, sql } from "drizzle-orm";
import { db, referralsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { requireAdmin } from "../lib/auth";
import {
  loadWhatsappNotifyState,
  sendWhatsappNotification,
} from "../lib/sendWhatsapp";

const REFERRAL_STATUSES = [
  "novo",
  "em_contato",
  "convertido",
  "descartado",
] as const;
type ReferralStatus = (typeof REFERRAL_STATUSES)[number];
function isReferralStatus(v: unknown): v is ReferralStatus {
  return typeof v === "string" && (REFERRAL_STATUSES as readonly string[]).includes(v);
}

const router: IRouter = Router();

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_PER_WINDOW = 5;
const RATE_MIN_INTERVAL_MS = 15 * 1000;
const MIN_FORM_AGE_MS = 2000;
const MAX_FORM_AGE_MS = 60 * 60 * 1000;

const NAME_MAX = 80;
const CITY_MAX = 80;
const PHONE_MAX = 20;
const CPF_LEN = 11;

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

const VALID_BR_DDDS = new Set<number>([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35,
  37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64,
  65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88,
  89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ' \-.]+$/;

type Bucket = { times: number[]; lastAt: number };
const ipBuckets = new Map<string, Bucket>();

function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0)
    return fwd.split(",")[0]!.trim();
  if (Array.isArray(fwd) && fwd.length > 0)
    return fwd[0]!.split(",")[0]!.trim();
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

function hashIp(ip: string): string {
  const salt = process.env["INTEREST_IP_SALT"] ?? "provider-mais-fibra";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 16);
}

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

router.get("/referrals/token", (_req, res) => {
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
      reason: "Muitas indicações deste dispositivo. Tente novamente mais tarde.",
      retryAfterSec: retry,
    };
  }
  bucket.times.push(now);
  bucket.lastAt = now;
  ipBuckets.set(ip, bucket);
  return { ok: true };
}

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  const local = digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
  if (local.length < 10 || local.length > 11) return null;
  const ddd = parseInt(local.slice(0, 2), 10);
  if (!VALID_BR_DDDS.has(ddd)) return null;
  if (local.length === 11 && local[2] !== "9") return null;
  if (local.length === 10) {
    const c = local[2];
    if (!c || c < "2" || c > "5") return null;
  }
  if (/^(\d)\1+$/.test(local)) return null;
  return local;
}

function normalizeCpf(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== CPF_LEN) return null;
  if (/^(\d)\1+$/.test(digits)) return null;
  // CPF check digit validation
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]!, 10) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(digits[9]!, 10)) return null;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]!, 10) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  if (d2 !== parseInt(digits[10]!, 10)) return null;
  return digits;
}

function validateName(input: unknown): string | null {
  if (typeof input !== "string") return "Informe o nome.";
  const v = input.replace(/\s+/g, " ").trim();
  if (v.length < 4) return "Nome muito curto.";
  if (v.length > NAME_MAX) return "Nome muito longo.";
  if (!NAME_RE.test(v)) return "Use apenas letras, espaços e hífens.";
  const parts = v.split(" ").filter((p) => p.length > 0);
  if (parts.length < 2) return "Informe nome e sobrenome.";
  return null;
}

function formatPhoneDisplay(local: string): string {
  if (local.length === 11)
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10)
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return local;
}

function formatCpfDisplay(digits: string): string {
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

router.post("/referrals", async (req, res) => {
  try {
    const body: Record<string, unknown> =
      req.body && typeof req.body === "object"
        ? (req.body as Record<string, unknown>)
        : {};

    // Honeypot
    if (
      typeof body["website"] === "string" &&
      (body["website"] as string).trim().length > 0
    ) {
      logger.info({ ip: hashIp(clientIp(req)) }, "referrals: honeypot triggered");
      res.status(201).json({ ok: true });
      return;
    }

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

    const ip = clientIp(req);
    const rate = checkRate(ip);
    if (!rate.ok) {
      res.setHeader("Retry-After", String(rate.retryAfterSec));
      res.status(429).json({ ok: false, error: rate.reason });
      return;
    }

    const errors: Array<{ field: string; message: string }> = [];
    const push = (field: string, msg: string | null) => {
      if (msg) errors.push({ field, message: msg });
    };

    const indicadorNome = cleanText(body["indicadorNome"], NAME_MAX);
    push("indicadorNome", validateName(indicadorNome));
    const indicadorTelefone = normalizePhone(body["indicadorTelefone"]);
    if (!indicadorTelefone)
      push("indicadorTelefone", "Telefone inválido. Use DDD + número.");
    const indicadorCidade = cleanText(body["indicadorCidade"], CITY_MAX);
    if (!ALLOWED_CITIES.includes(indicadorCidade))
      push("indicadorCidade", "Selecione uma cidade atendida.");
    const indicadorCpf = normalizeCpf(body["indicadorCpf"]);
    if (!indicadorCpf) push("indicadorCpf", "CPF inválido.");

    const amigoNome = cleanText(body["amigoNome"], NAME_MAX);
    push("amigoNome", validateName(amigoNome));
    const amigoTelefone = normalizePhone(body["amigoTelefone"]);
    if (!amigoTelefone)
      push("amigoTelefone", "Telefone inválido. Use DDD + número.");
    const amigoCidade = cleanText(body["amigoCidade"], CITY_MAX);
    if (!ALLOWED_CITIES.includes(amigoCidade))
      push("amigoCidade", "Selecione uma cidade atendida.");
    const amigoCpf = normalizeCpf(body["amigoCpf"]);
    if (!amigoCpf) push("amigoCpf", "CPF inválido.");

    if (
      indicadorCpf &&
      amigoCpf &&
      indicadorCpf === amigoCpf
    ) {
      errors.push({
        field: "amigoCpf",
        message: "O CPF do amigo deve ser diferente do seu.",
      });
    }

    if (errors.length > 0) {
      res.status(400).json({ ok: false, errors });
      return;
    }

    const ipHash = hashIp(ip);
    const userAgent =
      typeof req.headers["user-agent"] === "string"
        ? req.headers["user-agent"].slice(0, 300)
        : null;

    const phoneMax = (s: string) => s.slice(0, PHONE_MAX);
    const inserted = await db
      .insert(referralsTable)
      .values({
        indicadorNome,
        indicadorTelefone: phoneMax(indicadorTelefone!),
        indicadorCidade,
        indicadorCpf: indicadorCpf!,
        amigoNome,
        amigoTelefone: phoneMax(amigoTelefone!),
        amigoCidade,
        amigoCpf: amigoCpf!,
        ipHash,
        userAgent,
      })
      .returning({ id: referralsTable.id });

    const referralId = inserted[0]?.id ?? null;
    logger.info({ ip: ipHash, referralId, city: indicadorCidade }, "referrals: created");

    res.status(201).json({ ok: true });

    void notifyReferralViaWhatsapp({
      referralId,
      indicadorNome,
      indicadorTelefone: indicadorTelefone!,
      indicadorCidade,
      indicadorCpf: indicadorCpf!,
      amigoNome,
      amigoTelefone: amigoTelefone!,
      amigoCidade,
      amigoCpf: amigoCpf!,
      createdAt: new Date(),
    });
  } catch (err) {
    logger.error({ err }, "referrals: unexpected error");
    res
      .status(500)
      .json({ ok: false, error: "Erro interno. Tente novamente." });
  }
});

async function notifyReferralViaWhatsapp(payload: {
  referralId: number | null;
  indicadorNome: string;
  indicadorTelefone: string;
  indicadorCidade: string;
  indicadorCpf: string;
  amigoNome: string;
  amigoTelefone: string;
  amigoCidade: string;
  amigoCpf: string;
  createdAt: Date;
}): Promise<void> {
  try {
    const { enabled, credentials } = await loadWhatsappNotifyState();
    if (!enabled || !credentials) {
      logger.info(
        { referralId: payload.referralId },
        "referrals: whatsapp notify disabled or unconfigured",
      );
      return;
    }
    const timestamp = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(payload.createdAt);
    const text = [
      "📣 *Nova indicação Provider + Fibra*",
      "",
      "*Assinante (indicador)*",
      `👤 ${payload.indicadorNome}`,
      `📱 ${formatPhoneDisplay(payload.indicadorTelefone)}`,
      `📍 ${payload.indicadorCidade}`,
      `🆔 CPF ${formatCpfDisplay(payload.indicadorCpf)}`,
      "",
      "*Amigo indicado*",
      `👤 ${payload.amigoNome}`,
      `📱 ${formatPhoneDisplay(payload.amigoTelefone)}`,
      `📍 ${payload.amigoCidade}`,
      `🆔 CPF ${formatCpfDisplay(payload.amigoCpf)}`,
      "",
      `🕒 Recebida em: ${timestamp}`,
    ].join("\n");
    const result = await sendWhatsappNotification(text);
    if (!result.ok) {
      logger.error(
        { error: result.error, referralId: payload.referralId },
        "referrals: failed to send whatsapp notification",
      );
      return;
    }
    if (payload.referralId != null) {
      try {
        await db
          .update(referralsTable)
          .set({ whatsappNotifiedAt: new Date() })
          .where(eq(referralsTable.id, payload.referralId));
      } catch (err) {
        logger.warn(
          { err, referralId: payload.referralId },
          "referrals: failed to mark whatsappNotifiedAt",
        );
      }
    }
  } catch (err) {
    logger.error({ err }, "referrals: whatsapp notification crashed");
  }
}

router.get("/admin/referrals", requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(
      Math.max(parseInt(String(req.query["limit"] ?? "50"), 10) || 50, 1),
      200,
    );
    const offset = Math.max(
      parseInt(String(req.query["offset"] ?? "0"), 10) || 0,
      0,
    );
    const statusParam = req.query["status"];
    const search = typeof req.query["q"] === "string" ? req.query["q"].trim() : "";

    const filters = [] as ReturnType<typeof eq>[];
    if (isReferralStatus(statusParam)) {
      filters.push(eq(referralsTable.status, statusParam));
    }
    if (search) {
      const like = `%${search.replace(/[%_]/g, "")}%`;
      const onlyDigits = search.replace(/\D/g, "");
      const orParts = [
        ilike(referralsTable.indicadorNome, like),
        ilike(referralsTable.amigoNome, like),
        ilike(referralsTable.indicadorCidade, like),
        ilike(referralsTable.amigoCidade, like),
      ];
      if (onlyDigits) {
        const digitsLike = `%${onlyDigits}%`;
        orParts.push(
          ilike(referralsTable.indicadorTelefone, digitsLike),
          ilike(referralsTable.amigoTelefone, digitsLike),
          ilike(referralsTable.indicadorCpf, digitsLike),
          ilike(referralsTable.amigoCpf, digitsLike),
        );
      }
      const orExpr = or(...orParts);
      if (orExpr) filters.push(orExpr as ReturnType<typeof eq>);
    }
    const whereExpr =
      filters.length === 0
        ? undefined
        : filters.length === 1
          ? filters[0]
          : and(...filters);

    const rowsQ = db
      .select()
      .from(referralsTable)
      .orderBy(desc(referralsTable.createdAt))
      .limit(limit)
      .offset(offset);
    const rows = await (whereExpr ? rowsQ.where(whereExpr) : rowsQ);

    const countQ = db
      .select({ c: sql<number>`count(*)::int` })
      .from(referralsTable);
    const countRows = await (whereExpr ? countQ.where(whereExpr) : countQ);
    const total = countRows[0]?.c ?? 0;

    const statusBreakdown = await db
      .select({
        status: referralsTable.status,
        c: sql<number>`count(*)::int`,
      })
      .from(referralsTable)
      .groupBy(referralsTable.status);

    res.json({
      ok: true,
      total,
      limit,
      offset,
      statusBreakdown,
      rows: rows.map((r) => ({
        id: r.id,
        indicadorNome: r.indicadorNome,
        indicadorTelefone: r.indicadorTelefone,
        indicadorCidade: r.indicadorCidade,
        indicadorCpf: r.indicadorCpf,
        amigoNome: r.amigoNome,
        amigoTelefone: r.amigoTelefone,
        amigoCidade: r.amigoCidade,
        amigoCpf: r.amigoCpf,
        status: r.status,
        note: r.note,
        whatsappNotifiedAt: r.whatsappNotifiedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    });
  } catch (err) {
    logger.error({ err }, "admin/referrals list: error");
    res.status(500).json({ ok: false, error: "Erro ao listar indicações." });
  }
});

router.patch("/admin/referrals/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params["id"]), 10);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ ok: false, error: "ID inválido." });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const patch: Partial<{ status: ReferralStatus; note: string | null }> = {};
    if ("status" in body) {
      if (!isReferralStatus(body["status"])) {
        res.status(400).json({ ok: false, error: "Status inválido." });
        return;
      }
      patch.status = body["status"];
    }
    if ("note" in body) {
      const n = body["note"];
      if (n === null || n === "") patch.note = null;
      else if (typeof n === "string") patch.note = n.slice(0, 1000);
      else {
        res.status(400).json({ ok: false, error: "Observação inválida." });
        return;
      }
    }
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ ok: false, error: "Nada para atualizar." });
      return;
    }
    const updated = await db
      .update(referralsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(referralsTable.id, id))
      .returning();
    if (updated.length === 0) {
      res.status(404).json({ ok: false, error: "Indicação não encontrada." });
      return;
    }
    res.json({ ok: true, row: updated[0] });
  } catch (err) {
    logger.error({ err }, "admin/referrals patch: error");
    res.status(500).json({ ok: false, error: "Erro ao atualizar." });
  }
});

export default router;
