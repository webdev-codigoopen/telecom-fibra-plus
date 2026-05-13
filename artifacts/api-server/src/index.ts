import app from "./app";
import { logger } from "./lib/logger";
import { seedFirstAdminIfMissing } from "./lib/auth";
import { startEmailReportScheduler } from "./lib/emailReportScheduler";
import { startBotClickBackfillScheduler } from "./lib/botClickBackfillScheduler";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ---------------------------------------------------------------------------
// Boot-time validation of required secrets. Fail loud and early so we never
// silently run with a broken security posture in production.
// ---------------------------------------------------------------------------
const REQUIRED_ENV = ["DATABASE_URL"] as const;
const ADMIN_AUTH_ENV = ["ADMIN_SECRET", "JWT_SECRET"] as const;
const hasAnyAdminAuth = ADMIN_AUTH_ENV.some(
  (n) => (process.env[n] ?? "").trim().length > 0,
);
if (!hasAnyAdminAuth) {
  if (process.env["NODE_ENV"] === "production") {
    logger.fatal(
      "Refusing to start: at least one of ADMIN_SECRET or JWT_SECRET must be set",
    );
    process.exit(1);
  } else {
    logger.warn(
      "Neither ADMIN_SECRET nor JWT_SECRET is set — admin login will not work.",
    );
  }
}
const missing = REQUIRED_ENV.filter((name) => {
  const v = process.env[name];
  return !v || v.trim().length === 0;
});
if (missing.length > 0) {
  if (process.env["NODE_ENV"] === "production") {
    logger.fatal({ missing }, "Refusing to start: required env vars missing");
    process.exit(1);
  } else {
    logger.warn(
      { missing },
      "Required env vars missing — admin features may be disabled.",
    );
  }
}

if (process.env["NODE_ENV"] === "production") {
  const adminSecret = process.env["ADMIN_SECRET"] ?? "";
  if (adminSecret.length > 0 && adminSecret.length < 24) {
    logger.fatal(
      "ADMIN_SECRET is too short for production (minimum 24 chars). Refusing to start.",
    );
    process.exit(1);
  }
  const jwtSecret = process.env["JWT_SECRET"] ?? "";
  if (jwtSecret.length > 0 && jwtSecret.length < 32) {
    logger.fatal(
      "JWT_SECRET is too short for production (minimum 32 chars). Refusing to start.",
    );
    process.exit(1);
  }
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  seedFirstAdminIfMissing().catch((e) =>
    logger.error({ err: e }, "seedFirstAdminIfMissing failed"),
  );
  startEmailReportScheduler();
  startBotClickBackfillScheduler();
});
