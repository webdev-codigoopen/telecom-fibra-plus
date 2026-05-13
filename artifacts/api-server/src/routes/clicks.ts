import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, planClicksTable, appSettingsTable, botCleanupRunsTable } from "@workspace/db";
import { and, desc, eq, gte, isNotNull, lt, sql, type SQL } from "drizzle-orm";
import { requireAdmin as requireAdminKey } from "../lib/auth";
import {
  BOT_CLEANUP_STATUS_KEY,
  type BotCleanupStatus,
  runBotClickBackfillTick,
} from "../lib/botClickBackfillScheduler";
import { extractClientIp, hashIp, lookupGeo, countryNameFor } from "../lib/geoip";

const router: IRouter = Router();

const BOT_UA_SQL_PATTERN =
  "facebookexternalhit|facebookcatalog|facebot|twitterbot|slackbot|slack-imgproxy|linkedinbot|discordbot|telegrambot|skypeuripreview|pinterest|embedly|quora link preview|vkshare|w3c_validator|redditbot|applebot|bingpreview|googlebot|google-inspectiontool|googleother|yandexbot|duckduckbot|baiduspider|petalbot|chatgpt-user|gptbot|oai-searchbot|perplexitybot|claudebot|anthropic-ai|bytespider";

// Mirrors isBotUserAgent() in routes/plans.ts and the backfill script.
// A click is bot-flagged if EITHER the live UA matches a known crawler / bare
// WhatsApp link-preview UA, OR the source was already labeled as a bot
// (whatsapp-share-bot*) by the backfill cleanup.
const isBotSqlExpr = sql<boolean>`(
  ${planClicksTable.source} like 'whatsapp-share-bot%'
  or (
    ${planClicksTable.userAgent} is not null
    and (
      ${planClicksTable.userAgent} ~* ${BOT_UA_SQL_PATTERN}
      or (
        ${planClicksTable.userAgent} ~* '\\mWhatsApp/[0-9.]+'
        and ${planClicksTable.userAgent} !~* 'Mozilla|AppleWebKit|Chrome|Safari'
      )
    )
  )
)`;

