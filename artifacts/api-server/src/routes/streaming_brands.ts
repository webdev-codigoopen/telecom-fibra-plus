import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import {
  db,
  streamingBrandsTable,
  plansTable,
  planStreamingBrandsTable,
} from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin as requireAdminKey } from "../lib/auth";
import { stripHtml } from "../lib/sanitize";

const router: IRouter = Router();


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
  name: z.string().trim().min(1).max(80).transform((s) => stripHtml(s)),
  logoUrl: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

function normalizeOptional(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = stripHtml(s);
  return t.length === 0 ? null : t;
}

async function plansLinkedToBrand(brandId: number) {
  return db
    .select({
      id: plansTable.id,
      speed: plansTable.speed,
      price: plansTable.price,
    })
    .from(planStreamingBrandsTable)
    .innerJoin(plansTable, eq(planStreamingBrandsTable.planId, plansTable.id))
    .where(eq(planStreamingBrandsTable.brandId, brandId))
    .orderBy(plansTable.sortOrder, plansTable.id);
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

const reorderBodySchema = z.object({
  order: z.array(z.number().int().positive()).min(1),
});

router.patch("/streaming-brands/reorder", requireAdminKey, async (req, res) => {
  const parsed = reorderBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid reorder data", details: parsed.error.flatten() });
    return;
  }
  const ids = parsed.data.order;
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    res.status(400).json({ error: "Duplicate brand IDs in order" });
    return;
  }
  try {
    const existing = await db
      .select({ id: streamingBrandsTable.id })
      .from(streamingBrandsTable);
    const existingIds = new Set(existing.map((row) => row.id));
    const requestedIds = new Set(ids);
    if (
      existingIds.size !== requestedIds.size ||
      [...existingIds].some((id) => !requestedIds.has(id))
    ) {
      res.status(400).json({
        error: "Order must include every existing brand ID exactly once.",
      });
      return;
    }
    await db.transaction(async (tx) => {
      for (let i = 0; i < ids.length; i++) {
        await tx
          .update(streamingBrandsTable)
          .set({ sortOrder: i })
          .where(eq(streamingBrandsTable.id, ids[i]!));
      }
    });
    const rows = await db
      .select()
      .from(streamingBrandsTable)
      .orderBy(streamingBrandsTable.sortOrder, streamingBrandsTable.id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to reorder streaming brands" });
  }
});

router.get("/streaming-brands/:id/usages", requireAdminKey, async (req, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid brand ID" });
    return;
  }
  try {
    const [brand] = await db
      .select()
      .from(streamingBrandsTable)
      .where(eq(streamingBrandsTable.id, id))
      .limit(1);
    if (!brand) {
      res.status(404).json({ error: "Brand not found" });
      return;
    }
    const plans = await plansLinkedToBrand(id);
    res.json({ brandName: brand.name, plans });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch brand usages" });
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
    const [existing] = await db
      .select()
      .from(streamingBrandsTable)
      .where(eq(streamingBrandsTable.id, id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Brand not found" });
      return;
    }
    const oldName = existing.name;
    const newName = parsed.data.name;
    const [updated] = await db
      .update(streamingBrandsTable)
      .set({
        name: newName,
        logoUrl: normalizeOptional(parsed.data.logoUrl),
        ...(parsed.data.sortOrder != null ? { sortOrder: parsed.data.sortOrder } : {}),
      })
      .where(eq(streamingBrandsTable.id, id))
      .returning();
    // The brand is referenced by FK, so renames are automatically reflected
    // for every linked plan. We still surface the affected plans to the
    // admin UI for the same "X plans were updated" confirmation message.
    const renamedPlans = oldName !== newName ? await plansLinkedToBrand(id) : [];
    res.json({
      ...updated,
      renamedPlans,
      renamedPlanCount: renamedPlans.length,
    });
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
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(streamingBrandsTable)
        .where(eq(streamingBrandsTable.id, id))
        .limit(1);
      if (!existing) {
        return {
          deleted: null,
          updatedPlans: [] as { id: number; speed: string; price: string }[],
        };
      }
      // Capture the affected plans BEFORE delete (FK cascade will then
      // remove the join rows automatically).
      const updatedPlans = await tx
        .select({
          id: plansTable.id,
          speed: plansTable.speed,
          price: plansTable.price,
        })
        .from(planStreamingBrandsTable)
        .innerJoin(
          plansTable,
          eq(planStreamingBrandsTable.planId, plansTable.id),
        )
        .where(eq(planStreamingBrandsTable.brandId, id))
        .orderBy(plansTable.sortOrder, plansTable.id);
      const [deleted] = await tx
        .delete(streamingBrandsTable)
        .where(eq(streamingBrandsTable.id, id))
        .returning();
      return { deleted: deleted ?? null, updatedPlans };
    });
    if (!result.deleted) {
      res.status(404).json({ error: "Brand not found" });
      return;
    }
    res.json({
      success: true,
      brandName: result.deleted.name,
      updatedPlans: result.updatedPlans,
      updatedPlanCount: result.updatedPlans.length,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete streaming brand" });
  }
});

export default router;
