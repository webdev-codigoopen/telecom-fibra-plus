import { Router, type IRouter } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

export const PERSISTENT_THRESHOLDS_KEY = "persistent_underperformance_thresholds";

export type PersistentThresholds = {
  periodDays: number;
  periods: number;
  minBelow: number;
  minPreviews: number;
};

export const PERSISTENT_THRESHOLDS_DEFAULTS: PersistentThresholds = {
  periodDays: 7,
  periods: 4,
  minBelow: 3,
  minPreviews: 5,
};

const PERIOD_DAYS_MIN = 1;
const PERIOD_DAYS_MAX = 60;
const PERIODS_MIN = 2;
const PERIODS_MAX = 12;
const MIN_PREVIEWS_MIN = 1;
const MIN_PREVIEWS_MAX = 1000;

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.floor(n)));
}

export function normalizePersistentThresholds(
  input: unknown,
): PersistentThresholds {
  const out = { ...PERSISTENT_THRESHOLDS_DEFAULTS };
  if (!input || typeof input !== "object") return out;
  const obj = input as Record<string, unknown>;
  const pd = Number(obj.periodDays);
  if (Number.isFinite(pd)) out.periodDays = clampInt(pd, PERIOD_DAYS_MIN, PERIOD_DAYS_MAX);
  const p = Number(obj.periods);
  if (Number.isFinite(p)) out.periods = clampInt(p, PERIODS_MIN, PERIODS_MAX);
  const mp = Number(obj.minPreviews);
  if (Number.isFinite(mp))
    out.minPreviews = clampInt(mp, MIN_PREVIEWS_MIN, MIN_PREVIEWS_MAX);
  // minBelow must be in [1, periods]
  const mb = Number(obj.minBelow);
  if (Number.isFinite(mb)) out.minBelow = clampInt(mb, 1, out.periods);
  else out.minBelow = Math.min(out.periods, out.minBelow);
  if (out.minBelow > out.periods) out.minBelow = out.periods;
  if (out.minBelow < 1) out.minBelow = 1;
  return out;
}

export async function loadPersistentThresholds(): Promise<PersistentThresholds> {
  const rows = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, PERSISTENT_THRESHOLDS_KEY))
    .limit(1);
  const raw = rows[0]?.value;
  if (!raw) return { ...PERSISTENT_THRESHOLDS_DEFAULTS };
  try {
    return normalizePersistentThresholds(JSON.parse(raw));
  } catch {
    return { ...PERSISTENT_THRESHOLDS_DEFAULTS };
  }
}

const bodySchema = z.object({
  periodDays: z.number().finite().int().min(PERIOD_DAYS_MIN).max(PERIOD_DAYS_MAX),
  periods: z.number().finite().int().min(PERIODS_MIN).max(PERIODS_MAX),
  minBelow: z.number().finite().int().min(1).max(PERIODS_MAX),
  minPreviews: z
    .number()
    .finite()
    .int()
    .min(MIN_PREVIEWS_MIN)
    .max(MIN_PREVIEWS_MAX),
});

router.get(
  "/admin/persistent-underperformance-thresholds",
  requireAdmin,
  async (_req, res) => {
    try {
      const thresholds = await loadPersistentThresholds();
      res.json({
        thresholds,
        defaults: PERSISTENT_THRESHOLDS_DEFAULTS,
        bounds: {
          periodDays: { min: PERIOD_DAYS_MIN, max: PERIOD_DAYS_MAX },
          periods: { min: PERIODS_MIN, max: PERIODS_MAX },
          minPreviews: { min: MIN_PREVIEWS_MIN, max: MIN_PREVIEWS_MAX },
        },
      });
    } catch {
      res
        .status(500)
        .json({ error: "Failed to fetch persistent-underperformance thresholds" });
    }
  },
);

router.put(
  "/admin/persistent-underperformance-thresholds",
  requireAdmin,
  async (req, res) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid thresholds", details: parsed.error.flatten() });
      return;
    }
    const clean = normalizePersistentThresholds(parsed.data);
    const value = JSON.stringify(clean);
    try {
      await db
        .insert(appSettingsTable)
        .values({ key: PERSISTENT_THRESHOLDS_KEY, value })
        .onConflictDoUpdate({
          target: appSettingsTable.key,
          set: { value, updatedAt: sql`now()` },
        });
      res.json({ thresholds: clean });
    } catch {
      res
        .status(500)
        .json({ error: "Failed to save persistent-underperformance thresholds" });
    }
  },
);

export default router;
