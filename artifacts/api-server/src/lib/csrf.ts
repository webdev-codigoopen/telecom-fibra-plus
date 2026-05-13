import { doubleCsrf } from "csrf-csrf";
import type { Request, Response, NextFunction } from "express";

// ---------------------------------------------------------------------------
// CSRF protection — double-submit cookie pattern via csrf-csrf.
//
// Threat model: a CSRF attack only works when the browser auto-attaches an
// auth credential to a forged cross-site request. That happens with our
// `pmf_admin` session cookie. It does NOT happen with the X-Admin-Key /
// Authorization: Bearer headers, because no other origin can read or set
// those headers on the victim's behalf (same-origin policy + CORS).
//
// We enforce CSRF only when ALL of the following hold:
//   1. The request is a mutating verb (POST/PUT/PATCH/DELETE).
//   2. The browser sent the `pmf_admin` session cookie.
//   3. The request did NOT also present an explicit header bearer
//      (X-Admin-Key / Authorization: Bearer) — which always wins and is
//      structurally CSRF-immune.
//
// We make this decision by inspecting the raw request, NOT by relying on
// `req.adminAuthSource`, because the CSRF middleware runs BEFORE the per-
// route `requireAdmin` middleware that would set that flag. This also means
// public unauthenticated POSTs (e.g. /clicks, /demand/interest) are not
// blocked — they have no `pmf_admin` cookie.
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
  const xKey = req.headers["x-admin-key"];
  if (typeof xKey === "string" && xKey.length > 0) return true;
  if (Array.isArray(xKey) && xKey.some((v) => v && v.length > 0)) return true;
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
  // Header-bearer auth is CSRF-immune by construction. Skip even if a
  // session cookie also happens to be present.
  if (hasHeaderBearer(req)) {
    next();
    return;
  }
  // Public unauthenticated mutations (no admin cookie, no header bearer).
  // requireAdmin will reject these later if the route needs auth; CSRF has
  // no role here because there is no auth credential to ride on.
  if (!req.cookies?.[SESSION_COOKIE]) {
    next();
    return;
  }
  // Cookie-authenticated mutation — enforce double-submit token.
  doubleCsrfProtection(req, res, (err) => {
    if (err) {
      res.status(403).json({ error: "Invalid or missing CSRF token" });
      return;
    }
    next();
  });
}
