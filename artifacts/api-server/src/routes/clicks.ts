import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, planClicksTable, appSettingsTable } from "@workspace/db";
import { and, desc, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import { requireAdmin as requireAdminKey } from "../lib/auth";
import {
  BOT_CLEANUP_STATUS_KEY,
  type BotCleanupStatus,
} from "../lib/botClickBackfillScheduler";

const router: IRouter = Router();


router.post("/clicks", async (req, res) => {
  const { planSpeed, planPrice, source, city } = req.body ?? {};
  if (!planSpeed || !planPrice) {
    res.status(400).json({ error: "planSpeed and planPrice are required" });
    return;
  }
  try {
    const userAgent = req.get("user-agent");
    await db.insert(planClicksTable).values({
      planSpeed: String(planSpeed),
      planPrice: String(planPrice),
      source: source ? String(source) : "hero",
      city: city ? String(city).slice(0, 120) : null,
      userAgent: userAgent ? userAgent.slice(0, 1000) : null,
    });
    res.status(201).json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to record click" });
  }
});

router.get("/clicks/cities", async (_req, res) => {
  try {
    const rows = await db
      .select({
        name: planClicksTable.planPrice,
        total: sql<number>`cast(count(*) as int)`,
        interests: sql<number>`cast(count(*) filter (where ${planClicksTable.source} = 'interest') as int)`,
      })
      .from(planClicksTable)
      .where(eq(planClicksTable.planSpeed, "city"))
      .groupBy(planClicksTable.planPrice)
      .orderBy(desc(sql`count(*)`));
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch city clicks" });
  }
});

router.get("/clicks/stats", requireAdminKey, async (req, res) => {
  try {
    const sinceParam = typeof req.query["since"] === "string" ? req.query["since"] : undefined;
    const untilParam = typeof req.query["until"] === "string" ? req.query["until"] : undefined;
    const sourceParam = typeof req.query["source"] === "string" && req.query["source"].length > 0
      ? req.query["source"]
      : undefined;
    const cityParam = typeof req.query["city"] === "string" && req.query["city"].length > 0
      ? req.query["city"].slice(0, 120)
      : undefined;
    let sinceDate: Date | undefined;
    if (sinceParam) {
      const parsed = new Date(sinceParam);
      if (Number.isNaN(parsed.getTime())) {
        res.status(400).json({ error: "Invalid 'since' parameter; expected ISO 8601 date" });
        return;
      }
      sinceDate = parsed;
    }
    let untilDate: Date | undefined;
    if (untilParam) {
      const parsed = new Date(untilParam);
      if (Number.isNaN(parsed.getTime())) {
        res.status(400).json({ error: "Invalid 'until' parameter; expected ISO 8601 date" });
        return;
      }
      untilDate = parsed;
    }

    const conditions: SQL[] = [];
    if (sinceDate) conditions.push(gte(planClicksTable.clickedAt, sinceDate));
    if (untilDate) conditions.push(lt(planClicksTable.clickedAt, untilDate));
    if (sourceParam) conditions.push(eq(planClicksTable.source, sourceParam));
    if (cityParam) conditions.push(eq(planClicksTable.city, cityParam));

    const baseSelect = db
      .select({
        planSpeed: planClicksTable.planSpeed,
        planPrice: planClicksTable.planPrice,
        source: planClicksTable.source,
        total: sql<number>`cast(count(*) as int)`,
        lastClickedAt: sql<string>`max(${planClicksTable.clickedAt})`,
      })
      .from(planClicksTable);

    const filtered = conditions.length > 0
      ? baseSelect.where(conditions.length === 1 ? conditions[0]! : and(...conditions))
      : baseSelect;

    const stats = await filtered
      .groupBy(planClicksTable.planSpeed, planClicksTable.planPrice, planClicksTable.source)
      .orderBy(desc(sql`count(*)`));
    res.json(stats);
  } catch {
    res.status(500).json({ error: "Failed to fetch click stats" });
  }
});

router.get("/clicks/timeseries", requireAdminKey, async (req, res) => {
  try {
    const sinceParam = typeof req.query["since"] === "string" ? req.query["since"] : undefined;
    const untilParam = typeof req.query["until"] === "string" ? req.query["until"] : undefined;
    const sourceParam = typeof req.query["source"] === "string" && req.query["source"].length > 0
      ? req.query["source"]
      : undefined;
    const cityParam = typeof req.query["city"] === "string" && req.query["city"].length > 0
      ? req.query["city"].slice(0, 120)
      : undefined;
    const planSpeedParam = typeof req.query["planSpeed"] === "string" && req.query["planSpeed"].length > 0
      ? req.query["planSpeed"].slice(0, 120)
      : undefined;
    const planPriceParam = typeof req.query["planPrice"] === "string" && req.query["planPrice"].length > 0
      ? req.query["planPrice"].slice(0, 120)
      : undefined;
    const bucketParam = typeof req.query["bucket"] === "string" ? req.query["bucket"] : "day";
    const bucket = bucketParam === "hour" ? "hour" : "day";

    let sinceDate: Date | undefined;
    if (sinceParam) {
      const parsed = new Date(sinceParam);
      if (Number.isNaN(parsed.getTime())) {
        res.status(400).json({ error: "Invalid 'since' parameter; expected ISO 8601 date" });
        return;
      }
      sinceDate = parsed;
    }
    let untilDate: Date | undefined;
    if (untilParam) {
      const parsed = new Date(untilParam);
      if (Number.isNaN(parsed.getTime())) {
        res.status(400).json({ error: "Invalid 'until' parameter; expected ISO 8601 date" });
        return;
      }
      untilDate = parsed;
    }

    const conditions: SQL[] = [];
    if (sinceDate) conditions.push(gte(planClicksTable.clickedAt, sinceDate));
    if (untilDate) conditions.push(lt(planClicksTable.clickedAt, untilDate));
    if (sourceParam) conditions.push(eq(planClicksTable.source, sourceParam));
    if (cityParam) {
      conditions.push(eq(planClicksTable.city, cityParam));
    }
    if (planSpeedParam) {
      conditions.push(eq(planClicksTable.planSpeed, planSpeedParam));
    }
    if (planPriceParam) {
      conditions.push(eq(planClicksTable.planPrice, planPriceParam));
    }

    const bucketExpr = bucket === "hour"
      ? sql<string>`date_trunc('hour', ${planClicksTable.clickedAt})`
      : sql<string>`date_trunc('day', ${planClicksTable.clickedAt})`;

    const baseSelect = db
      .select({
        bucket: bucketExpr,
        planSpeed: planClicksTable.planSpeed,
        planPrice: planClicksTable.planPrice,
        source: planClicksTable.source,
        total: sql<number>`cast(count(*) as int)`,
      })
      .from(planClicksTable);

    const filtered = conditions.length > 0
      ? baseSelect.where(conditions.length === 1 ? conditions[0]! : and(...conditions))
      : baseSelect;

    const rows = await filtered
      .groupBy(bucketExpr, planClicksTable.planSpeed, planClicksTable.planPrice, planClicksTable.source)
      .orderBy(bucketExpr);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch click timeseries" });
  }
});

router.get("/clicks/cities-conversion", requireAdminKey, async (req, res) => {
  try {
    const sinceParam = typeof req.query["since"] === "string" ? req.query["since"] : undefined;
    const untilParam = typeof req.query["until"] === "string" ? req.query["until"] : undefined;
    let sinceDate: Date | undefined;
    if (sinceParam) {
      const parsed = new Date(sinceParam);
      if (Number.isNaN(parsed.getTime())) {
        res.status(400).json({ error: "Invalid 'since' parameter; expected ISO 8601 date" });
        return;
      }
      sinceDate = parsed;
    }
    let untilDate: Date | undefined;
    if (untilParam) {
      const parsed = new Date(untilParam);
      if (Number.isNaN(parsed.getTime())) {
        res.status(400).json({ error: "Invalid 'until' parameter; expected ISO 8601 date" });
        return;
      }
      untilDate = parsed;
    }

    const conditions: SQL[] = [];
    if (sinceDate) conditions.push(gte(planClicksTable.clickedAt, sinceDate));
    if (untilDate) conditions.push(lt(planClicksTable.clickedAt, untilDate));

    const previewExpr = sql<number>`cast(count(*) filter (where ${planClicksTable.source} = 'whatsapp-share' or ${planClicksTable.source} like 'whatsapp-share:%') as int)`;
    const signupExpr = sql<number>`cast(count(*) filter (where ${planClicksTable.source} not like 'whatsapp-share%') as int)`;

    const baseSelect = db
      .select({
        city: planClicksTable.city,
        previews: previewExpr,
        signups: signupExpr,
      })
      .from(planClicksTable);

    const filtered = conditions.length > 0
      ? baseSelect.where(conditions.length === 1 ? conditions[0]! : and(...conditions))
      : baseSelect;

    const rows = await filtered.groupBy(planClicksTable.city);
    const cleaned = rows
      .filter((r) => r.city != null && r.city.length > 0)
      .map((r) => ({ city: r.city as string, previews: r.previews, signups: r.signups }));
    res.json(cleaned);
  } catch {
    res.status(500).json({ error: "Failed to fetch city conversion stats" });
  }
});

router.get("/clicks/preview-health", requireAdminKey, async (_req, res) => {
  try {
    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const isHumanPreview = sql`(${planClicksTable.source} = 'whatsapp-share' or ${planClicksTable.source} like 'whatsapp-share:%')`;
    const isBotPreview = sql`${planClicksTable.source} like 'whatsapp-share-bot%'`;

    const [counts] = await db
      .select({
        humanPreviews24h: sql<number>`cast(count(*) filter (where ${isHumanPreview} and ${planClicksTable.clickedAt} >= ${since24h}) as int)`,
        botPreviews24h: sql<number>`cast(count(*) filter (where ${isBotPreview} and ${planClicksTable.clickedAt} >= ${since24h}) as int)`,
        lastHumanPreviewAt: sql<string | null>`max(${planClicksTable.clickedAt}) filter (where ${isHumanPreview})`,
        lastBotFetchAt: sql<string | null>`max(${planClicksTable.clickedAt}) filter (where ${isBotPreview})`,
      })
      .from(planClicksTable);

    res.json({
      humanPreviews24h: counts?.humanPreviews24h ?? 0,
      botPreviews24h: counts?.botPreviews24h ?? 0,
      lastHumanPreviewAt: counts?.lastHumanPreviewAt ?? null,
      lastBotFetchAt: counts?.lastBotFetchAt ?? null,
      checkedAt: now.toISOString(),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch preview health" });
  }
});

router.get("/clicks/cleanup-status", requireAdminKey, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, BOT_CLEANUP_STATUS_KEY))
      .limit(1);
    const row = rows[0];
    if (!row) {
      res.json({ status: null });
      return;
    }
    let status: BotCleanupStatus | null = null;
    try {
      status = JSON.parse(row.value) as BotCleanupStatus;
    } catch {
      status = null;
    }
    res.json({ status, recordedAt: row.updatedAt });
  } catch {
    res.status(500).json({ error: "Failed to fetch cleanup status" });
  }
});

