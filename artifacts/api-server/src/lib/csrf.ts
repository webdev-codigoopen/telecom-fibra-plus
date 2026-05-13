import { doubleCsrf } from "csrf-csrf";
import type { Request, Response, NextFunction } from "express";

// ---------------------------------------------------------------------------
// CSRF protection — double-submit cookie pattern via csrf-csrf.
//
// Threat model: a CSRF attack only works when the browser auto-attaches an
// auth credential to a forged cross-site request. That happens with our
// `pmf_admin` session cookie. It does NOT happen with the X-Admin-Key /
// Authorization: Bearer headers, because no other origin can read or set
// those headers on the victim's behalf (the same-origin policy + CORS block
// it).
//
// So we enforce CSRF only when the authenticated request authenticated via
// the cookie. Header-bearer requests are structurally CSRF-immune and skip
// the check. requireAdmin sets req.adminAuthSource to "cookie" or "header".
// ---------------------------------------------------------------------------

const CSRF_COOKIE = "pmf_csrf";

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
    String(req.adminUser?.id ?? req.cookies?.["pmf_admin"] ?? "anon"),
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
  // Header-bearer auth is CSRF-immune by construction.
  if (req.adminAuthSource === "header") {
    next();
    return;
  }
  // Cookie-auth (or unauthenticated, which will be rejected by requireAdmin
  // anyway) must present a valid token.
  doubleCsrfProtection(req, res, (err) => {
    if (err) {
      res.status(403).json({ error: "Invalid or missing CSRF token" });
      return;
    }
    next();
  });
}
