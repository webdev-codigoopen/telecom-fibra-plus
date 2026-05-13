import { doubleCsrf } from "csrf-csrf";
import type { Request, Response, NextFunction } from "express";

// ---------------------------------------------------------------------------
// CSRF protection — double-submit cookie pattern via csrf-csrf.
//
// Per task #126 acceptance, CSRF is required for ALL authenticated admin
// mutations regardless of transport (cookie OR Authorization: Bearer).
// The only requests we skip are:
//   1. Read-only verbs (GET/HEAD/OPTIONS) — no state change.
//   2. Public unauthenticated mutations (no `pmf_admin` cookie AND no
//      Authorization: Bearer header) — open endpoints like /clicks and
//      /demand/interest, where there is no auth credential to ride on.
//
// We decide by inspecting the raw request directly (cookies + headers),
// NOT via `req.adminAuthSource`, because the CSRF middleware runs BEFORE
// the per-route `requireAdmin` middleware that would set that flag.
// ---------------------------------------------------------------------------

const CSRF_COOKIE = "pmf_csrf";
const SESSION_COOKIE = "pmf_admin";

function csrfSecret(): string {
  const v = process.env["JWT_SECRET"];
  const minLen = process.env["NODE_ENV"] === "production" ? 16 : 8;
  if (v && v.length >= minLen) return `csrf:${v}`;
  throw new Error(
    `JWT_SECRET must be set with >= ${minLen} chars for CSRF`,
  );
}

const {
  generateCsrfToken,
  doubleCsrfProtection,
} = doubleCsrf({
  getSecret: () => csrfSecret(),
  getSessionIdentifier: (req: Request) =>
    String(req.cookies?.[SESSION_COOKIE] ?? "anon"),
  cookieName: CSRF_COOKIE,
  cookieOptions: {
    httpOnly: false, // SPA reads it via JS to echo back in the header
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
  },
  size: 32,
  getCsrfTokenFromRequest: (req) => {
    const h = req.headers["x-csrf-token"];
    if (typeof h === "string" && h.length > 0) return h;
    if (Array.isArray(h) && h.length > 0) return h[0]!;
    return "";
  },
});

export function issueCsrfToken(req: Request, res: Response): string {
  return generateCsrfToken(req, res);
}

function hasHeaderBearer(req: Request): boolean {
  const authz = req.headers["authorization"];
  if (typeof authz === "string" && /^bearer\s+\S+/i.test(authz)) return true;
  return false;
}

export function csrfMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const m = req.method.toUpperCase();
  // Read-only verbs never need CSRF.
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") {
    next();
    return;
  }
  // Public unauthenticated mutations skip CSRF (no auth credential to
  // ride on). All other authenticated paths (cookie OR header bearer)
  // must present a valid double-submit token.
  if (!req.cookies?.[SESSION_COOKIE] && !hasHeaderBearer(req)) {
    next();
    return;
  }
  // Authenticated mutation — enforce double-submit token.
  doubleCsrfProtection(req, res, (err) => {
    if (err) {
      res.status(403).json({ error: "Invalid or missing CSRF token" });
      return;
    }
    next();
  });
}
