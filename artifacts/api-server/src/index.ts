import app from "./app";
import { logger } from "./lib/logger";
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
const REQUIRED_ENV = ["DATABASE_URL", "ADMIN_SECRET"] as const;
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
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startEmailReportScheduler();
  startBotClickBackfillScheduler();
});
