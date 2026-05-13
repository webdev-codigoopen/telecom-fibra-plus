import { Router, type IRouter, type Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";
import {
  clearAdminCookie,
  findAdminByEmail,
  findAdminById,
  hashPassword,
  issueAdminToken,
  requireAdmin,
  setAdminCookie,
  setUserTotp,
  touchLastLogin,
  verifyPassword,
} from "../lib/auth";
import {
  buildOtpauthUrl,
  buildQrDataUrl,
  consumeRecoveryCode,
  generateRecoveryCodes,
  generateTotpSecret,
  verifyTotpCode,
} from "../lib/totp";
import { getLockoutMs, recordLoginAttempt } from "../lib/lockout";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0]!.trim();
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0]!.split(",")[0]!.trim();
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ipPart = ipKeyGenerator(req.ip ?? "unknown");
    const body = (req.body ?? {}) as { email?: unknown };
    const emailPart = typeof body.email === "string"
      ? body.email.trim().toLowerCase().slice(0, 254)
      : "anon";
    return `${ipPart}|${emailPart}`;
  },
  message: { error: "Muitas tentativas. Aguarde 15 minutos." },
});

const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(200),
    totpCode: z.string().trim().max(20).optional(),
    recoveryCode: z.string().trim().max(40).optional(),
  })
  .strict();

router.post("/auth/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Credenciais inválidas." });
    return;
  }
  const { email, password, totpCode, recoveryCode } = parsed.data;
  const ip = clientIp(req);

  // Per-account lockout check.
  const lockMs = await getLockoutMs(email);
  if (lockMs > 0) {
    res.status(423).json({
      error: "Conta temporariamente bloqueada por muitas tentativas. Tente novamente em alguns minutos.",
      retryAfterSec: Math.ceil(lockMs / 1000),
    });
    return;
  }

  const user = await findAdminByEmail(email);
  // Always run a bcrypt compare (constant-time defense against email enum).
  const dummy = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8.WcFvDMxDBQnh/3v8b2GSyP9F0bL2";
  const passwordOk = user && user.isActive
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPassword(password, dummy);

  if (!user || !user.isActive || !passwordOk) {
    await recordLoginAttempt(email, ip, false, "bad_password");
    logger.warn({ email, ip }, "auth: failed login");
    res.status(401).json({ error: "Credenciais inválidas." });
    return;
  }

  // 2FA gate.
  if (user.totpEnabled) {
    let secondFactorOk = false;
    if (recoveryCode && recoveryCode.length > 0) {
      const consumed = await consumeRecoveryCode(recoveryCode, user.recoveryCodes);
      if (consumed) {
        await setUserTotp(user.id, { recoveryCodes: consumed.remaining });
        secondFactorOk = true;
      }
    } else if (totpCode && user.totpSecret) {
      secondFactorOk = await verifyTotpCode(totpCode, user.totpSecret);
    }
    if (!secondFactorOk) {
      await recordLoginAttempt(email, ip, false, "bad_2fa");
      // Use a distinct response so the client knows to prompt for the code,
      // not to re-prompt for the password.
      res.status(401).json({
        error: totpCode || recoveryCode ? "Código inválido." : "Código de verificação obrigatório.",
        requires2fa: true,
      });
      return;
    }
  }

  const { token, expiresAt } = issueAdminToken({ id: user.id, email: user.email });
  setAdminCookie(res, token);
  await touchLastLogin(user.id);
  await recordLoginAttempt(email, ip, true);
  logger.info({ userId: user.id, email: user.email, ip }, "auth: login ok");
  res.json({ token, expiresAt, user: { id: user.id, email: user.email } });
});

router.post("/auth/logout", (_req, res) => {
  clearAdminCookie(res);
  res.json({ ok: true });
});

router.get("/auth/me", requireAdmin, async (req, res) => {
  if (!req.adminUser || req.adminUser.id === 0) {
    res.json({ user: req.adminUser, totpEnabled: false });
    return;
  }
  const u = await findAdminById(req.adminUser.id);
  res.json({
    user: req.adminUser,
    totpEnabled: u?.totpEnabled ?? false,
    recoveryCodesRemaining: u?.recoveryCodes?.length ?? 0,
  });
});

