import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env["ADMIN_SECRET"];
  if (!secret) {
    res.status(503).json({ error: "Admin access not configured" });
    return;
  }
  const key = req.headers["x-admin-key"];
  if (key !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

export const SETTING_DEFAULTS = {
  whatsapp_number: "5577998444757",
  cta_subscribe_message:
    "Quero assinar o plano {speed} mega da Provider Mais Fibra na cidade de {place}",
  cta_unavailable_message:
    "Queria saber quando a Provider Mais Fibra vai estar disponível na minha cidade, {place}",
} as const;

const ALLOWED_KEYS = Object.keys(SETTING_DEFAULTS) as Array<
  keyof typeof SETTING_DEFAULTS
>;

function rowsToObject(rows: Array<{ key: string; value: string }>) {
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const result: Record<string, string> = {};
  for (const k of ALLOWED_KEYS) {
    result[k] = map.get(k) ?? SETTING_DEFAULTS[k];
  }
  return result;
}

router.get("/settings", async (_req, res) => {
  try {
    const rows = await db.select().from(appSettingsTable);
    res.json(rowsToObject(rows));
  } catch {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

const settingsBodySchema = z
  .object({
    whatsapp_number: z.string().trim().min(8).max(20).optional(),
    cta_subscribe_message: z.string().trim().min(1).max(500).optional(),
    cta_unavailable_message: z.string().trim().min(1).max(500).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No settings provided" });

router.put("/settings", requireAdminKey, async (req, res) => {
  const parsed = settingsBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid settings", details: parsed.error.flatten() });
    return;
  }
  try {
    const entries = Object.entries(parsed.data) as Array<[string, string]>;
    for (const [key, value] of entries) {
      await db
        .insert(appSettingsTable)
        .values({ key, value })
        .onConflictDoUpdate({
          target: appSettingsTable.key,
          set: { value, updatedAt: sql`now()` },
        });
    }
    const rows = await db.select().from(appSettingsTable);
    res.json(rowsToObject(rows));
  } catch {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

export default router;
