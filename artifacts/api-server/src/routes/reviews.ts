import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, reviewsTable, appSettingsTable } from "@workspace/db";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

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

function clampInt(raw: unknown, min: number, max: number, fallback: number): number {
  const n = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Public endpoint — used by the homepage. Returns a randomized subset of
// visible reviews above the configured minimum rating.
// ---------------------------------------------------------------------------
router.get("/reviews", async (req, res) => {
  try {
    const settingsRows = await db
      .select({ key: appSettingsTable.key, value: appSettingsTable.value })
      .from(appSettingsTable)
      .where(inArray(appSettingsTable.key, ["reviews_min_rating", "reviews_show_count"]));
    const map = new Map(settingsRows.map((r) => [r.key, r.value]));
    const minRating = clampInt(map.get("reviews_min_rating"), 1, 5, 4);
    const defaultShow = clampInt(map.get("reviews_show_count"), 1, 12, 6);
    const wantedShow = clampInt(req.query["limit"], 1, 12, defaultShow);

    const rows = await db
      .select({
        id: reviewsTable.id,
        source: reviewsTable.source,
        authorName: reviewsTable.authorName,
        authorAvatarUrl: reviewsTable.authorAvatarUrl,
        rating: reviewsTable.rating,
        text: reviewsTable.text,
        city: reviewsTable.city,
        postedAt: reviewsTable.postedAt,
      })
      .from(reviewsTable)
      .where(and(eq(reviewsTable.visible, true), gte(reviewsTable.rating, minRating)));

    const shuffled = shuffleInPlace([...rows]);
    res.setHeader("Cache-Control", "no-store");
    res.json(shuffled.slice(0, wantedShow));
  } catch (err) {
    logger.error({ err }, "reviews: failed to fetch public reviews");
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// ---------------------------------------------------------------------------
// Admin endpoints — list / create / update / delete.
// ---------------------------------------------------------------------------
router.get("/reviews/admin", requireAdminKey, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(reviewsTable)
      .orderBy(desc(reviewsTable.postedAt), desc(reviewsTable.createdAt));
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "reviews: failed to list");
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

router.post("/reviews", requireAdminKey, async (req, res) => {
  try {
    const body = req.body ?? {};
    const authorName = cleanText(body.authorName, 80);
    const text = cleanText(body.text, 1000);
    const rating = clampInt(body.rating, 1, 5, 5);
    const city = cleanText(body.city, 80) || null;
    const postedAt = body.postedAt ? new Date(body.postedAt) : new Date();
    const visible = body.visible !== false;
    if (!authorName || !text) {
      res.status(400).json({ error: "Nome e texto são obrigatórios." });
      return;
    }
    const [row] = await db
      .insert(reviewsTable)
      .values({
        source: "manual",
        authorName,
        text,
        rating,
        city,
        postedAt,
        visible,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    logger.error({ err }, "reviews: failed to insert");
    res.status(500).json({ error: "Failed to create review" });
  }
});

router.patch("/reviews/:id", requireAdminKey, async (req, res) => {
  try {
    const idNum = clampInt(req.params["id"], 1, Number.MAX_SAFE_INTEGER, -1);
    if (idNum < 1) {
      res.status(400).json({ error: "ID inválido." });
      return;
    }
    const body = req.body ?? {};
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.authorName === "string") updates["authorName"] = cleanText(body.authorName, 80);
    if (typeof body.text === "string") updates["text"] = cleanText(body.text, 1000);
    if (body.rating !== undefined) updates["rating"] = clampInt(body.rating, 1, 5, 5);
    if (typeof body.city === "string") updates["city"] = cleanText(body.city, 80) || null;
    if (typeof body.visible === "boolean") updates["visible"] = body.visible;
    const result = await db
      .update(reviewsTable)
      .set(updates)
      .where(eq(reviewsTable.id, idNum))
      .returning();
    if (result.length === 0) {
      res.status(404).json({ error: "Avaliação não encontrada." });
      return;
    }
    res.json(result[0]);
  } catch (err) {
    logger.error({ err }, "reviews: failed to update");
    res.status(500).json({ error: "Failed to update review" });
  }
});

router.delete("/reviews/:id", requireAdminKey, async (req, res) => {
  try {
    const idNum = clampInt(req.params["id"], 1, Number.MAX_SAFE_INTEGER, -1);
    if (idNum < 1) {
      res.status(400).json({ error: "ID inválido." });
      return;
    }
    await db.delete(reviewsTable).where(eq(reviewsTable.id, idNum));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "reviews: failed to delete");
    res.status(500).json({ error: "Failed to delete review" });
  }
});

// ---------------------------------------------------------------------------
// Import from Google Places API (Place Details). Returns up to 5 reviews.
// Requires google_places_api_key + google_places_id settings.
// ---------------------------------------------------------------------------
router.post("/reviews/import-google", requireAdminKey, async (_req, res) => {
  try {
    const rows = await db
      .select({ key: appSettingsTable.key, value: appSettingsTable.value })
      .from(appSettingsTable)
      .where(inArray(appSettingsTable.key, ["google_places_api_key", "google_places_id"]));
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const apiKey = (map.get("google_places_api_key") ?? "").trim();
    const placeId = (map.get("google_places_id") ?? "").trim();
    if (!apiKey || !placeId) {
      res.status(400).json({
        error: "Configure a chave da API e o Place ID antes de importar.",
      });
      return;
    }

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
      placeId,
    )}&fields=reviews,rating,user_ratings_total,name&language=pt-BR&reviews_no_translations=true&key=${encodeURIComponent(apiKey)}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const apiRes = await fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
    if (!apiRes.ok) {
      res.status(502).json({ error: `Google API HTTP ${apiRes.status}` });
      return;
    }
    const data = (await apiRes.json()) as {
      status?: string;
      error_message?: string;
      result?: {
        name?: string;
        rating?: number;
        user_ratings_total?: number;
        reviews?: Array<{
          author_name?: string;
          profile_photo_url?: string;
          rating?: number;
          text?: string;
          time?: number;
          relative_time_description?: string;
        }>;
      };
    };
    if (data.status && data.status !== "OK") {
      res.status(400).json({
        error: `Google API: ${data.status}${data.error_message ? ` — ${data.error_message}` : ""}`,
      });
      return;
    }
    const incoming = data.result?.reviews ?? [];
    if (incoming.length === 0) {
      res.json({ imported: 0, updated: 0, total: 0, businessName: data.result?.name ?? null });
      return;
    }

    let imported = 0;
    let updated = 0;
    for (const r of incoming) {
      const authorName = cleanText(r.author_name ?? "", 80);
      const text = cleanText(r.text ?? "", 1000);
      const rating = clampInt(r.rating, 1, 5, 5);
      if (!authorName || !text) continue;
      const externalId =
        typeof r.time === "number"
          ? `${placeId}:${r.time}:${authorName.toLowerCase().slice(0, 24)}`
          : `${placeId}:${authorName.toLowerCase().slice(0, 24)}:${text.slice(0, 32)}`;
      const postedAt = typeof r.time === "number" ? new Date(r.time * 1000) : new Date();
      const result = await db
        .insert(reviewsTable)
        .values({
          source: "google",
          externalId,
          authorName,
          authorAvatarUrl: r.profile_photo_url ?? null,
          rating,
          text,
          postedAt,
          visible: true,
        })
        .onConflictDoUpdate({
          target: [reviewsTable.source, reviewsTable.externalId],
          set: {
            authorName,
            authorAvatarUrl: r.profile_photo_url ?? null,
            rating,
            text,
            postedAt,
            updatedAt: sql`now()`,
          },
        })
        .returning({ id: reviewsTable.id, createdAt: reviewsTable.createdAt, updatedAt: reviewsTable.updatedAt });
      if (result[0]) {
        const created = result[0].createdAt?.getTime();
        const updatedAt = result[0].updatedAt?.getTime();
        if (created && updatedAt && Math.abs(updatedAt - created) < 1000) imported++;
        else updated++;
      }
    }

    res.json({
      imported,
      updated,
      total: incoming.length,
      businessName: data.result?.name ?? null,
      placeRating: data.result?.rating ?? null,
      ratingsTotal: data.result?.user_ratings_total ?? null,
    });
  } catch (err) {
    logger.error({ err }, "reviews: failed to import from google");
    res.status(500).json({ error: "Falha ao importar do Google." });
  }
});

export default router;
