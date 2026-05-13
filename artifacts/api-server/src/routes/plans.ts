import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import {
  db,
  plansTable,
  planClicksTable,
  streamingBrandsTable,
  planStreamingBrandsTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin as requireAdminKey } from "../lib/auth";

const router: IRouter = Router();


router.get("/plans/admin/verify", requireAdminKey, (_req, res) => {
  res.json({ ok: true });
});

const CRAWLER_UA_PATTERN =
  /facebookexternalhit|facebookcatalog|facebot|twitterbot|slackbot|slack-imgproxy|linkedinbot|discordbot|telegrambot|skypeuripreview|pinterest(?:bot)?|embedly|quora link preview|vkshare|w3c_validator|redditbot|applebot|bingpreview|googlebot|google-inspectiontool|googleother|yandexbot|duckduckbot|baiduspider|petalbot|chatgpt-user|gptbot|oai-searchbot|perplexitybot|claudebot|anthropic-ai|bytespider/i;

function isBotUserAgent(ua: string | undefined): boolean {
  if (!ua) return false;
  if (CRAWLER_UA_PATTERN.test(ua)) return true;
  if (/\bWhatsApp\/[\d.]+/i.test(ua) && !/Mozilla|AppleWebKit|Chrome|Safari/i.test(ua)) {
    return true;
  }
  return false;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type StreamingBrandLite = {
  id: number;
  name: string;
  logoUrl: string | null;
  sortOrder: number;
};

async function loadBrandsByPlan(
  planIds: number[],
): Promise<Map<number, StreamingBrandLite[]>> {
  const map = new Map<number, StreamingBrandLite[]>();
  if (planIds.length === 0) return map;
  const rows = await db
    .select({
      planId: planStreamingBrandsTable.planId,
      sortOrder: planStreamingBrandsTable.sortOrder,
      brandId: streamingBrandsTable.id,
      brandName: streamingBrandsTable.name,
      brandLogoUrl: streamingBrandsTable.logoUrl,
    })
    .from(planStreamingBrandsTable)
    .innerJoin(
      streamingBrandsTable,
      eq(planStreamingBrandsTable.brandId, streamingBrandsTable.id),
    )
    .where(inArray(planStreamingBrandsTable.planId, planIds));
  rows.sort((a, b) => {
    if (a.planId !== b.planId) return a.planId - b.planId;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.brandId - b.brandId;
  });
  for (const r of rows) {
    let list = map.get(r.planId);
    if (!list) {
      list = [];
      map.set(r.planId, list);
    }
    list.push({
      id: r.brandId,
      name: r.brandName,
      logoUrl: r.brandLogoUrl,
      sortOrder: r.sortOrder,
    });
  }
  return map;
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
    const brandsByPlan = await loadBrandsByPlan([plan.id]);
    const planBrands = brandsByPlan.get(plan.id) ?? [];
    const proto =
      (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0] ??
      req.protocol;
    const host = req.get("host") ?? "";
    const origin = `${proto}://${host}`;
    const apiIdx = req.originalUrl.indexOf("/api/");
    const basePath = apiIdx >= 0 ? req.originalUrl.slice(0, apiIdx) : "";
    const homeUrl = `${basePath}/` || "/";
    const cityParam = typeof req.query["city"] === "string" ? req.query["city"].slice(0, 120) : null;
    const sourceRaw = typeof req.query["source"] === "string" ? req.query["source"] : "";
    const sourceParam = sourceRaw
      .replace(/[^a-zA-Z0-9:_\-.]/g, "")
      .slice(0, 64);
    const userAgent = req.get("user-agent") ?? undefined;
    const fromBot = isBotUserAgent(userAgent);
    const baseSource = fromBot ? "whatsapp-share-bot" : "whatsapp-share";
    const recordedSource = sourceParam.length > 0 ? `${baseSource}:${sourceParam}` : baseSource;
    Promise.resolve(
      db.insert(planClicksTable).values({
        planSpeed: plan.speed,
        planPrice: plan.price,
        source: recordedSource,
        city: cityParam && cityParam.length > 0 ? cityParam : null,
        userAgent: userAgent ? userAgent.slice(0, 1000) : null,
      }),
    ).then(
      () => undefined,
      (err) => {
        console.error("Failed to record whatsapp-share click", err);
      },
    );
    if (!plan.imageUrl) {
      res.redirect(302, homeUrl);
      return;
    }
    const absoluteImage = /^https?:\/\//i.test(plan.imageUrl)
      ? plan.imageUrl
      : `${origin}${plan.imageUrl.startsWith("/") ? "" : "/"}${plan.imageUrl}`;
    const shareUrl = `${origin}${req.originalUrl.split("?")[0]}`;
    const logoUrl = `${origin}${basePath}/images/logos/logo-header-264x47.svg`;
    const bonusLine = plan.bonus ? ` + ${plan.bonus}` : "";
    const title = `Plano ${plan.speed} MEGA por R$${plan.price}/mês — Provider Mais Fibra`;
    const description = `Internet 100% Fibra ${plan.speed} MEGA${plan.wifi ? ` com Wi-Fi ${plan.wifi}` : ""} por apenas R$${plan.price}/mês${bonusLine}. Assine agora pelo WhatsApp.`;
    const headlineSmall = (plan.shareHeadline ?? "").trim() || "Internet 100% Fibra";
    const subcopy = (plan.shareSubcopy ?? "").trim();
    const ctaText = (plan.shareCtaText ?? "").trim() || "Assinar pelo WhatsApp";
    const defaultWhatsappNumber =
      (process.env["DEFAULT_WHATSAPP_NUMBER"] ?? "").replace(/\D/g, "") ||
      "5577998444757";
    const planWhatsappNumber = (plan.whatsappNumber ?? "").replace(/\D/g, "");
    const whatsappNumber = planWhatsappNumber || defaultWhatsappNumber;
    const whatsappText = encodeURIComponent(
      `Olá! Quero assinar o plano de ${plan.speed} MEGA (R$${plan.price}/mês) da Provider Mais Fibra.`,
    );
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappText}`;
    const combined = [...(plan.inclusions ?? []), ...planBrands.map((b) => b.name)];
    const inclusions = combined.slice(0, 6);
    const inclusionsHtml = inclusions
      .map(
        (i) =>
          `<li><span class="check">✓</span>${escapeHtml(i)}</li>`,
      )
      .join("");
    const badgeHtml = plan.badge
      ? `<span class="badge">${escapeHtml(plan.badge)}</span>`
      : "";
    const bonusHtml = plan.bonus
      ? `<div class="bonus"><strong>Bônus:</strong> ${escapeHtml(plan.bonus)}</div>`
      : "";
    const subcopyHtml = subcopy
      ? `<p class="subcopy">${escapeHtml(subcopy)}</p>`
      : "";
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
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
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:linear-gradient(135deg,#001A6E 0%,#0040FF 100%);color:#0D0D0D;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:24px 16px}
header{width:100%;max-width:520px;display:flex;justify-content:center;margin-bottom:20px}
header img{height:40px;width:auto}
.card{width:100%;max-width:520px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 20px 50px rgba(0,16,80,.35)}
.image-wrap{width:100%;background:#F4F4F4;aspect-ratio:1/1;overflow:hidden;display:flex;align-items:center;justify-content:center}
.image-wrap img{width:100%;height:100%;object-fit:cover;display:block}
.content{padding:24px 22px 26px}
.badge{display:inline-block;background:#FFD700;color:#0D0D0D;font-weight:700;font-size:12px;letter-spacing:.5px;text-transform:uppercase;padding:6px 12px;border-radius:999px;margin-bottom:12px}
h1{font-size:34px;line-height:1.05;font-weight:800;color:#001050}
h1 small{display:block;font-size:14px;font-weight:600;color:#666;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px}
.wifi{margin-top:8px;font-size:14px;color:#666}
.price{margin-top:18px;display:flex;align-items:baseline;gap:6px;color:#00C040}
.price .currency{font-size:20px;font-weight:700}
.price .value{font-size:48px;font-weight:800;line-height:1}
.price .period{font-size:16px;color:#666;font-weight:600}
.bonus{margin-top:14px;background:#D4F7E3;color:#00701F;padding:10px 14px;border-radius:10px;font-size:14px}
.subcopy{margin-top:14px;color:#444;font-size:15px;line-height:1.45}
ul{list-style:none;margin-top:18px;display:grid;gap:8px}
li{display:flex;align-items:center;gap:10px;font-size:15px;color:#0D0D0D}
.check{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#00C040;color:#fff;font-size:12px;font-weight:700;flex-shrink:0}
.cta{display:flex;flex-direction:column;gap:10px;margin-top:22px}
.btn{display:flex;align-items:center;justify-content:center;gap:10px;padding:14px 18px;border-radius:12px;font-weight:700;font-size:16px;text-decoration:none;transition:transform .1s ease}
.btn:active{transform:scale(.98)}
.btn-primary{background:#00C040;color:#fff}
.btn-secondary{background:#F4F4F4;color:#001050}
footer{margin-top:18px;color:rgba(255,255,255,.85);font-size:12px;text-align:center}
@media (min-width:560px){h1{font-size:38px}.price .value{font-size:54px}}
</style>
</head>
<body>
<header><img src="${escapeHtml(logoUrl)}" alt="Provider Mais Fibra" /></header>
<main class="card">
<div class="image-wrap"><img src="${escapeHtml(absoluteImage)}" alt="Plano ${escapeHtml(plan.speed)} MEGA" /></div>
<div class="content">
${badgeHtml}
<h1><small>${escapeHtml(headlineSmall)}</small>${escapeHtml(plan.speed)} MEGA</h1>
${plan.wifi ? `<div class="wifi">Wi-Fi ${escapeHtml(plan.wifi)}</div>` : ""}
<div class="price"><span class="currency">R$</span><span class="value">${escapeHtml(plan.price)}</span><span class="period">/mês</span></div>
${bonusHtml}
${subcopyHtml}
${inclusionsHtml ? `<ul>${inclusionsHtml}</ul>` : ""}
<div class="cta">
<a class="btn btn-primary" href="${escapeHtml(whatsappUrl)}">${escapeHtml(ctaText)}</a>
<a class="btn btn-secondary" href="${escapeHtml(homeUrl)}">Ver todos os planos</a>
</div>
</div>
</main>
<footer>Provider Mais Fibra • Internet 100% Fibra Óptica</footer>
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
    const brandsByPlan = await loadBrandsByPlan(rows.map((r) => r.id));
    const enriched = rows.map((r) => ({
      ...r,
      streamingBrands: brandsByPlan.get(r.id) ?? [],
    }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch plans" });
  }
});

const planBodySchema = z.object({
  speed: z.string().min(1),
  wifi: z.string().min(1),
  price: z.string().min(1),
  inclusions: z.array(z.string()).default([]),
  streamingBrandIds: z.array(z.number().int().positive()).default([]),
  featured: z.boolean().default(false),
  badge: z.string().nullable().optional(),
  bonus: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
  imageUrl: z.string().nullable().optional(),
  shareHeadline: z.string().nullable().optional(),
  shareSubcopy: z.string().nullable().optional(),
  shareCtaText: z.string().nullable().optional(),
  whatsappNumber: z.string().nullable().optional(),
});

function normalizeOptional(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = s.trim();
  return t.length === 0 ? null : t;
}

function normalizeWhatsapp(s: string | null | undefined): string | null {
  if (s == null) return null;
  const digits = s.replace(/\D/g, "");
  return digits.length === 0 ? null : digits;
}

async function dedupValidBrandIds(ids: number[]): Promise<number[]> {
  const unique: number[] = [];
  const seen = new Set<number>();
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      unique.push(id);
    }
  }
  if (unique.length === 0) return [];
  const existing = await db
    .select({ id: streamingBrandsTable.id })
    .from(streamingBrandsTable)
    .where(inArray(streamingBrandsTable.id, unique));
  const existingSet = new Set(existing.map((r) => r.id));
  return unique.filter((id) => existingSet.has(id));
}

async function respondWithPlan(planId: number, res: Response, status = 200) {
  const [row] = await db
    .select()
    .from(plansTable)
    .where(eq(plansTable.id, planId))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }
  const brandsByPlan = await loadBrandsByPlan([row.id]);
  res.status(status).json({
    ...row,
    streamingBrands: brandsByPlan.get(row.id) ?? [],
  });
}

router.post("/plans", requireAdminKey, async (req, res) => {
  const parsed = planBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid plan data", details: parsed.error.flatten() });
    return;
  }
  try {
    const validBrandIds = await dedupValidBrandIds(parsed.data.streamingBrandIds);
    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(plansTable)
        .values({
          speed: parsed.data.speed,
          wifi: parsed.data.wifi,
          price: parsed.data.price,
          inclusions: parsed.data.inclusions,
          featured: parsed.data.featured,
          sortOrder: parsed.data.sortOrder,
          badge: normalizeOptional(parsed.data.badge),
          bonus: normalizeOptional(parsed.data.bonus),
          imageUrl: normalizeOptional(parsed.data.imageUrl),
          shareHeadline: normalizeOptional(parsed.data.shareHeadline),
          shareSubcopy: normalizeOptional(parsed.data.shareSubcopy),
          shareCtaText: normalizeOptional(parsed.data.shareCtaText),
          whatsappNumber: normalizeWhatsapp(parsed.data.whatsappNumber),
        })
        .returning();
      if (validBrandIds.length > 0) {
        await tx.insert(planStreamingBrandsTable).values(
          validBrandIds.map((brandId, idx) => ({
            planId: row!.id,
            brandId,
            sortOrder: idx,
          })),
        );
      }
      return row!;
    });
    await respondWithPlan(created.id, res, 201);
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
    const brandsByPlan = await loadBrandsByPlan(rows.map((r) => r.id));
    res.json(
      rows.map((r) => ({
        ...r,
        streamingBrands: brandsByPlan.get(r.id) ?? [],
      })),
    );
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
    const validBrandIds = await dedupValidBrandIds(parsed.data.streamingBrandIds);
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(plansTable)
        .set({
          speed: parsed.data.speed,
          wifi: parsed.data.wifi,
          price: parsed.data.price,
          inclusions: parsed.data.inclusions,
          featured: parsed.data.featured,
          sortOrder: parsed.data.sortOrder,
          badge: normalizeOptional(parsed.data.badge),
          bonus: normalizeOptional(parsed.data.bonus),
          imageUrl: normalizeOptional(parsed.data.imageUrl),
          shareHeadline: normalizeOptional(parsed.data.shareHeadline),
          shareSubcopy: normalizeOptional(parsed.data.shareSubcopy),
          shareCtaText: normalizeOptional(parsed.data.shareCtaText),
          whatsappNumber: normalizeWhatsapp(parsed.data.whatsappNumber),
        })
        .where(eq(plansTable.id, id))
        .returning();
      if (!row) return null;
      await tx
        .delete(planStreamingBrandsTable)
        .where(eq(planStreamingBrandsTable.planId, id));
      if (validBrandIds.length > 0) {
        await tx.insert(planStreamingBrandsTable).values(
          validBrandIds.map((brandId, idx) => ({
            planId: id,
            brandId,
            sortOrder: idx,
          })),
        );
      }
      return row;
    });
    if (!updated) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }
    await respondWithPlan(updated.id, res);
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
