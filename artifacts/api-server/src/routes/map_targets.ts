import { Router, type IRouter } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

const SETTING_KEY = "map_per_city_targets";

type PerCityTargets = Record<string, number>;

function parseStored(raw: string | undefined | null): PerCityTargets {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: PerCityTargets = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const n = Number(v);
      if (typeof k === "string" && k && Number.isFinite(n) && n > 0 && n <= 100) {
        out[k] = n;
      }
    }
    return out;
  } catch {
    return {};
  }
}

const targetsSchema = z.object({
  targets: z.record(
    z.string().trim().min(1).max(120),
    z.number().finite().gt(0).lte(100),
  ),
});

router.get("/admin/map-per-city-targets", requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, SETTING_KEY))
      .limit(1);
    const targets = parseStored(rows[0]?.value);
    res.json({ targets });
  } catch {
    res.status(500).json({ error: "Failed to fetch per-city targets" });
  }
});

router.put("/admin/map-per-city-targets", requireAdmin, async (req, res) => {
  const parsed = targetsSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid targets", details: parsed.error.flatten() });
    return;
  }
  // Re-validate / normalize to drop any entries that snuck past zod's record
  // (defense-in-depth: ensure stored JSON only ever contains valid numbers).
  const clean: PerCityTargets = {};
  for (const [name, n] of Object.entries(parsed.data.targets)) {
    if (Number.isFinite(n) && n > 0 && n <= 100) clean[name] = n;
  }
  const value = JSON.stringify(clean);
  try {
    await db
      .insert(appSettingsTable)
      .values({ key: SETTING_KEY, value })
      .onConflictDoUpdate({
        target: appSettingsTable.key,
        set: { value, updatedAt: sql`now()` },
      });
    res.json({ targets: clean });
  } catch {
    res.status(500).json({ error: "Failed to save per-city targets" });
  }
});

export default router;
