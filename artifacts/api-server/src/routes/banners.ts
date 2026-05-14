import { Router, type IRouter } from "express";
import { db, bannersTable } from "@workspace/db";
import { and, eq, or, isNull, lte, gte, asc } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

const bannerBodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  desktopImageUrl: z.string().trim().min(1).max(500),
  mobileImageUrl: z.string().trim().min(1).max(500),
  linkUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine(
      (v) => v === null || /^https?:\/\//i.test(v) || v.startsWith("/"),
      { message: "linkUrl must be http(s) or a relative path starting with /" },
    ),
  startDate: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional(),
  endDate: z.string().datetime({ offset: true }).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
}).refine(
  (d) => {
    if (!d.startDate || !d.endDate) return true;
    return new Date(d.endDate).getTime() >= new Date(d.startDate).getTime();
  },
  { message: "endDate must be greater than or equal to startDate", path: ["endDate"] },
);

router.get("/banners", async (_req, res) => {
  try {
    const now = new Date();
    const rows = await db
      .select()
      .from(bannersTable)
      .where(
        and(
          eq(bannersTable.isActive, true),
          or(isNull(bannersTable.startDate), lte(bannersTable.startDate, now)),
          or(isNull(bannersTable.endDate), gte(bannersTable.endDate, now)),
        ),
      )
      .orderBy(asc(bannersTable.sortOrder), asc(bannersTable.id));
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch banners" });
  }
});

router.get("/admin/banners", requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(bannersTable)
      .orderBy(asc(bannersTable.sortOrder), asc(bannersTable.id));
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch banners" });
  }
});

router.post("/banners", requireAdmin, async (req, res) => {
  const parsed = bannerBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
    return;
  }
  try {
    const d = parsed.data;
    const [created] = await db
      .insert(bannersTable)
      .values({
        name: d.name,
        description: d.description ?? null,
        desktopImageUrl: d.desktopImageUrl,
        mobileImageUrl: d.mobileImageUrl,
        linkUrl: d.linkUrl ?? null,
        startDate: d.startDate ? new Date(d.startDate) : null,
        endDate: d.endDate ? new Date(d.endDate) : null,
        isActive: d.isActive ?? true,
        sortOrder: d.sortOrder ?? 0,
      })
      .returning();
    res.status(201).json(created);
  } catch {
    res.status(500).json({ error: "Failed to create banner" });
  }
});

router.put("/banners/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "ID inválido." });
    return;
  }
  const parsed = bannerBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
    return;
  }
  try {
    const d = parsed.data;
    const [updated] = await db
      .update(bannersTable)
      .set({
        name: d.name,
        description: d.description ?? null,
        desktopImageUrl: d.desktopImageUrl,
        mobileImageUrl: d.mobileImageUrl,
        linkUrl: d.linkUrl ?? null,
        startDate: d.startDate ? new Date(d.startDate) : null,
        endDate: d.endDate ? new Date(d.endDate) : null,
        ...(d.isActive != null ? { isActive: d.isActive } : {}),
        ...(d.sortOrder != null ? { sortOrder: d.sortOrder } : {}),
        updatedAt: new Date(),
      })
      .where(eq(bannersTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Banner não encontrado." });
      return;
    }
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Failed to update banner" });
  }
});

router.delete("/banners/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "ID inválido." });
    return;
  }
  try {
    const [deleted] = await db
      .delete(bannersTable)
      .where(eq(bannersTable.id, id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Banner não encontrado." });
      return;
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete banner" });
  }
});

export default router;
