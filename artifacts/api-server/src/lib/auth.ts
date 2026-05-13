import { createHash, timingSafeEqual } from "crypto";
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
    }
  }
}

function jwtSecret(): string {
  const v = process.env["JWT_SECRET"];
  if (v && v.length >= 16) return v;
  // Derive a fallback from ADMIN_SECRET so legacy installs without an explicit
  // JWT_SECRET still work. In production we require either to be strong.
  const fallback = process.env["ADMIN_SECRET"];
  if (fallback && fallback.length >= 16) {
    return createHash("sha256").update(`jwt:${fallback}`).digest("hex");
  }
  throw new Error("JWT_SECRET (or ADMIN_SECRET) must be set with >= 16 chars");
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

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0]!.trim();
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0]!.split(",")[0]!.trim();
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

function collectTokens(req: Request): string[] {
  const out: string[] = [];
  const cookies = (req as unknown as { cookies?: Record<string, string> }).cookies;
  if (cookies && typeof cookies[COOKIE_NAME] === "string" && cookies[COOKIE_NAME].length > 0) {
    out.push(cookies[COOKIE_NAME]);
  }
  const auth = req.headers["authorization"];
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    const v = auth.slice(7).trim();
    if (v.length > 0) out.push(v);
  }
  const xkey = req.headers["x-admin-key"];
  if (typeof xkey === "string" && xkey.length > 0) out.push(xkey);
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
// requireAdmin — central admin middleware. Accepts:
//   1. Valid JWT in cookie / Authorization: Bearer / X-Admin-Key
//   2. Legacy ADMIN_SECRET as raw value in X-Admin-Key (fallback during
//      transition; remove once all admin clients have re-logged in).
// Logs every authenticated mutation (POST/PUT/PATCH/DELETE) to admin_audit_log.
// ---------------------------------------------------------------------------
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const tokens = collectTokens(req);

  // 1) Try every supplied credential as a JWT first; authorize on the first
  //    one that verifies. This way a stale cookie does not block a valid
  //    X-Admin-Key / Bearer token (or vice-versa).
  for (const t of tokens) {
    const payload = verifyToken(t);
    if (payload) {
      req.adminUser = { id: payload.sub, email: payload.email };
      writeAuditOnMutation(req, "ok").catch(() => {});
      next();
      return;
    }
  }

  // 2) Legacy fallback: raw ADMIN_SECRET in X-Admin-Key or Authorization
  //    Bearer (cookie path is JWT-only). Removed in follow-up #126.
  const legacy = process.env["ADMIN_SECRET"];
  if (legacy && legacy.length > 0) {
    const headerToken =
      typeof req.headers["x-admin-key"] === "string" ? (req.headers["x-admin-key"] as string) : "";
    const auth = req.headers["authorization"];
    const bearerToken = typeof auth === "string" && auth.startsWith("Bearer ")
      ? auth.slice(7).trim()
      : "";
    if (
      (headerToken && safeEqual(headerToken, legacy)) ||
      (bearerToken && safeEqual(bearerToken, legacy))
    ) {
      req.adminUser = { id: 0, email: "legacy" };
      writeAuditOnMutation(req, "legacy").catch(() => {});
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

async function writeAuditOnMutation(req: Request, status: string): Promise<void> {
  const m = req.method.toUpperCase();
  if (m !== "POST" && m !== "PUT" && m !== "PATCH" && m !== "DELETE") return;
  try {
    await db.insert(adminAuditLogTable).values({
      userId: req.adminUser?.id ?? null,
      email: req.adminUser?.email ?? null,
      action: req.path,
      method: m,
      path: req.originalUrl.split("?")[0] ?? req.path,
      ip: clientIp(req),
      userAgent: typeof req.headers["user-agent"] === "string"
        ? req.headers["user-agent"].slice(0, 300)
        : null,
      status,
      payload: null,
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