// ---------------------------------------------------------------------------
// 2FA setup flow.
//   POST /auth/2fa/setup  -> issue a fresh secret + QR code (does NOT enable
//                            yet; user must confirm a code first).
//   POST /auth/2fa/enable -> verify a code against the pending secret, then
//                            persist secret + totp_enabled=true and emit
//                            recovery codes (shown ONCE).
//   POST /auth/2fa/disable -> requires password (and current code, if any)
//                             to turn 2FA off.
//   POST /auth/2fa/verify  -> revalidate a code mid-session for sensitive
//                             operations.
// ---------------------------------------------------------------------------
router.post("/auth/2fa/setup", requireAdmin, async (req, res) => {
  if (!req.adminUser || req.adminUser.id === 0) {
    res.status(403).json({ error: "Conta legada não suporta 2FA. Faça login com e-mail e senha primeiro." });
    return;
  }
  const user = await findAdminById(req.adminUser.id);
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado." });
    return;
  }
  const secret = generateTotpSecret();
  const otpauth = buildOtpauthUrl(user.email, secret);
  const qr = await buildQrDataUrl(otpauth);
  // Stash the candidate secret on the user row but do NOT enable yet.
  await setUserTotp(user.id, { totpSecret: secret, totpEnabled: false });
  res.json({ secret, otpauth, qr });
});

const enableSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/) }).strict();
router.post("/auth/2fa/enable", requireAdmin, async (req, res) => {
  if (!req.adminUser || req.adminUser.id === 0) {
    res.status(403).json({ error: "Conta legada não suporta 2FA." });
    return;
  }
  const parsed = enableSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Código inválido." });
    return;
  }
  const user = await findAdminById(req.adminUser.id);
  if (!user || !user.totpSecret) {
    res.status(400).json({ error: "Configuração 2FA não iniciada. Gere o QR code primeiro." });
    return;
  }
  if (!(await verifyTotpCode(parsed.data.code, user.totpSecret))) {
    res.status(400).json({ error: "Código inválido." });
    return;
  }
  const { plain, hashes } = await generateRecoveryCodes();
  await setUserTotp(user.id, { totpEnabled: true, recoveryCodes: hashes });
  logger.info({ userId: user.id, email: user.email }, "auth: 2FA enabled");
  res.json({ ok: true, recoveryCodes: plain });
});

const disableSchema = z
  .object({ password: z.string().min(1).max(200) })
  .strict();
router.post("/auth/2fa/disable", requireAdmin, async (req, res) => {
  if (!req.adminUser || req.adminUser.id === 0) {
    res.status(403).json({ error: "Conta legada." });
    return;
  }
  const parsed = disableSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Senha obrigatória." });
    return;
  }
  const user = await findAdminById(req.adminUser.id);
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado." });
    return;
  }
  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Senha incorreta." });
    return;
  }
  await setUserTotp(user.id, { totpEnabled: false, totpSecret: null, recoveryCodes: [] });
  logger.info({ userId: user.id, email: user.email }, "auth: 2FA disabled");
  res.json({ ok: true });
});

const verifySchema = z.object({ code: z.string().trim().regex(/^\d{6}$/) }).strict();
router.post("/auth/2fa/verify", requireAdmin, async (req, res) => {
  if (!req.adminUser || req.adminUser.id === 0) {
    res.json({ ok: true });
    return;
  }
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "Código inválido." });
    return;
  }
  const user = await findAdminById(req.adminUser.id);
  if (!user?.totpEnabled || !user.totpSecret) {
    res.json({ ok: true, totpEnabled: false });
    return;
  }
  const ok = await verifyTotpCode(parsed.data.code, user.totpSecret);
  res.status(ok ? 200 : 401).json({ ok });
});

// Allow the logged-in admin to change their own password without going
// through a separate flow. Useful on first login from the seeded credentials.
const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z.string().min(8).max(200),
  })
  .strict();
router.post("/auth/change-password", requireAdmin, async (req, res) => {
  if (!req.adminUser || req.adminUser.id === 0) {
    res.status(403).json({ error: "Conta legada não pode trocar senha aqui." });
    return;
  }
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Senha atual ou nova inválida (mínimo 8 caracteres)." });
    return;
  }
  const user = await findAdminById(req.adminUser.id);
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado." });
    return;
  }
  const ok = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Senha atual incorreta." });
    return;
  }
  const newHash = await hashPassword(parsed.data.newPassword);
  await setUserTotp(user.id, {});
  // Reuse the same update channel — but we need a dedicated update for the
  // password. Importing the table here would create cycles, so do it inline.
  const { db, adminUsersTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  await db
    .update(adminUsersTable)
    .set({ passwordHash: newHash })
    .where(eq(adminUsersTable.id, user.id));
  res.json({ ok: true });
});

export default router;
