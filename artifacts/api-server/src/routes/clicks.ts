import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, planClicksTable, appSettingsTable, botCleanupRunsTable } from "@workspace/db";
import { and, desc, eq, gte, isNotNull, lt, sql, type SQL } from "drizzle-orm";
import { requireAdmin as requireAdminKey } from "../lib/auth";
import {
  BOT_CLEANUP_STATUS_KEY,
  type BotCleanupStatus,
  runBotClickBackfillTick,
} from "../lib/botClickBackfillScheduler";
import {
  getBotCleanupAlertHistory,
  sendBotCleanupTestAlert,
} from "../lib/botCleanupAlert";
import { extractClientIp, hashIp, lookupGeo, countryNameFor } from "../lib/geoip";
import {
  getCombinedUaPattern,
  findMatchingPattern,
  matchesWhatsappHeuristic,
} from "../lib/botUaPatterns";

const router: IRouter = Router();

// Mirrors isBotUserAgent() in routes/plans.ts and the backfill script.
// A click is bot-flagged if EITHER the live UA matches a known crawler / bare
// WhatsApp link-preview UA, OR the source was already labeled as a bot
// (whatsapp-share-bot*) by the backfill cleanup. Built dynamically so admin
// edits to the crawler-UA list take effect immediately.
function buildIsBotSqlExpr(): SQL<boolean> {
  const combined = getCombinedUaPattern();
  if (combined) {
    return sql<boolean>`(
      ${planClicksTable.source} like 'whatsapp-share-bot%'
      or (
        ${planClicksTable.userAgent} is not null
        and (
          ${planClicksTable.userAgent} ~* ${combined}
          or (
            ${planClicksTable.userAgent} ~* '\\mWhatsApp/[0-9.]+'
            and ${planClicksTable.userAgent} !~* 'Mozilla|AppleWebKit|Chrome|Safari'
          )
        )
      )
    )`;
  }
  return sql<boolean>`(
    ${planClicksTable.source} like 'whatsapp-share-bot%'
    or (
      ${planClicksTable.userAgent} is not null
      and ${planClicksTable.userAgent} ~* '\\mWhatsApp/[0-9.]+'
      and ${planClicksTable.userAgent} !~* 'Mozilla|AppleWebKit|Chrome|Safari'
    )
  )`;
}

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

