import { backfillShareBotClicks } from "@workspace/scripts/backfill-share-bot-clicks";
import { db, appSettingsTable, botCleanupRunsTable } from "@workspace/db";
import { and, lt, notInArray, sql } from "drizzle-orm";
import { logger } from "./logger";
import {
  checkAndAlertIfStale,
  notifyOnBotCleanupFailure,
} from "./botCleanupAlert";
import { getCombinedUaPattern } from "./botUaPatterns";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = 5 * 60 * 1000; // wait 5 min after boot before first run

export const BOT_CLEANUP_STATUS_KEY = "bot_cleanup_last_run";

// Retention policy for the bot_cleanup_runs history table. The admin UI only
// surfaces the last ~20 entries, so we keep a generous buffer beyond that:
// always retain at least the most recent N runs, plus anything within the
// last D days. A row is pruned only when it is BOTH older than the day window
// AND not among the most-recent N rows.
export const BOT_CLEANUP_RUN_RETENTION_DAYS = 90;
export const BOT_CLEANUP_RUN_RETENTION_MIN_ROWS = 200;

async function pruneOldBotCleanupRuns(now: Date): Promise<void> {
  try {
    const cutoff = new Date(
      now.getTime() - BOT_CLEANUP_RUN_RETENTION_DAYS * ONE_DAY_MS,
    );
    const recent = await db
      .select({ id: botCleanupRunsTable.id })
      .from(botCleanupRunsTable)
      .orderBy(sql`${botCleanupRunsTable.finishedAt} desc`)
      .limit(BOT_CLEANUP_RUN_RETENTION_MIN_ROWS);
    const keepIds = recent.map((r) => r.id);
    const condition =
      keepIds.length > 0
        ? and(
            lt(botCleanupRunsTable.startedAt, cutoff),
            notInArray(botCleanupRunsTable.id, keepIds),
          )
        : lt(botCleanupRunsTable.startedAt, cutoff);
    await db.delete(botCleanupRunsTable).where(condition);
  } catch (err) {
    logger.error(
      { err },
      "[bot-click-backfill] failed to prune old run history",
    );
  }
}

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
  trigger: BotCleanupTrigger;
  error: string | null;
};

export type BotCleanupTrigger = "manual" | "scheduled";

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
  try {
    await db.insert(botCleanupRunsTable).values({
      startedAt: new Date(status.startedAt),
      finishedAt: new Date(status.finishedAt),
      durationMs: status.durationMs,
      ok: status.ok,
      rowsRelabeled: status.rowsRelabeled,
      rowsRelabeledByUserAgent: status.rowsRelabeledByUserAgent,
      burstGroupsFound: status.burstGroupsFound,
      windowSeconds: status.windowSeconds,
      minBurst: status.minBurst,
      useUserAgent: status.useUserAgent,
      trigger: status.trigger,
      error: status.error,
    });
  } catch (err) {
    logger.error(
      { err },
      "[bot-click-backfill] failed to append run history",
    );
  }
}

export type RunBotClickBackfillTickResult =
  | { skipped: true; status: null }
  | { skipped: false; status: BotCleanupStatus };

export async function runBotClickBackfillTick(
  options: { trigger?: BotCleanupTrigger } = {},
): Promise<RunBotClickBackfillTickResult> {
  const trigger: BotCleanupTrigger = options.trigger ?? "scheduled";
  if (runningTick) {
    logger.info(
      "[bot-click-backfill] previous tick still running; skipping this run",
    );
    return { skipped: true, status: null };
  }
  runningTick = true;
  const startedAtMs = Date.now();
  const startedAtIso = new Date(startedAtMs).toISOString();
  // Run the stale-check before the tick so that even a long string of
  // failed runs (or a scheduler that hasn't been able to complete a
  // successful tick in >36h) still triggers an alert.
  try {
    await checkAndAlertIfStale(new Date(startedAtMs));
  } catch (alertErr) {
    logger.error(
      { err: alertErr },
      "[bot-click-backfill] stale-check alert dispatch failed",
    );
  }
  try {
    const adminPattern = getCombinedUaPattern();
    const result = await backfillShareBotClicks({
      useUserAgent: true,
      ...(adminPattern ? { botUaPattern: adminPattern } : {}),
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
    const status: BotCleanupStatus = {
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
      trigger,
      error: null,
    };
    await persistStatus(status);
    try {
      await checkAndAlertIfStale(new Date());
    } catch (alertErr) {
      logger.error(
        { err: alertErr },
        "[bot-click-backfill] stale-check alert dispatch failed",
      );
    }
    return { skipped: false, status };
  } catch (err) {
    const finishedAtMs = Date.now();
    logger.error(
      { err, durationMs: finishedAtMs - startedAtMs },
      "[bot-click-backfill] daily run failed",
    );
    const status: BotCleanupStatus = {
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
      trigger,
      error: err instanceof Error ? err.message : String(err),
    };
    await persistStatus(status);
    try {
      await notifyOnBotCleanupFailure(status);
    } catch (alertErr) {
      logger.error(
        { err: alertErr },
        "[bot-click-backfill] failure alert dispatch failed",
      );
    }
    return { skipped: false, status };
  } finally {
    await pruneOldBotCleanupRuns(new Date());
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
