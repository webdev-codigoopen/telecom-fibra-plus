import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, planClicksTable } from "@workspace/db";
import { and, desc, eq, gte, lt, sql, type SQL } from "drizzle-orm";

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

router.post("/clicks", async (req, res) => {
  const { planSpeed, planPrice, source, city } = req.body ?? {};
  if (!planSpeed || !planPrice) {
    res.status(400).json({ error: "planSpeed and planPrice are required" });
    return;
  }
  try {
    await db.insert(planClicksTable).values({
      planSpeed: String(planSpeed),
      planPrice: String(planPrice),
      source: source ? String(source) : "hero",
      city: city ? String(city).slice(0, 120) : null,
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
    const sourceParam = typeof req.query["source"] === "string" && req.query["source"].length > 0
      ? req.query["source"]
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

    const conditions: SQL[] = [];
    if (sinceDate) conditions.push(gte(planClicksTable.clickedAt, sinceDate));
    if (sourceParam) conditions.push(eq(planClicksTable.source, sourceParam));

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

    const previewExpr = sql<number>`cast(count(*) filter (where ${planClicksTable.source} = 'whatsapp-share') as int)`;
    const signupExpr = sql<number>`cast(count(*) filter (where ${planClicksTable.source} not in ('whatsapp-share', 'whatsapp-share-bot')) as int)`;

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
    let sinceDate: Date | undefined;
    if (sinceParam) {
      const parsed = new Date(sinceParam);
      if (Number.isNaN(parsed.getTime())) {
        res.status(400).json({ error: "Invalid 'since' parameter; expected ISO 8601 date" });
        return;
      }
      sinceDate = parsed;
    }

    const baseSelect = db
      .select({
        clickedAt: planClicksTable.clickedAt,
        planSpeed: planClicksTable.planSpeed,
        planPrice: planClicksTable.planPrice,
        source: planClicksTable.source,
      })
      .from(planClicksTable);

    const filtered = sinceDate
      ? baseSelect.where(gte(planClicksTable.clickedAt, sinceDate))
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
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="clicks-raw-${stamp}.csv"`);
    res.send(csv);
  } catch {
    res.status(500).json({ error: "Failed to export raw clicks" });
  }
});

router.get("/clicks/export", requireAdminKey, async (req, res) => {
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
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch {
    res.status(500).json({ error: "Failed to export clicks" });
  }
});

export default router;
