import { backfillShareBotClicks } from "@workspace/scripts/backfill-share-bot-clicks";
import { db, appSettingsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = 5 * 60 * 1000; // wait 5 min after boot before first run

export const BOT_CLEANUP_STATUS_KEY = "bot_cleanup_last_run";

export type BotCleanupStatus = {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  ok: boolean;
  rowsRelabeled: number;
  rowsRelabeledByUserAgent: number;
  burstGroupsFound: number;
  windowSeconds: number;
  minBurst: number;
  useUserAgent: boolean;
  error: string | null;
};

let started = false;
let timer: ReturnType<typeof setInterval> | null = null;
let initialTimer: ReturnType<typeof setTimeout> | null = null;
let runningTick = false;

async function persistStatus(status: BotCleanupStatus): Promise<void> {
  try {
    const value = JSON.stringify(status);
    await db
      .insert(appSettingsTable)
      .values({ key: BOT_CLEANUP_STATUS_KEY, value })
      .onConflictDoUpdate({
        target: appSettingsTable.key,
        set: { value, updatedAt: sql`now()` },
      });
  } catch (err) {
    logger.error(
      { err },
      "[bot-click-backfill] failed to persist run status",
    );
  }
}

export async function runBotClickBackfillTick(): Promise<void> {
  if (runningTick) {
    logger.info(
      "[bot-click-backfill] previous tick still running; skipping this run",
    );
    return;
  }
  runningTick = true;
  const startedAtMs = Date.now();
  const startedAtIso = new Date(startedAtMs).toISOString();
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
    const finishedAtMs = Date.now();
    logger.info(
      {
        rowsRelabeled: result.rowsRelabeled,
        rowsRelabeledByUserAgent: result.rowsRelabeledByUserAgent,
        burstGroupsFound: result.burstGroupsFound,
        windowSeconds: result.windowSeconds,
        minBurst: result.minBurst,
        useUserAgent: result.useUserAgent,
        durationMs: finishedAtMs - startedAtMs,
      },
      "[bot-click-backfill] daily run finished",
    );
    await persistStatus({
      startedAt: startedAtIso,
      finishedAt: new Date(finishedAtMs).toISOString(),
      durationMs: finishedAtMs - startedAtMs,
      ok: true,
      rowsRelabeled: result.rowsRelabeled,
      rowsRelabeledByUserAgent: result.rowsRelabeledByUserAgent,
      burstGroupsFound: result.burstGroupsFound,
      windowSeconds: result.windowSeconds,
      minBurst: result.minBurst,
      useUserAgent: result.useUserAgent,
      error: null,
    });
  } catch (err) {
    const finishedAtMs = Date.now();
    logger.error(
      { err, durationMs: finishedAtMs - startedAtMs },
      "[bot-click-backfill] daily run failed",
    );
    await persistStatus({
      startedAt: startedAtIso,
      finishedAt: new Date(finishedAtMs).toISOString(),
      durationMs: finishedAtMs - startedAtMs,
      ok: false,
      rowsRelabeled: 0,
      rowsRelabeledByUserAgent: 0,
      burstGroupsFound: 0,
      windowSeconds: 0,
      minBurst: 0,
      useUserAgent: true,
      error: err instanceof Error ? err.message : String(err),
    });
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
