import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { csrfMiddleware } from "./lib/csrf";

const app: Express = express();

const isProduction = process.env["NODE_ENV"] === "production";

// Replit/Cloudflare proxies forward the real client IP via X-Forwarded-For.
// Trust the first hop so req.ip and rate limiters use the actual visitor IP
// rather than the loopback address of the proxy.
app.set("trust proxy", 1);
app.disable("x-powered-by");

// ---------------------------------------------------------------------------
// CORS allowlist. Same-origin requests (no Origin header) and the production
// domain are allowed. Replit dev/preview domains are allowed when not in
// production so the workspace preview pane keeps working.
// ---------------------------------------------------------------------------
const PROD_ALLOWED = new Set<string>([
  "https://www.maisfibratelecom.net.br",
  "https://maisfibratelecom.net.br",
]);

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // same-origin / curl / server-to-server
  if (PROD_ALLOWED.has(origin)) return true;
  if (!isProduction) {
    // Replit preview / dev domains
    if (/^https?:\/\/[^/]+\.(replit\.dev|repl\.co|riker\.replit\.dev|janeway\.replit\.dev|kirk\.replit\.dev|picard\.replit\.dev|spock\.replit\.dev)(:\d+)?$/.test(origin)) return true;
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  }
  return false;
}

app.use(
  cors({
    origin(origin, cb) {
      if (isAllowedOrigin(origin)) cb(null, true);
      else cb(new Error(`CORS: origin not allowed: ${origin}`));
    },
    credentials: true,
    maxAge: 86400,
  }),
);

// ---------------------------------------------------------------------------
// Security headers (Helmet). CSP is intentionally NOT enforced here because
// the SPA is served by a separate frontend and already controls its own
// markup; enabling CSP at the API would not affect the HTML the browser
// receives. Cross-Origin-Resource-Policy is loosened so the SPA on the same
// site can read JSON responses without being blocked.
// ---------------------------------------------------------------------------
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Body size cap — prevents JSON bombs.
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "256kb" }));
app.use(cookieParser());

// ---------------------------------------------------------------------------
// Rate limiting. A wide global limit catches scraping and abuse, and a tight
// limit on admin-authenticated requests catches credential-stuffing style
// attacks against the Authorization: Bearer header / pmf_admin cookie.
// Public form endpoints (/contact, /demand) keep their own per-IP buckets
// with stricter business rules.
// ---------------------------------------------------------------------------
const skipReadHealth = (req: Request) =>
  req.path === "/health" || req.path === "/healthz";

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 240,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
  skip: skipReadHealth,
});

const adminLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
  message: { error: "Muitas tentativas. Aguarde alguns minutos." },
});

app.use("/api", globalLimiter);
// Tighten any request that carries an admin credential (login attempts and
// authenticated mutations alike). This caps brute-force attempts on the JWT.
app.use("/api", (req, res, next) => {
  const authz = req.headers["authorization"];
  const cookies = (req as unknown as { cookies?: Record<string, string> })
    .cookies;
  const hasBearer = typeof authz === "string" && /^bearer\s+\S+/i.test(authz);
  const hasCookie = !!cookies?.["pmf_admin"];
  if (hasBearer || hasCookie) {
    adminLimiter(req, res, next);
    return;
  }
  next();
});

// CSRF protection. Enforced on EVERY authenticated mutation regardless of
// transport (cookie OR Authorization: Bearer). Skipped only for read-only
// verbs and for unauthenticated public mutations (no cookie + no bearer).
// The /auth/csrf endpoint and /auth/login are excluded so the SPA can
// bootstrap a token and submit credentials.
app.use("/api", (req, res, next) => {
  const p = req.path;
  if (p === "/auth/csrf" || p === "/auth/login") {
    next();
    return;
  }
  csrfMiddleware(req, res, next);
});

app.use("/api", router);

// ---------------------------------------------------------------------------
// Static frontend (single-deploy mode). When STATIC_ROOT is set or the
// expected dist/public directory exists relative to the bundled API, serve
// the SPA from it and fall back to index.html for any non-/api route.
// ---------------------------------------------------------------------------
const __apiDir = path.dirname(fileURLToPath(import.meta.url));
const candidateRoots = [
  process.env["STATIC_ROOT"]?.trim() || "",
  path.resolve(__apiDir, "../../provider-mais-fibra/dist/public"),
  path.resolve(__apiDir, "../provider-mais-fibra/dist/public"),
  path.resolve(__apiDir, "./public"),
].filter(Boolean);
const staticRoot = candidateRoots.find((p) => existsSync(p));
if (staticRoot) {
  logger.info({ staticRoot }, "serving SPA static files");
  app.use(
    express.static(staticRoot, {
      index: "index.html",
      maxAge: isProduction ? "1h" : 0,
      setHeaders(res, filePath) {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache");
        } else if (/\.(?:js|css|woff2?|png|jpe?g|svg|webp|gif|ico)$/i.test(filePath)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }),
  );
  app.get(/^\/(?!api\/).*/, (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET") return next();
    const indexFile = path.join(staticRoot, "index.html");
    res.sendFile(indexFile, (err) => {
      if (err) next(err);
    });
  });
}

// ---------------------------------------------------------------------------
// Production error handler — never leak stack traces to clients.
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err, path: req.path, method: req.method }, "unhandled error");
  if (res.headersSent) return;
  if (isProduction) {
    res.status(500).json({ error: "Internal server error" });
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  res.status(500).json({ error: "Internal server error", message });
});

export default app;