router.get(
  "/clicks/cities-persistent-underperformance",
  requireAdminKey,
  async (req, res) => {
    try {
      const periodsRaw = Number(req.query["periods"]);
      const periods = Number.isFinite(periodsRaw)
        ? Math.max(2, Math.min(12, Math.floor(periodsRaw)))
        : 4;
      const periodDaysRaw = Number(req.query["periodDays"]);
      const periodDays = Number.isFinite(periodDaysRaw)
        ? Math.max(1, Math.min(60, Math.floor(periodDaysRaw)))
        : 7;
      const minBelowRaw = Number(req.query["minBelow"]);
      const minBelow = Number.isFinite(minBelowRaw)
        ? Math.max(1, Math.min(periods, Math.floor(minBelowRaw)))
        : Math.min(periods, 3);
      const minPreviewsRaw = Number(req.query["minPreviews"]);
      const minPreviews = Number.isFinite(minPreviewsRaw)
        ? Math.max(1, Math.min(1000, Math.floor(minPreviewsRaw)))
        : 5;
      const defaultTargetRaw = Number(req.query["defaultTargetPct"]);
      const defaultTargetPct =
        Number.isFinite(defaultTargetRaw) &&
        defaultTargetRaw > 0 &&
        defaultTargetRaw <= 100
          ? defaultTargetRaw
          : null;

      const now = new Date();
      const totalDays = periodDays * periods;
      const since = new Date(now.getTime() - totalDays * 86400 * 1000);

      // Bucket index 0 = most recent period, periods-1 = oldest.
      const bucketExpr = sql<number>`cast(floor(extract(epoch from (${now} - ${planClicksTable.clickedAt})) / ${periodDays * 86400}) as int)`;
      const previewExpr = sql<number>`cast(count(*) filter (where ${planClicksTable.source} = 'whatsapp-share' or ${planClicksTable.source} like 'whatsapp-share:%') as int)`;
      const signupExpr = sql<number>`cast(count(*) filter (where ${planClicksTable.source} not like 'whatsapp-share%') as int)`;

      const rows = await db
        .select({
          city: planClicksTable.city,
          bucket: bucketExpr,
          previews: previewExpr,
          signups: signupExpr,
        })
        .from(planClicksTable)
        .where(
          and(
            gte(planClicksTable.clickedAt, since),
            lt(planClicksTable.clickedAt, now),
            isNotNull(planClicksTable.city),
          ),
        )
        .groupBy(planClicksTable.city, bucketExpr);

      // Load per-city targets from app_settings (shared with /admin/map-per-city-targets).
      const settingsRows = await db
        .select()
        .from(appSettingsTable)
        .where(eq(appSettingsTable.key, "map_per_city_targets"))
        .limit(1);
      const perCityTargets: Record<string, number> = {};
      const rawSetting = settingsRows[0]?.value;
      if (rawSetting) {
        try {
          const parsed = JSON.parse(rawSetting) as unknown;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            for (const [k, v] of Object.entries(
              parsed as Record<string, unknown>,
            )) {
              const n = Number(v);
              if (
                typeof k === "string" &&
                k &&
                Number.isFinite(n) &&
                n > 0 &&
                n <= 100
              ) {
                perCityTargets[k] = n;
              }
            }
          }
        } catch {
          // ignore malformed setting
        }
      }

      type PerPeriod = {
        index: number;
        since: string;
        until: string;
        previews: number;
        signups: number;
        ratePct: number | null;
        eligible: boolean;
        below: boolean | null;
      };

      const windows: { since: string; until: string }[] = [];
      for (let i = 0; i < periods; i++) {
        const wUntil = new Date(now.getTime() - i * periodDays * 86400 * 1000);
        const wSince = new Date(
          wUntil.getTime() - periodDays * 86400 * 1000,
        );
        windows.push({ since: wSince.toISOString(), until: wUntil.toISOString() });
      }

      type CityAgg = Map<number, { previews: number; signups: number }>;
      const byCity = new Map<string, CityAgg>();
      for (const r of rows) {
        if (!r.city) continue;
        if (r.bucket < 0 || r.bucket >= periods) continue;
        let agg = byCity.get(r.city);
        if (!agg) {
          agg = new Map();
          byCity.set(r.city, agg);
        }
        const cur = agg.get(r.bucket) ?? { previews: 0, signups: 0 };
        cur.previews += r.previews;
        cur.signups += r.signups;
        agg.set(r.bucket, cur);
      }

      const out = [];
      for (const [city, agg] of byCity.entries()) {
        const override = perCityTargets[city];
        const isPerCityTarget =
          Number.isFinite(override) && (override as number) > 0;
        const targetPct = isPerCityTarget
          ? (override as number)
          : defaultTargetPct;
        if (targetPct == null) continue;

        const perPeriod: PerPeriod[] = [];
        let periodsBelow = 0;
        let periodsEligible = 0;
        for (let i = 0; i < periods; i++) {
          const w = windows[i]!;
          const v = agg.get(i) ?? { previews: 0, signups: 0 };
          const eligible = v.previews >= minPreviews;
          const ratePct = v.previews > 0 ? (v.signups / v.previews) * 100 : null;
          let below: boolean | null = null;
          if (eligible && ratePct != null) {
            below = ratePct < targetPct;
            periodsEligible += 1;
            if (below) periodsBelow += 1;
          }
          perPeriod.push({
            index: i,
            since: w.since,
            until: w.until,
            previews: v.previews,
            signups: v.signups,
            ratePct,
            eligible,
            below,
          });
        }

        // Current consecutive streak = how many of the most recent
        // *eligible* weeks were below target, walking from newest (index 0)
        // backwards, stopping at the first eligible non-below week.
        // Ineligible weeks (too few previews) are skipped so a quiet week
        // doesn't artificially break the streak.
        let consecutiveBelow = 0;
        for (let i = 0; i < perPeriod.length; i++) {
          const p = perPeriod[i]!;
          if (!p.eligible || p.below === null) continue;
          if (p.below) consecutiveBelow += 1;
          else break;
        }

        if (periodsBelow < minBelow) continue;

        const recent = perPeriod[0]!;
        out.push({
          city,
          targetPct,
          isPerCityTarget,
          periodsBelow,
          periodsEligible,
          consecutiveBelow,
          currentRatePct: recent.ratePct,
          currentPreviews: recent.previews,
          currentSignups: recent.signups,
          perPeriod,
        });
      }

      out.sort((a, b) => {
        if (b.periodsBelow !== a.periodsBelow)
          return b.periodsBelow - a.periodsBelow;
        if (b.consecutiveBelow !== a.consecutiveBelow)
          return b.consecutiveBelow - a.consecutiveBelow;
        return a.city.localeCompare(b.city, "pt-BR");
      });

      res.json({
        periods,
        periodDays,
        minBelow,
        minPreviews,
        defaultTargetPct,
        windows,
        rows: out,
      });
    } catch {
      res
        .status(500)
        .json({ error: "Failed to fetch persistent underperformance" });
    }
  },
);

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

    const triggerParamRaw = typeof req.query["trigger"] === "string"
      ? req.query["trigger"].toLowerCase()
      : "";
    const triggerFilter: "manual" | "scheduled" | null =
      triggerParamRaw === "manual" || triggerParamRaw === "scheduled"
        ? triggerParamRaw
        : null;

    // Fetch enough recent runs to cover `historyLimit` distinct calendar days
    // even when there are many manual re-runs in a single day. We cap the
    // raw fetch generously so a busy day doesn't push older days off the chart.
    const rawFetchLimit = Math.min(500, Math.max(historyLimit * 20, 50));
    const baseQuery = db
      .select()
      .from(botCleanupRunsTable);
    const filteredQuery = triggerFilter
      ? baseQuery.where(eq(botCleanupRunsTable.trigger, triggerFilter))
      : baseQuery;
    const historyRowsRaw = await filteredQuery
      .orderBy(desc(botCleanupRunsTable.finishedAt))
      .limit(rawFetchLimit);

    // Group by calendar day in America/Sao_Paulo (admin's local timezone).
    // For each day, keep the latest run and a count of total runs that day.
    const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    type DayBucket = {
      dayKey: string;
      latest: typeof historyRowsRaw[number];
      runsOnDay: number;
    };
    const dayMap = new Map<string, DayBucket>();
    for (const r of historyRowsRaw) {
      const dayKey = dayKeyFmt.format(r.finishedAt);
      const existing = dayMap.get(dayKey);
      if (!existing) {
        dayMap.set(dayKey, { dayKey, latest: r, runsOnDay: 1 });
      } else {
        existing.runsOnDay += 1;
        if (r.finishedAt.getTime() > existing.latest.finishedAt.getTime()) {
          existing.latest = r;
        }
      }
    }
    const collapsed = Array.from(dayMap.values())
      .sort((a, b) => b.latest.finishedAt.getTime() - a.latest.finishedAt.getTime())
      .slice(0, historyLimit);

    const history = collapsed.map(({ latest: r, runsOnDay }) => ({
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
      runsOnDay,
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

router.get("/clicks/cleanup-alerts", requireAdminKey, async (_req, res) => {
  try {
    const history = await getBotCleanupAlertHistory();
    res.json({ history });
  } catch {
    res.status(500).json({ error: "Failed to fetch cleanup alert history" });
  }
});

router.post("/clicks/cleanup-alerts/test", requireAdminKey, async (_req, res) => {
  try {
    const result = await sendBotCleanupTestAlert();
    if (!result.sent) {
      const messages: Record<string, string> = {
        "email-not-configured":
          "SMTP não está configurado. Preencha as credenciais em Relatórios por e-mail.",
        "no-recipients":
          "Nenhum destinatário configurado para alertas do sistema.",
        "send-failed": "Falha ao enviar o e-mail de teste. Verifique o SMTP.",
      };
      const message = messages[result.reason] ?? `Não foi possível enviar (${result.reason}).`;
      res.status(400).json({ sent: false, reason: result.reason, error: message });
      return;
    }
    res.json({
      sent: true,
      recipients: result.recipients,
      sentAt: result.sentAt,
      subject: result.subject,
    });
  } catch {
    res.status(500).json({ error: "Failed to send test cleanup alert" });
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
    const isBotSqlExpr = buildIsBotSqlExpr();
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
    const isBotSqlExpr = buildIsBotSqlExpr();
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

    // Earliest click that has a country code recorded — anywhere in the table,
    // not just within the current filter window. Used by the admin UI to show
    // a "dados disponíveis a partir de DD/MM/AAAA" disclaimer for older rows
    // that pre-date the geo-tracking rollout.
    const [earliestRow] = await db
      .select({
        earliestGeoAt: sql<string | null>`min(${planClicksTable.clickedAt}) filter (where ${planClicksTable.countryCode} is not null)`,
      })
      .from(planClicksTable);
    const earliestGeoAt = earliestRow?.earliestGeoAt ?? null;

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
      earliestGeoAt,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch top countries" });
  }
});

router.get("/clicks/top-regions", requireAdminKey, async (req, res) => {
  try {
    const isBotSqlExpr = buildIsBotSqlExpr();
    const sinceParam = typeof req.query["since"] === "string" ? req.query["since"] : undefined;
    const untilParam = typeof req.query["until"] === "string" ? req.query["until"] : undefined;
    const cityParam = typeof req.query["city"] === "string" && req.query["city"].length > 0
      ? req.query["city"].slice(0, 120)
      : undefined;
    const limitRaw = typeof req.query["limit"] === "string" ? Number(req.query["limit"]) : 10;
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, Math.floor(limitRaw))) : 10;

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

    // Restrict the totals (and thus the "X de Y" coverage line) to Brazilian
    // clicks so the percentages on the bars are meaningful relative to the BR
    // pie, not to global traffic.
    const brConditions = [...conditions, eq(planClicksTable.countryCode, "BR")];
    const totalsSelect = db
      .select({
        totalAll: sql<number>`cast(count(*) as int)`,
        totalIdentified: sql<number>`cast(count(*) filter (where ${planClicksTable.geoRegion} is not null) as int)`,
      })
      .from(planClicksTable)
      .where(brConditions.length === 1 ? brConditions[0]! : and(...brConditions));
    const [totalsRow] = await totalsSelect;
    const totalAll = totalsRow?.totalAll ?? 0;
    const totalIdentified = totalsRow?.totalIdentified ?? 0;

    const groupConditions = [...brConditions, isNotNull(planClicksTable.geoRegion)];
    // Normalize UF casing server-side so "sp" and "SP" don't fragment into
    // separate buckets if data quality varies across geoip lookups / backfills.
    const regionExpr = sql<string>`upper(${planClicksTable.geoRegion})`;
    const grouped = db
      .select({
        geoRegion: regionExpr,
        humans: sql<number>`cast(count(*) filter (where not ${isBotSqlExpr}) as int)`,
        bots: sql<number>`cast(count(*) filter (where ${isBotSqlExpr}) as int)`,
        total: sql<number>`cast(count(*) as int)`,
      })
      .from(planClicksTable)
      .where(groupConditions.length === 1 ? groupConditions[0]! : and(...groupConditions))
      .groupBy(regionExpr)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);

    const rows = await grouped;
    const cleaned = rows.map((r) => ({
      geoRegion: r.geoRegion,
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
    res.status(500).json({ error: "Failed to fetch top regions" });
  }
});

router.get("/clicks/recent", requireAdminKey, async (req, res) => {
  try {
    const isBotSqlExpr = buildIsBotSqlExpr();
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

    // Annotate each bot-flagged row with *why* it was caught so the admin
    // view can show the matched rule. The DB returns `isBot` as the SQL
    // truth value; we re-derive the reason in JS using the same cached
    // patterns + heuristic the SQL expression uses.
    const annotated = rows.map((r) => {
      let botReason:
        | "pattern"
        | "whatsapp-heuristic"
        | "cleanup-source"
        | null = null;
      let matchedPattern: { id: number; label: string } | null = null;
      if (r.isBot) {
        const ua = r.userAgent ?? "";
        const m = ua ? findMatchingPattern(ua) : null;
        if (m) {
          botReason = "pattern";
          matchedPattern = m;
        } else if (ua && matchesWhatsappHeuristic(ua)) {
          botReason = "whatsapp-heuristic";
        } else if (
          typeof r.source === "string" &&
          r.source.startsWith("whatsapp-share-bot")
        ) {
          botReason = "cleanup-source";
        }
      }
      return { ...r, botReason, matchedPattern };
    });

    res.json({ rows: annotated, limit });
  } catch {
    res.status(500).json({ error: "Failed to fetch recent clicks" });
  }
});

router.get("/clicks/heatmap", requireAdminKey, async (req, res) => {
  try {
    const isBotSqlExpr = buildIsBotSqlExpr();
    const sinceParam = typeof req.query["since"] === "string" ? req.query["since"] : undefined;
    const untilParam = typeof req.query["until"] === "string" ? req.query["until"] : undefined;
    const cityParam = typeof req.query["city"] === "string" && req.query["city"].length > 0
      ? req.query["city"].slice(0, 120)
      : undefined;
    const includeBots = req.query["includeBots"] === "true";
    const tz = typeof req.query["tz"] === "string" && /^[A-Za-z0-9_+\-/]{1,64}$/.test(req.query["tz"])
      ? req.query["tz"]
      : "America/Bahia";
    const sourceParam = typeof req.query["source"] === "string" && req.query["source"].length > 0
      ? req.query["source"].slice(0, 64)
      : undefined;
    const sourcePrefixParam = typeof req.query["sourcePrefix"] === "string" && req.query["sourcePrefix"].length > 0
      ? req.query["sourcePrefix"].slice(0, 64)
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
    if (!includeBots) conditions.push(sql`not ${isBotSqlExpr}`);
    if (sourceParam) conditions.push(eq(planClicksTable.source, sourceParam));
    else if (sourcePrefixParam) {
      const safe = sourcePrefixParam.replace(/[\\%_]/g, (m) => `\\${m}`);
      conditions.push(sql`${planClicksTable.source} like ${safe + "%"}`);
    }

    const localTs = sql<Date>`(${planClicksTable.clickedAt} at time zone ${tz})`;
    const dowExpr = sql<number>`cast(extract(dow from ${localTs}) as int)`;
    const hourExpr = sql<number>`cast(extract(hour from ${localTs}) as int)`;

    const baseSelect = db
      .select({
        dow: dowExpr,
        hour: hourExpr,
        total: sql<number>`cast(count(*) as int)`,
      })
      .from(planClicksTable);

    const filtered = conditions.length > 0
      ? baseSelect.where(conditions.length === 1 ? conditions[0]! : and(...conditions))
      : baseSelect;

    const rows = await filtered.groupBy(dowExpr, hourExpr);
    res.json({
      tz,
      includeBots,
      cells: rows.map((r) => ({ dow: r.dow, hour: r.hour, total: r.total })),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch click heatmap" });
  }
});

router.get("/clicks/export/raw", requireAdminKey, async (req, res) => {
  try {
    const isBotSqlExpr = buildIsBotSqlExpr();
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