router.get("/clicks/sources", requireAdminKey, async (_req, res) => {
  try {
    const rows = await db
      .select({
        source: planClicksTable.source,
        total: sql<number>`cast(count(*) as int)`,
      })
      .from(planClicksTable)
      .groupBy(planClicksTable.source)
      .orderBy(desc(sql`count(*)`));
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch click sources" });
  }
});

router.get("/clicks/export/raw", requireAdminKey, async (req, res) => {
  try {
    const sinceParam = typeof req.query["since"] === "string" ? req.query["since"] : undefined;
    const untilParam = typeof req.query["until"] === "string" ? req.query["until"] : undefined;
    const cityParam = typeof req.query["city"] === "string" && req.query["city"].length > 0
      ? req.query["city"].slice(0, 120)
      : undefined;
    let sinceDate: Date | undefined;
    if (sinceParam) {
      const parsed = new Date(sinceParam);
      if (Number.isNaN(parsed.getTime())) {
        res.status(400).json({ error: "Invalid 'since' parameter; expected ISO 8601 date" });
        return;
      }
      sinceDate = parsed;
    }
    let untilDate: Date | undefined;
    if (untilParam) {
      const parsed = new Date(untilParam);
      if (Number.isNaN(parsed.getTime())) {
        res.status(400).json({ error: "Invalid 'until' parameter; expected ISO 8601 date" });
        return;
      }
      untilDate = parsed;
    }

    const conditions: SQL[] = [];
    if (sinceDate) conditions.push(gte(planClicksTable.clickedAt, sinceDate));
    if (untilDate) conditions.push(lt(planClicksTable.clickedAt, untilDate));
    if (cityParam) conditions.push(eq(planClicksTable.city, cityParam));

    const baseSelect = db
      .select({
        clickedAt: planClicksTable.clickedAt,
        planSpeed: planClicksTable.planSpeed,
        planPrice: planClicksTable.planPrice,
        source: planClicksTable.source,
      })
      .from(planClicksTable);

    const filtered = conditions.length > 0
      ? baseSelect.where(conditions.length === 1 ? conditions[0]! : and(...conditions))
      : baseSelect;

    const rows = await filtered.orderBy(desc(planClicksTable.clickedAt));

    const escape = (val: string | number | Date | null | undefined): string => {
      let s = val == null ? "" : val instanceof Date ? val.toISOString() : String(val);
      if (s.length > 0 && /^[=+\-@\t\r]/.test(s)) {
        s = `'${s}`;
      }
      if (/[",\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const header = "clicked_at,plan_speed,plan_price,source";
    const body = rows
      .map((r) =>
        [escape(r.clickedAt), escape(r.planSpeed), escape(r.planPrice), escape(r.source)].join(","),
      )
      .join("\n");
    const csv = `${header}\n${body}${body ? "\n" : ""}`;

    const stamp = new Date().toISOString().slice(0, 10);
    let filename = `clicks-raw-${stamp}.csv`;
    if (cityParam) {
      const citySlug = cityParam
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "city";
      filename = `clicks-raw-${citySlug}-${stamp}.csv`;
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch {
    res.status(500).json({ error: "Failed to export raw clicks" });
  }
});

router.get("/clicks/export", requireAdminKey, async (req, res) => {
  try {
    const sinceParam = typeof req.query["since"] === "string" ? req.query["since"] : undefined;
    const untilParam = typeof req.query["until"] === "string" ? req.query["until"] : undefined;
    const cityParam = typeof req.query["city"] === "string" && req.query["city"].length > 0
      ? req.query["city"].slice(0, 120)
      : undefined;
    let sinceDate: Date | undefined;
    if (sinceParam) {
      const parsed = new Date(sinceParam);
      if (Number.isNaN(parsed.getTime())) {
        res.status(400).json({ error: "Invalid 'since' parameter; expected ISO 8601 date" });
        return;
      }
      sinceDate = parsed;
    }
    let untilDate: Date | undefined;
    if (untilParam) {
      const parsed = new Date(untilParam);
      if (Number.isNaN(parsed.getTime())) {
        res.status(400).json({ error: "Invalid 'until' parameter; expected ISO 8601 date" });
        return;
      }
      untilDate = parsed;
    }

    const conditions: SQL[] = [];
    if (sinceDate) conditions.push(gte(planClicksTable.clickedAt, sinceDate));
    if (untilDate) conditions.push(lt(planClicksTable.clickedAt, untilDate));
    if (cityParam) conditions.push(eq(planClicksTable.city, cityParam));

    const baseSelect = db
      .select({
        planSpeed: planClicksTable.planSpeed,
        planPrice: planClicksTable.planPrice,
        source: planClicksTable.source,
        total: sql<number>`cast(count(*) as int)`,
        lastClickedAt: sql<string>`max(${planClicksTable.clickedAt})`,
      })
      .from(planClicksTable);

    const filtered = conditions.length > 0
      ? baseSelect.where(conditions.length === 1 ? conditions[0]! : and(...conditions))
      : baseSelect;

    const rows = await filtered
      .groupBy(planClicksTable.planSpeed, planClicksTable.planPrice, planClicksTable.source)
      .orderBy(desc(sql`count(*)`));

    const escape = (val: string | number | null | undefined): string => {
      let s = val == null ? "" : String(val);
      if (s.length > 0 && /^[=+\-@\t\r]/.test(s)) {
        s = `'${s}`;
      }
      if (/[",\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const header = "plan_speed,plan_price,source,total_clicks,last_click_date";
    const body = rows
      .map((r) =>
        [escape(r.planSpeed), escape(r.planPrice), escape(r.source), escape(r.total), escape(r.lastClickedAt)].join(","),
      )
      .join("\n");
    const csv = `${header}\n${body}${body ? "\n" : ""}`;

    let filename: string;
    if (sinceDate && untilDate) {
      const fromStamp = sinceDate.toISOString().slice(0, 10);
      const toDate = new Date(untilDate.getTime() - 1);
      const toStamp = toDate.toISOString().slice(0, 10);
      filename = `clicks-${fromStamp}_to_${toStamp}.csv`;
    } else if (sinceDate) {
      const fromStamp = sinceDate.toISOString().slice(0, 10);
      const toStamp = new Date().toISOString().slice(0, 10);
      filename = `clicks-${fromStamp}_to_${toStamp}.csv`;
    } else if (untilDate) {
      const toDate = new Date(untilDate.getTime() - 1);
      const toStamp = toDate.toISOString().slice(0, 10);
      filename = `clicks-until-${toStamp}.csv`;
    } else {
      const stamp = new Date().toISOString().slice(0, 10);
      filename = `clicks-${stamp}.csv`;
    }
    if (cityParam) {
      const citySlug = cityParam
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "city";
      filename = filename.replace(/^clicks-/, `clicks-${citySlug}-`);
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch {
    res.status(500).json({ error: "Failed to export clicks" });
  }
});

export default router;
