import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  adminUsersTable,
  adminAuditLogTable,
  type DbAdminUser,
} from "@workspace/db";
import { logger } from "./logger";

const JWT_ALG = "HS256" as const;
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const COOKIE_NAME = "pmf_admin";

export type AdminTokenPayload = {
  sub: number;
  email: string;
  iat: number;
  exp: number;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      adminUser?: { id: number; email: string };
      // Where the admin auth credential came from. Used by audit logging.
      // CSRF is enforced on every authenticated mutation regardless of source.
      adminAuthSource?: "cookie" | "header";
    }
  }
}

function jwtSecret(): string {
  const v = process.env["JWT_SECRET"];
  const minLen = process.env["NODE_ENV"] === "production" ? 16 : 8;
  if (v && v.length >= minLen) return v;
  throw new Error(
    `JWT_SECRET must be set with >= ${minLen} chars (NODE_ENV=${process.env["NODE_ENV"] ?? "development"})`,
  );
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export function issueAdminToken(user: { id: number; email: string }): {
  token: string;
  expiresAt: number;
} {
  const token = jwt.sign(
    { sub: user.id, email: user.email },
    jwtSecret(),
    { algorithm: JWT_ALG, expiresIn: TOKEN_TTL_SECONDS },
  );
  return { token, expiresAt: Date.now() + TOKEN_TTL_SECONDS * 1000 };
}

export function setAdminCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    maxAge: TOKEN_TTL_SECONDS * 1000,
    path: "/",
  });
}

export function clearAdminCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0]!.trim();
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0]!.split(",")[0]!.trim();
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

type Candidate = { token: string; source: "cookie" | "header" };

function collectTokens(req: Request): Candidate[] {
  const out: Candidate[] = [];
  const cookies = (req as unknown as { cookies?: Record<string, string> }).cookies;
  if (cookies && typeof cookies[COOKIE_NAME] === "string" && cookies[COOKIE_NAME].length > 0) {
    out.push({ token: cookies[COOKIE_NAME], source: "cookie" });
  }
  const auth = req.headers["authorization"];
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    const v = auth.slice(7).trim();
    if (v.length > 0) out.push({ token: v, source: "header" });
  }
  return out;
}

