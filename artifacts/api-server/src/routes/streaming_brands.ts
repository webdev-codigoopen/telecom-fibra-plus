import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, streamingBrandsTable } from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";
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

router.get("/streaming-brands", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(streamingBrandsTable)
      .orderBy(streamingBrandsTable.sortOrder, streamingBrandsTable.id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch streaming brands" });
  }
});

const brandBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  logoUrl: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

function normalizeOptional(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = s.trim();
  return t.length === 0 ? null : t;
}

router.post("/streaming-brands", requireAdminKey, async (req, res) => {
  const parsed = brandBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid brand data", details: parsed.error.flatten() });
    return;
  }
  try {
    const existing = await db
      .select()
      .from(streamingBrandsTable)
      .where(eq(streamingBrandsTable.name, parsed.data.name))
      .limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Já existe uma marca com esse nome." });
      return;
    }
    const [created] = await db
      .insert(streamingBrandsTable)
      .values({
        name: parsed.data.name,
        logoUrl: normalizeOptional(parsed.data.logoUrl),
        sortOrder: parsed.data.sortOrder ?? 0,
      })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: "Failed to create streaming brand" });
  }
});

router.put("/streaming-brands/:id", requireAdminKey, async (req, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid brand ID" });
    return;
  }
  const parsed = brandBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid brand data", details: parsed.error.flatten() });
    return;
  }
  try {
    const conflict = await db
      .select()
      .from(streamingBrandsTable)
      .where(
        and(
          eq(streamingBrandsTable.name, parsed.data.name),
          ne(streamingBrandsTable.id, id),
        ),
      )
      .limit(1);
    if (conflict.length > 0) {
      res.status(409).json({ error: "Já existe outra marca com esse nome." });
      return;
    }
    const [updated] = await db
      .update(streamingBrandsTable)
      .set({
        name: parsed.data.name,
        logoUrl: normalizeOptional(parsed.data.logoUrl),
        ...(parsed.data.sortOrder != null ? { sortOrder: parsed.data.sortOrder } : {}),
      })
      .where(eq(streamingBrandsTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Brand not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update streaming brand" });
  }
});

router.delete("/streaming-brands/:id", requireAdminKey, async (req, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid brand ID" });
    return;
  }
  try {
    const [deleted] = await db
      .delete(streamingBrandsTable)
      .where(eq(streamingBrandsTable.id, id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Brand not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete streaming brand" });
  }
});

export default router;
