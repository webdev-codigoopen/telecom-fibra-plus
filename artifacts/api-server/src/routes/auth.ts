import { Router, type IRouter, type Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";
import {
  clearAdminCookie,
  findAdminByEmail,
  issueAdminToken,
  requireAdmin,
  setAdminCookie,
  touchLastLogin,
  verifyPassword,
} from "../lib/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0]!.trim();
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0]!.split(",")[0]!.trim();
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

// Tight rate limit for the login endpoint specifically. Keyed by IP + email
// so an attacker can't burn through a single account by rotating IPs in the
// same window, and a single IP can't try many accounts cheaply either.
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
  })
  .strict();

router.post("/auth/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Credenciais inválidas." });
    return;
  }
  const { email, password } = parsed.data;
  const user = await findAdminByEmail(email);
  // Always run a bcrypt compare (even with a dummy hash) to keep timing
  // constant whether the email exists or not.
  const dummy = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8.WcFvDMxDBQnh/3v8b2GSyP9F0bL2";
  const ok = user && user.isActive
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPassword(password, dummy);
  if (!user || !user.isActive || !ok) {
    logger.warn({ email, ip: clientIp(req) }, "auth: failed login");
    res.status(401).json({ error: "Credenciais inválidas." });
    return;
  }
  const { token, expiresAt } = issueAdminToken({ id: user.id, email: user.email });
  setAdminCookie(res, token);
  await touchLastLogin(user.id);
  logger.info({ userId: user.id, email: user.email, ip: clientIp(req) }, "auth: login ok");
  res.json({ token, expiresAt, user: { id: user.id, email: user.email } });
});

router.post("/auth/logout", (_req, res) => {
  clearAdminCookie(res);
  res.json({ ok: true });
});

router.get("/auth/me", requireAdmin, (req, res) => {
  res.json({ user: req.adminUser });
});

export default router;