function verifyToken(token: string): AdminTokenPayload | null {
  try {
    const decoded = jwt.verify(token, jwtSecret(), { algorithms: [JWT_ALG] });
    if (typeof decoded !== "object" || decoded === null) return null;
    const payload = decoded as Partial<AdminTokenPayload>;
    if (typeof payload.sub !== "number" || typeof payload.email !== "string") return null;
    return payload as AdminTokenPayload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// requireAdmin — central admin middleware. Accepts a valid JWT delivered via:
//   - the pmf_admin httpOnly cookie
//   - the Authorization: Bearer <jwt> header
//
// Both transports require a valid X-CSRF-Token on mutations. The legacy
// ADMIN_SECRET raw-string fallback and the legacy X-Admin-Key header
// transport were removed in task #126.
// Logs every authenticated mutation (POST/PUT/PATCH/DELETE) to admin_audit_log.
// ---------------------------------------------------------------------------
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const tokens = collectTokens(req);

  for (const c of tokens) {
    const payload = verifyToken(c.token);
    if (payload) {
      req.adminUser = { id: payload.sub, email: payload.email };
      req.adminAuthSource = c.source;
      writeAuditOnMutation(req, "ok").catch(() => {});
      next();
      return;
    }
  }

  logger.warn(
    { ip: clientIp(req), path: req.path, method: req.method, ua: req.headers["user-agent"] },
    "admin: unauthorized access attempt",
  );
  res.status(401).json({ error: "Unauthorized" });
}

// Map HTTP method → semantic action verb for audit logging.
const ACTION_VERB: Record<string, string> = {
  POST: "create",
  PUT: "update",
  PATCH: "update",
  DELETE: "delete",
};

// Derive a semantic target from the request URL.
//   POST   /api/plans            → target = "plans"
//   PUT    /api/plans/42         → target = "plans:42"
//   DELETE /api/streaming-brands/7 → target = "streaming-brands:7"
function deriveTarget(req: Request): string {
  const cleanPath = (req.originalUrl.split("?")[0] ?? req.path).replace(
    /^\/api\/?/,
    "",
  );
  const segments = cleanPath.split("/").filter(Boolean);
  if (segments.length === 0) return "root";
  if (segments.length === 1) return segments[0]!;
  // Treat trailing numeric/uuid-like segment as resource id.
  const last = segments[segments.length - 1]!;
  const isId = /^[0-9a-f-]{1,64}$/i.test(last);
  if (isId) return `${segments.slice(0, -1).join("/")}:${last}`;
  return segments.join("/");
}

async function writeAuditOnMutation(
  req: Request,
  status: string,
): Promise<void> {
  const m = req.method.toUpperCase();
  const verb = ACTION_VERB[m];
  if (!verb) return;
  const target = deriveTarget(req);
  const action = `${verb}:${target.split(":")[0]}`;
  const payloadSummary: Record<string, unknown> = {
    method: m,
    status,
    path: req.originalUrl.split("?")[0] ?? req.path,
    source: req.adminAuthSource ?? null,
  };
  // Capture top-level keys of the body so reviewers can see what fields were
  // touched without leaking sensitive values.
  const body = (req as { body?: unknown }).body;
  if (body && typeof body === "object" && !Array.isArray(body)) {
    payloadSummary["fields"] = Object.keys(body as Record<string, unknown>).slice(0, 20);
  }
  try {
    await db.insert(adminAuditLogTable).values({
      userId: req.adminUser?.id ?? null,
      email: req.adminUser?.email ?? null,
      action,
      target,
      payloadSummary,
      ip: clientIp(req),
      userAgent: typeof req.headers["user-agent"] === "string"
        ? req.headers["user-agent"].slice(0, 300)
        : null,
    });
  } catch (err) {
    logger.warn({ err }, "audit log write failed");
  }
}

export async function findAdminByEmail(email: string): Promise<DbAdminUser | null> {
  const rows = await db
    .select()
    .from(adminUsersTable)
    .where(eq(adminUsersTable.email, email.trim().toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
}

export async function touchLastLogin(userId: number): Promise<void> {
  await db
    .update(adminUsersTable)
    .set({ lastLoginAt: new Date() })
    .where(eq(adminUsersTable.id, userId));
}

export async function findAdminById(id: number): Promise<DbAdminUser | null> {
  const rows = await db
    .select()
    .from(adminUsersTable)
    .where(eq(adminUsersTable.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function setUserTotp(
  userId: number,
  patch: { totpSecret?: string | null; totpEnabled?: boolean; recoveryCodes?: string[] },
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.totpSecret !== undefined) update["totpSecret"] = patch.totpSecret;
  if (patch.totpEnabled !== undefined) update["totpEnabled"] = patch.totpEnabled;
  if (patch.recoveryCodes !== undefined) update["recoveryCodes"] = patch.recoveryCodes;
  await db.update(adminUsersTable).set(update).where(eq(adminUsersTable.id, userId));
}

// ---------------------------------------------------------------------------
// On-boot seed: if no admin user exists and ADMIN_EMAIL + ADMIN_PASSWORD are
// provided, create the first user. Lets fresh deployments bootstrap without
// a separate CLI step.
// ---------------------------------------------------------------------------
export async function seedFirstAdminIfMissing(): Promise<void> {
  try {
    const existing = await db.select({ id: adminUsersTable.id }).from(adminUsersTable).limit(1);
    if (existing.length > 0) return;
    const email = (process.env["ADMIN_EMAIL"] ?? "").trim().toLowerCase();
    const password = process.env["ADMIN_PASSWORD"] ?? "";
    if (!email || !password || password.length < 8) {
      logger.warn(
        "No admin_users found and ADMIN_EMAIL/ADMIN_PASSWORD not set (or password < 8 chars). Seed skipped.",
      );
      return;
    }
    const passwordHash = await hashPassword(password);
    await db.insert(adminUsersTable).values({ email, passwordHash, isActive: true });
    logger.info({ email }, "Seeded first admin user");
  } catch (err) {
    logger.error({ err }, "Failed to seed first admin user");
  }
}
