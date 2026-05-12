import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, plansTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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

router.get("/plans/admin/verify", requireAdminKey, (_req, res) => {
  res.json({ ok: true });
});

router.get("/plans", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(plansTable)
      .orderBy(plansTable.sortOrder, plansTable.id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch plans" });
  }
});

const planBodySchema = z.object({
  speed: z.string().min(1),
  wifi: z.string().min(1),
  price: z.string().min(1),
  inclusions: z.array(z.string()).default([]),
  featured: z.boolean().default(false),
  badge: z.string().nullable().optional(),
  bonus: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
  imageUrl: z.string().nullable().optional(),
});

router.post("/plans", requireAdminKey, async (req, res) => {
  const parsed = planBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid plan data", details: parsed.error.flatten() });
    return;
  }
  try {
    const [created] = await db
      .insert(plansTable)
      .values({
        ...parsed.data,
        badge: parsed.data.badge ?? null,
        bonus: parsed.data.bonus ?? null,
        imageUrl: parsed.data.imageUrl ?? null,
      })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: "Failed to create plan" });
  }
});

router.put("/plans/:id", requireAdminKey, async (req, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid plan ID" });
    return;
  }
  const parsed = planBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid plan data", details: parsed.error.flatten() });
    return;
  }
  try {
    const [updated] = await db
      .update(plansTable)
      .set({
        ...parsed.data,
        badge: parsed.data.badge ?? null,
        bonus: parsed.data.bonus ?? null,
        imageUrl: parsed.data.imageUrl ?? null,
      })
      .where(eq(plansTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update plan" });
  }
});

router.delete("/plans/:id", requireAdminKey, async (req, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid plan ID" });
    return;
  }
  try {
    const [deleted] = await db
      .delete(plansTable)
      .where(eq(plansTable.id, id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete plan" });
  }
});

export default router;