router.post("/clicks", async (req, res) => {
  const { planSpeed, planPrice, source, city } = req.body ?? {};
  if (!planSpeed || !planPrice) {
    res.status(400).json({ error: "planSpeed and planPrice are required" });
    return;
  }
  try {
    const userAgent = req.get("user-agent");
    const ip = extractClientIp(req);
    const geo = lookupGeo(ip);
    await db.insert(planClicksTable).values({
      planSpeed: String(planSpeed),
      planPrice: String(planPrice),
      source: source ? String(source) : "hero",
      city: city ? String(city).slice(0, 120) : null,
      userAgent: userAgent ? userAgent.slice(0, 1000) : null,
      ipHash: hashIp(ip),
      countryCode: geo.countryCode,
      countryName: geo.countryName,
      geoRegion: geo.region,
      geoCity: geo.city,
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

router.get("/clicks/cleanup-status", requireAdminKey, async (req, res) => {
  try {
    const limitParam = typeof req.query["historyLimit"] === "string"
      ? Number.parseInt(req.query["historyLimit"], 10)
      : NaN;
    const historyLimit = Number.isFinite(limitParam)
      ? Math.min(50, Math.max(1, limitParam))
      : 7;

    const historyRows = await db
      .select()
      .from(botCleanupRunsTable)
      .orderBy(desc(botCleanupRunsTable.finishedAt))
      .limit(historyLimit);

    const history = historyRows.map((r) => ({
      id: r.id,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt.toISOString(),
      durationMs: r.durationMs,
      ok: r.ok,
      rowsRelabeled: r.rowsRelabeled,
      rowsRelabeledByUserAgent: r.rowsRelabeledByUserAgent,
      burstGroupsFound: r.burstGroupsFound,
      windowSeconds: r.windowSeconds,
      minBurst: r.minBurst,
      useUserAgent: r.useUserAgent,
      trigger: r.trigger,
      error: r.error,
    }));

    if (history.length > 0) {
      const latest = history[0]!;
      const status: BotCleanupStatus = {
        startedAt: latest.startedAt,
        finishedAt: latest.finishedAt,
        durationMs: latest.durationMs,
        ok: latest.ok,
        rowsRelabeled: latest.rowsRelabeled,
        rowsRelabeledByUserAgent: latest.rowsRelabeledByUserAgent,
        burstGroupsFound: latest.burstGroupsFound,
        windowSeconds: latest.windowSeconds,
        minBurst: latest.minBurst,
        useUserAgent: latest.useUserAgent,
        trigger: latest.trigger as "manual" | "scheduled",
        error: latest.error,
      };
      res.json({ status, recordedAt: latest.finishedAt, history });
      return;
    }

    // Fallback: legacy single-row state in app_settings (pre-history rollout)
    const rows = await db
      .select()
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, BOT_CLEANUP_STATUS_KEY))
      .limit(1);
    const row = rows[0];
    if (!row) {
      res.json({ status: null, history: [] });
      return;
    }
    let status: BotCleanupStatus | null = null;
    try {
      status = JSON.parse(row.value) as BotCleanupStatus;
    } catch {
      status = null;
    }
    res.json({ status, recordedAt: row.updatedAt, history: [] });
  } catch {
    res.status(500).json({ error: "Failed to fetch cleanup status" });
  }
});

router.post("/clicks/cleanup-run", requireAdminKey, async (_req, res) => {
  try {
    const result = await runBotClickBackfillTick({ trigger: "manual" });
    if (result.skipped) {
      res.status(409).json({
        skipped: true,
        error: "A cleanup is already running. Try again in a moment.",
      });
      return;
    }
    res.json({ skipped: false, status: result.status });
  } catch {
    res.status(500).json({ error: "Failed to run cleanup" });
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

router.get("/clicks/bot-summary", requireAdminKey, async (req, res) => {
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

    const isSharePage = sql`(${planClicksTable.source} = 'whatsapp-share' or ${planClicksTable.source} like 'whatsapp-share:%' or ${planClicksTable.source} like 'whatsapp-share-bot%')`;

    const baseSelect = db
      .select({
        sharePageBots: sql<number>`cast(count(*) filter (where ${isSharePage} and ${isBotSqlExpr}) as int)`,
        sharePageHumans: sql<number>`cast(count(*) filter (where ${isSharePage} and not ${isBotSqlExpr}) as int)`,
        otherBots: sql<number>`cast(count(*) filter (where not ${isSharePage} and ${isBotSqlExpr}) as int)`,
        otherHumans: sql<number>`cast(count(*) filter (where not ${isSharePage} and not ${isBotSqlExpr}) as int)`,
      })
      .from(planClicksTable);

    const filtered = conditions.length > 0
      ? baseSelect.where(conditions.length === 1 ? conditions[0]! : and(...conditions))
      : baseSelect;

    const [row] = await filtered;
    res.json({
      sharePageBots: row?.sharePageBots ?? 0,
      sharePageHumans: row?.sharePageHumans ?? 0,
      otherBots: row?.otherBots ?? 0,
      otherHumans: row?.otherHumans ?? 0,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch bot summary" });
  }
});

router.get("/clicks/top-countries", requireAdminKey, async (req, res) => {
  try {
    const sinceParam = typeof req.query["since"] === "string" ? req.query["since"] : undefined;
    const untilParam = typeof req.query["until"] === "string" ? req.query["until"] : undefined;
    const cityParam = typeof req.query["city"] === "string" && req.query["city"].length > 0
      ? req.query["city"].slice(0, 120)
      : undefined;
    const limitRaw = typeof req.query["limit"] === "string" ? Number(req.query["limit"]) : 8;
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, Math.floor(limitRaw))) : 8;

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

    // Aggregate totals over the full filter (not just the top-N), so the UI
    // can show accurate "X de Y identificados" coverage even when there are
    // many small countries beyond the limit.
    const totalsSelect = db
      .select({
        totalAll: sql<number>`cast(count(*) as int)`,
        totalIdentified: sql<number>`cast(count(*) filter (where ${planClicksTable.countryCode} is not null) as int)`,
      })
      .from(planClicksTable);
    const totalsFiltered = conditions.length > 0
      ? totalsSelect.where(conditions.length === 1 ? conditions[0]! : and(...conditions))
      : totalsSelect;
    const [totalsRow] = await totalsFiltered;
    const totalAll = totalsRow?.totalAll ?? 0;
    const totalIdentified = totalsRow?.totalIdentified ?? 0;

    const groupConditions = [...conditions, isNotNull(planClicksTable.countryCode)];
    const grouped = db
      .select({
        countryCode: planClicksTable.countryCode,
        countryName: planClicksTable.countryName,
        humans: sql<number>`cast(count(*) filter (where not ${isBotSqlExpr}) as int)`,
        bots: sql<number>`cast(count(*) filter (where ${isBotSqlExpr}) as int)`,
        total: sql<number>`cast(count(*) as int)`,
      })
      .from(planClicksTable)
      .where(groupConditions.length === 1 ? groupConditions[0]! : and(...groupConditions))
      .groupBy(planClicksTable.countryCode, planClicksTable.countryName)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);

    const rows = await grouped;
    const cleaned = rows.map((r) => ({
      countryCode: r.countryCode,
      countryName: r.countryName ?? countryNameFor(r.countryCode),
      humans: r.humans,
      bots: r.bots,
      total: r.total,
    }));
    res.json({
      rows: cleaned,
      totalAll,
      totalIdentified,
      totalUnknown: Math.max(0, totalAll - totalIdentified),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch top countries" });
  }
});

router.get("/clicks/recent", requireAdminKey, async (req, res) => {
  try {
    const sinceParam = typeof req.query["since"] === "string" ? req.query["since"] : undefined;
    const untilParam = typeof req.query["until"] === "string" ? req.query["until"] : undefined;
    const cityParam = typeof req.query["city"] === "string" && req.query["city"].length > 0
      ? req.query["city"].slice(0, 120)
      : undefined;
    const sourceParam = typeof req.query["source"] === "string" && req.query["source"].length > 0
      ? req.query["source"]
      : undefined;
    const kindParam = typeof req.query["kind"] === "string" ? req.query["kind"] : undefined;
    const qParam = typeof req.query["q"] === "string" && req.query["q"].length > 0
      ? req.query["q"].slice(0, 200)
      : undefined;
    const limitRaw = typeof req.query["limit"] === "string" ? Number(req.query["limit"]) : 100;
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.floor(limitRaw))) : 100;

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
    if (sourceParam) conditions.push(eq(planClicksTable.source, sourceParam));
    if (kindParam === "bots") {
      conditions.push(sql`${isBotSqlExpr}`);
    } else if (kindParam === "humans") {
      conditions.push(sql`not ${isBotSqlExpr}`);
    }
    if (qParam) {
      conditions.push(sql`${planClicksTable.userAgent} ilike ${"%" + qParam + "%"}`);
    }

    const baseSelect = db
      .select({
        id: planClicksTable.id,
        clickedAt: planClicksTable.clickedAt,
        planSpeed: planClicksTable.planSpeed,
        planPrice: planClicksTable.planPrice,
        source: planClicksTable.source,
        city: planClicksTable.city,
        userAgent: planClicksTable.userAgent,
        countryCode: planClicksTable.countryCode,
        countryName: planClicksTable.countryName,
        geoRegion: planClicksTable.geoRegion,
        geoCity: planClicksTable.geoCity,
        isBot: isBotSqlExpr,
      })
      .from(planClicksTable);

    const filtered = conditions.length > 0
      ? baseSelect.where(conditions.length === 1 ? conditions[0]! : and(...conditions))
      : baseSelect;

    const rows = await filtered
      .orderBy(desc(planClicksTable.clickedAt))
      .limit(limit);
    res.json({ rows, limit });
  } catch {
    res.status(500).json({ error: "Failed to fetch recent clicks" });
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
        city: planClicksTable.city,
        userAgent: planClicksTable.userAgent,
        countryCode: planClicksTable.countryCode,
        countryName: planClicksTable.countryName,
        geoRegion: planClicksTable.geoRegion,
        geoCity: planClicksTable.geoCity,
        isBot: isBotSqlExpr,
      })
      .from(planClicksTable);

    const filtered = conditions.length > 0
      ? baseSelect.where(conditions.length === 1 ? conditions[0]! : and(...conditions))
      : baseSelect;

    const rows = await filtered.orderBy(desc(planClicksTable.clickedAt));

    const escape = (val: string | number | boolean | Date | null | undefined): string => {
      let s = val == null ? "" : val instanceof Date ? val.toISOString() : String(val);
      if (s.length > 0 && /^[=+\-@\t\r]/.test(s)) {
        s = `'${s}`;
      }
      if (/[",\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const header = "clicked_at,plan_speed,plan_price,source,city,country_code,country_name,geo_region,geo_city,is_bot,user_agent";
    const body = rows
      .map((r) =>
        [
          escape(r.clickedAt),
          escape(r.planSpeed),
          escape(r.planPrice),
          escape(r.source),
          escape(r.city),
          escape(r.countryCode),
          escape(r.countryName),
          escape(r.geoRegion),
          escape(r.geoCity),
          escape(r.isBot ? "true" : "false"),
          escape(r.userAgent),
        ].join(","),
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
