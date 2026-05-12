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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

router.get("/plans/:id/share", async (req, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).send("Invalid plan ID");
    return;
  }
  try {
    const [plan] = await db
      .select()
      .from(plansTable)
      .where(eq(plansTable.id, id))
      .limit(1);
    if (!plan) {
      res.status(404).send("Plan not found");
      return;
    }
    const proto =
      (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0] ??
      req.protocol;
    const host = req.get("host") ?? "";
    const origin = `${proto}://${host}`;
    const apiIdx = req.originalUrl.indexOf("/api/");
    const basePath = apiIdx >= 0 ? req.originalUrl.slice(0, apiIdx) : "";
    const homeUrl = `${basePath}/` || "/";
    if (!plan.imageUrl) {
      res.redirect(302, homeUrl);
      return;
    }
    const absoluteImage = /^https?:\/\//i.test(plan.imageUrl)
      ? plan.imageUrl
      : `${origin}${plan.imageUrl.startsWith("/") ? "" : "/"}${plan.imageUrl}`;
    const shareUrl = `${origin}${req.originalUrl.split("?")[0]}`;
    const title = `Plano ${plan.speed} MEGA — Provider Mais Fibra`;
    const description = `Internet 100% Fibra ${plan.speed} MEGA por R$${plan.price}/mês.`;
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta property="og:type" content="website" />
<meta property="og:url" content="${escapeHtml(shareUrl)}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${escapeHtml(absoluteImage)}" />
<meta property="og:image:secure_url" content="${escapeHtml(absoluteImage)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(absoluteImage)}" />
<meta http-equiv="refresh" content="0; url=${escapeHtml(homeUrl)}" />
</head>
<body>
<p><a href="${escapeHtml(homeUrl)}">${escapeHtml(title)}</a></p>
</body>
</html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(html);
  } catch (err) {
    res.status(500).send("Failed to load plan");
  }
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

const reorderBodySchema = z.object({
  order: z.array(z.number().int().positive()).min(1),
});

router.patch("/plans/reorder", requireAdminKey, async (req, res) => {
  const parsed = reorderBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid reorder data", details: parsed.error.flatten() });
    return;
  }
  const ids = parsed.data.order;
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    res.status(400).json({ error: "Duplicate plan IDs in order" });
    return;
  }
  try {
    await db.transaction(async (tx) => {
      for (let i = 0; i < ids.length; i++) {
        await tx
          .update(plansTable)
          .set({ sortOrder: i })
          .where(eq(plansTable.id, ids[i]!));
      }
    });
    const rows = await db
      .select()
      .from(plansTable)
      .orderBy(plansTable.sortOrder, plansTable.id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to reorder plans" });
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
