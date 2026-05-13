import { backfillShareBotClicks } from "@workspace/scripts/backfill-share-bot-clicks";
import { logger } from "./logger";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = 5 * 60 * 1000; // wait 5 min after boot before first run

let started = false;
let timer: ReturnType<typeof setInterval> | null = null;
let initialTimer: ReturnType<typeof setTimeout> | null = null;
let runningTick = false;

export async function runBotClickBackfillTick(): Promise<void> {
  if (runningTick) {
    logger.info(
      "[bot-click-backfill] previous tick still running; skipping this run",
    );
    return;
  }
  runningTick = true;
  const startedAt = Date.now();
  try {
    const result = await backfillShareBotClicks({
      useUserAgent: true,
      logger: {
        info: (obj, msg) => {
          if (typeof obj === "string") logger.info(obj);
          else logger.info(obj, msg);
        },
        warn: (obj, msg) => {
          if (typeof obj === "string") logger.warn(obj);
          else logger.warn(obj, msg);
        },
        error: (obj, msg) => {
          if (typeof obj === "string") logger.error(obj);
          else logger.error(obj, msg);
        },
      },
    });
    logger.info(
      {
        rowsRelabeled: result.rowsRelabeled,
        rowsRelabeledByUserAgent: result.rowsRelabeledByUserAgent,
        burstGroupsFound: result.burstGroupsFound,
        windowSeconds: result.windowSeconds,
        minBurst: result.minBurst,
        useUserAgent: result.useUserAgent,
        durationMs: Date.now() - startedAt,
      },
      "[bot-click-backfill] daily run finished",
    );
  } catch (err) {
    logger.error(
      { err, durationMs: Date.now() - startedAt },
      "[bot-click-backfill] daily run failed",
    );
  } finally {
    runningTick = false;
  }
}

export function startBotClickBackfillScheduler(): void {
  if (started) return;
  started = true;

  initialTimer = setTimeout(() => {
    void runBotClickBackfillTick();
  }, INITIAL_DELAY_MS);

  timer = setInterval(() => {
    void runBotClickBackfillTick();
  }, ONE_DAY_MS);

  logger.info(
    { intervalMs: ONE_DAY_MS, initialDelayMs: INITIAL_DELAY_MS },
    "[bot-click-backfill] scheduler started",
  );
}

export function stopBotClickBackfillScheduler(): void {
  if (initialTimer) {
    clearTimeout(initialTimer);
    initialTimer = null;
  }
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  started = false;
}
