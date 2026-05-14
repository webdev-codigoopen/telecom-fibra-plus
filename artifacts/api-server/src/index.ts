import app from "./app";
import { logger } from "./lib/logger";
import { seedFirstAdminIfMissing } from "./lib/auth";
import { startEmailReportScheduler } from "./lib/emailReportScheduler";
import { startBotClickBackfillScheduler } from "./lib/botClickBackfillScheduler";
import { initBotUaPatterns } from "./lib/botUaPatterns";

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
const REQUIRED_ENV = ["JWT_SECRET"] as const;
const missing: string[] = REQUIRED_ENV.filter((name) => {
  const v = process.env[name];
  return !v || v.trim().length === 0;
});
const hasDbConn =
  !!process.env["SUPABASE_DB_PASSWORD"]?.trim() ||
  !!process.env["SUPABASE_DATABASE_URL"]?.trim() ||
  !!process.env["DATABASE_URL"]?.trim();
if (!hasDbConn) {
  missing.push("SUPABASE_DB_PASSWORD|SUPABASE_DATABASE_URL|DATABASE_URL");
}
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
  const jwtSecret = process.env["JWT_SECRET"] ?? "";
  if (jwtSecret.length < 32) {
    logger.fatal(
      "JWT_SECRET must be set with >= 32 chars in production. Refusing to start.",
    );
    process.exit(1);
  }
}

// Warm caches that affect bot detection BEFORE we accept traffic, so the
// first share-page hit can't slip through with an empty pattern set.
initBotUaPatterns()
  .catch((e) => logger.error({ err: e }, "initBotUaPatterns failed"))
  .finally(() => {
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
  });
