import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, planClicksTable } from "@workspace/db";
import { desc, gte, sql } from "drizzle-orm";

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

router.post("/clicks", async (req, res) => {
  const { planSpeed, planPrice, source } = req.body ?? {};
  if (!planSpeed || !planPrice) {
    res.status(400).json({ error: "planSpeed and planPrice are required" });
    return;
  }
  try {
    await db.insert(planClicksTable).values({
      planSpeed: String(planSpeed),
      planPrice: String(planPrice),
      source: source ? String(source) : "hero",
    });
    res.status(201).json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to record click" });
  }
});

router.get("/clicks/stats", requireAdminKey, async (req, res) => {
  try {
    const sinceParam = typeof req.query["since"] === "string" ? req.query["since"] : undefined;
    let sinceDate: Date | undefined;
    if (sinceParam) {
      const parsed = new Date(sinceParam);
      if (Number.isNaN(parsed.getTime())) {
        res.status(400).json({ error: "Invalid 'since' parameter; expected ISO 8601 date" });
        return;
      }
      sinceDate = parsed;
    }

    const baseSelect = db
      .select({
        planSpeed: planClicksTable.planSpeed,
        planPrice: planClicksTable.planPrice,
        total: sql<number>`cast(count(*) as int)`,
        lastClickedAt: sql<string>`max(${planClicksTable.clickedAt})`,
      })
      .from(planClicksTable);

    const filtered = sinceDate
      ? baseSelect.where(gte(planClicksTable.clickedAt, sinceDate))
      : baseSelect;

    const stats = await filtered
      .groupBy(planClicksTable.planSpeed, planClicksTable.planPrice)
      .orderBy(desc(sql`count(*)`));
    res.json(stats);
  } catch {
    res.status(500).json({ error: "Failed to fetch click stats" });
  }
});

export default router;
