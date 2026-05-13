import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { db, emailReportSubscriptionsTable } from "@workspace/db";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  generateCityComparisonReport,
  reportFilename,
  reportSubject,
  reportToCsv,
  reportToHtml,
} from "../lib/cityComparisonReport";
import { isEmailConfigured, sendEmail } from "../lib/sendEmail";
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

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  frequency: z.enum(["weekly", "monthly"]),
  enabled: z.boolean().optional(),
});

const updateSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254).optional(),
  frequency: z.enum(["weekly", "monthly"]).optional(),
  enabled: z.boolean().optional(),
});

router.get(
  "/email-subscriptions/city-comparison",
  requireAdminKey,
  async (_req, res) => {
    try {
      const rows = await db
        .select()
        .from(emailReportSubscriptionsTable)
        .where(eq(emailReportSubscriptionsTable.reportType, "city_comparison"))
        .orderBy(asc(emailReportSubscriptionsTable.createdAt));
      res.json({ items: rows, emailConfigured: isEmailConfigured() });
    } catch (err) {
      logger.error({ err }, "Failed to list email subscriptions");
      res.status(500).json({ error: "Failed to list email subscriptions" });
    }
  },
);

router.post(
  "/email-subscriptions/city-comparison",
  requireAdminKey,
  async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    try {
      const existing = await db
        .select()
        .from(emailReportSubscriptionsTable)
        .where(
          and(
            eq(emailReportSubscriptionsTable.reportType, "city_comparison"),
            eq(emailReportSubscriptionsTable.email, parsed.data.email),
            eq(emailReportSubscriptionsTable.frequency, parsed.data.frequency),
          ),
        );
      if (existing.length > 0) {
        res.status(409).json({
          error:
            "Já existe uma assinatura com esse e-mail e essa frequência.",
        });
        return;
      }
      const [row] = await db
        .insert(emailReportSubscriptionsTable)
        .values({
          email: parsed.data.email,
          frequency: parsed.data.frequency,
          reportType: "city_comparison",
          enabled: parsed.data.enabled ?? true,
        })
        .returning();
      res.status(201).json(row);
    } catch (err) {
      logger.error({ err }, "Failed to create email subscription");
      res.status(500).json({ error: "Failed to create email subscription" });
    }
  },
);

router.patch(
  "/email-subscriptions/city-comparison/:id",
  requireAdminKey,
  async (req, res) => {
    const id = Number(req.params["id"]);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    try {
      const [row] = await db
        .update(emailReportSubscriptionsTable)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(emailReportSubscriptionsTable.id, id))
        .returning();
      if (!row) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json(row);
    } catch (err) {
      logger.error({ err }, "Failed to update email subscription");
      res.status(500).json({ error: "Failed to update email subscription" });
    }
  },
);

router.delete(
  "/email-subscriptions/city-comparison/:id",
  requireAdminKey,
  async (req, res) => {
    const id = Number(req.params["id"]);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    try {
      await db
        .delete(emailReportSubscriptionsTable)
        .where(eq(emailReportSubscriptionsTable.id, id));
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, "Failed to delete email subscription");
      res.status(500).json({ error: "Failed to delete email subscription" });
    }
  },
);

const sendNowSchema = z.object({
  frequency: z.enum(["weekly", "monthly"]),
});

router.post(
  "/email-subscriptions/city-comparison/:id/send-now",
  requireAdminKey,
  async (req, res) => {
    const id = Number(req.params["id"]);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    if (!isEmailConfigured()) {
      res.status(503).json({
        error:
          "Envio de email não configurado. Defina SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS e SMTP_FROM.",
      });
      return;
    }
    try {
      const [sub] = await db
        .select()
        .from(emailReportSubscriptionsTable)
        .where(eq(emailReportSubscriptionsTable.id, id));
      if (!sub) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const frequencyOverride = sendNowSchema.safeParse(req.body);
      const freq =
        frequencyOverride.success && frequencyOverride.data.frequency
          ? frequencyOverride.data.frequency
          : (sub.frequency as "weekly" | "monthly");
      const now = new Date();
      const report = await generateCityComparisonReport(freq, now);
      const csv = reportToCsv(report);
      const html = reportToHtml(report);
      await sendEmail({
        to: sub.email,
        subject: reportSubject(report),
        html,
        attachments: [
          {
            filename: reportFilename(report),
            content: csv,
            contentType: "text/csv; charset=utf-8",
          },
        ],
      });
      const [updated] = await db
        .update(emailReportSubscriptionsTable)
        .set({ lastSentAt: now, updatedAt: now })
        .where(eq(emailReportSubscriptionsTable.id, id))
        .returning();
      res.json(updated);
    } catch (err) {
      logger.error({ err }, "Failed to send email report now");
      res.status(500).json({
        error:
          "Falha ao enviar email de teste. Verifique as credenciais SMTP e tente novamente.",
      });
    }
  },
);

export default router;
