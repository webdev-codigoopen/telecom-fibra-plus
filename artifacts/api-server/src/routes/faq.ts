import { Router, type IRouter } from "express";
import { db, faqItemsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "../lib/auth";
import { stripHtml } from "../lib/sanitize";

const router: IRouter = Router();

const COLUMNS = ["left", "right"] as const;

router.get("/faq-items", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(faqItemsTable)
      .orderBy(faqItemsTable.sortOrder, faqItemsTable.id);
    res.json(rows.filter((r) => r.isActive));
  } catch {
    res.status(500).json({ error: "Failed to fetch FAQ items" });
  }
});

router.get("/admin/faq-items", requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(faqItemsTable)
      .orderBy(faqItemsTable.sortOrder, faqItemsTable.id);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch FAQ items" });
  }
});

const faqBodySchema = z.object({
  question: z.string().trim().min(3).max(300).transform((s) => stripHtml(s)),
  answer: z.string().trim().min(3).max(2000).transform((s) => stripHtml(s)),
  column: z.enum(COLUMNS).default("left"),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});

router.post("/faq-items", requireAdmin, async (req, res) => {
  const parsed = faqBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
    return;
  }
  try {
    const [created] = await db
      .insert(faqItemsTable)
      .values({
        question: parsed.data.question,
        answer: parsed.data.answer,
        column: parsed.data.column,
        sortOrder: parsed.data.sortOrder ?? 0,
        isActive: parsed.data.isActive ?? true,
      })
      .returning();
    res.status(201).json(created);
  } catch {
    res.status(500).json({ error: "Failed to create FAQ item" });
  }
});

router.put("/faq-items/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "ID inválido." });
    return;
  }
  const parsed = faqBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
    return;
  }
  try {
    const [updated] = await db
      .update(faqItemsTable)
      .set({
        question: parsed.data.question,
        answer: parsed.data.answer,
        column: parsed.data.column,
        ...(parsed.data.sortOrder != null ? { sortOrder: parsed.data.sortOrder } : {}),
        ...(parsed.data.isActive != null ? { isActive: parsed.data.isActive } : {}),
        updatedAt: new Date(),
      })
      .where(eq(faqItemsTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "FAQ item not found" });
      return;
    }
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Failed to update FAQ item" });
  }
});

router.delete("/faq-items/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "ID inválido." });
    return;
  }
  try {
    const [deleted] = await db
      .delete(faqItemsTable)
      .where(eq(faqItemsTable.id, id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "FAQ item not found" });
      return;
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete FAQ item" });
  }
});

const reorderSchema = z.object({
  order: z.array(z.number().int().positive()).min(1),
});

router.patch("/faq-items/reorder", requireAdmin, async (req, res) => {
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos." });
    return;
  }
  const ids = parsed.data.order;
  if (new Set(ids).size !== ids.length) {
    res.status(400).json({ error: "IDs duplicados." });
    return;
  }
  try {
    await db.transaction(async (tx) => {
      for (let i = 0; i < ids.length; i++) {
        await tx
          .update(faqItemsTable)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(eq(faqItemsTable.id, ids[i]!));
      }
    });
    const rows = await db
      .select()
      .from(faqItemsTable)
      .orderBy(faqItemsTable.sortOrder, faqItemsTable.id);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to reorder FAQ items" });
  }
});

export default router;
