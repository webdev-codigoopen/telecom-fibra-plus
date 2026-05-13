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
import { requireAdmin as requireAdminKey } from "../lib/auth";
import {
  CITY_BELOW_TARGET_REPORT_TYPE,
  sendBelowTargetDigest,
  type BelowTargetFrequency,
} from "../lib/cityBelowTargetDigest";

const router: IRouter = Router();


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
      res.json({ items: rows, emailConfigured: await isEmailConfigured() });
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

// ---------------------------------------------------------------------------
// Interest notification recipients (multi-recipient version of the single
// `interest_notification_email` setting). Stored in the same table with
// reportType = "interest_notification".
// ---------------------------------------------------------------------------

const interestCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  frequency: z.enum(["instant", "daily", "weekly"]),
  enabled: z.boolean().optional(),
});

const interestUpdateSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254).optional(),
  frequency: z.enum(["instant", "daily", "weekly"]).optional(),
  enabled: z.boolean().optional(),
});

// One-time migration: if no interest_notification rows exist but the legacy
// single-email setting is configured, seed a subscription from it and disable
// the legacy flag so we don't double-send.
async function migrateLegacyInterestEmail(): Promise<void> {
  try {
    const existing = await db
      .select({ id: emailReportSubscriptionsTable.id })
      .from(emailReportSubscriptionsTable)
      .where(eq(emailReportSubscriptionsTable.reportType, "interest_notification"))
      .limit(1);
    if (existing.length > 0) return;
    const { appSettingsTable } = await import("@workspace/db");
    const rows = await db
      .select({ key: appSettingsTable.key, value: appSettingsTable.value })
      .from(appSettingsTable);
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const legacyEmail = (map.get("interest_notification_email") ?? "").trim();
    if (!legacyEmail) return;
    const legacyEnabled =
      (map.get("interest_notification_enabled") ?? "false") === "true";
    const legacyFreqRaw = (map.get("interest_notification_frequency") ?? "instant").trim();
    const frequency: "instant" | "daily" | "weekly" =
      legacyFreqRaw === "daily" || legacyFreqRaw === "weekly"
        ? legacyFreqRaw
        : "instant";
    await db
      .insert(emailReportSubscriptionsTable)
      .values({
        email: legacyEmail.toLowerCase(),
        reportType: "interest_notification",
        frequency,
        enabled: legacyEnabled,
      });
    // Disable the legacy single-email flag so the old code paths stop firing.
    await db
      .insert(appSettingsTable)
      .values({ key: "interest_notification_enabled", value: "false" })
      .onConflictDoUpdate({
        target: appSettingsTable.key,
        set: { value: "false" },
      });
    logger.info(
      { email: legacyEmail, frequency, enabled: legacyEnabled },
      "Migrated legacy interest_notification_email to subscriptions table",
    );
  } catch (err) {
    logger.error({ err }, "Failed to migrate legacy interest notification email");
  }
}

router.get(
  "/email-subscriptions/interest-notification",
  requireAdminKey,
  async (_req, res) => {
    try {
      await migrateLegacyInterestEmail();
      const rows = await db
        .select()
        .from(emailReportSubscriptionsTable)
        .where(eq(emailReportSubscriptionsTable.reportType, "interest_notification"))
        .orderBy(asc(emailReportSubscriptionsTable.createdAt));
      res.json({ items: rows, emailConfigured: await isEmailConfigured() });
    } catch (err) {
      logger.error({ err }, "Failed to list interest notification subscriptions");
      res.status(500).json({ error: "Failed to list interest notification subscriptions" });
    }
  },
);

router.post(
  "/email-subscriptions/interest-notification",
  requireAdminKey,
  async (req, res) => {
    const parsed = interestCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Dados inválidos.", details: parsed.error.flatten() });
      return;
    }
    try {
      const existing = await db
        .select()
        .from(emailReportSubscriptionsTable)
        .where(
          and(
            eq(emailReportSubscriptionsTable.reportType, "interest_notification"),
            eq(emailReportSubscriptionsTable.email, parsed.data.email),
          ),
        );
      if (existing.length > 0) {
        res.status(409).json({
          error: "Esse email já está cadastrado para receber notificações.",
        });
        return;
      }
      const [row] = await db
        .insert(emailReportSubscriptionsTable)
        .values({
          email: parsed.data.email,
          frequency: parsed.data.frequency,
          reportType: "interest_notification",
          enabled: parsed.data.enabled ?? true,
        })
        .returning();
      res.status(201).json(row);
    } catch (err) {
      logger.error({ err }, "Failed to create interest notification subscription");
      res.status(500).json({ error: "Failed to create interest notification subscription" });
    }
  },
);

router.patch(
  "/email-subscriptions/interest-notification/:id",
  requireAdminKey,
  async (req, res) => {
    const id = Number(req.params["id"]);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = interestUpdateSchema.safeParse(req.body);
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      res.status(400).json({ error: "Dados inválidos." });
      return;
    }
    try {
      const [row] = await db
        .update(emailReportSubscriptionsTable)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(
          and(
            eq(emailReportSubscriptionsTable.id, id),
            eq(emailReportSubscriptionsTable.reportType, "interest_notification"),
          ),
        )
        .returning();
      if (!row) {
        res.status(404).json({ error: "Não encontrado." });
        return;
      }
      res.json(row);
    } catch (err) {
      logger.error({ err }, "Failed to update interest notification subscription");
      res.status(500).json({ error: "Failed to update interest notification subscription" });
    }
  },
);

router.delete(
  "/email-subscriptions/interest-notification/:id",
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
        .where(
          and(
            eq(emailReportSubscriptionsTable.id, id),
            eq(emailReportSubscriptionsTable.reportType, "interest_notification"),
          ),
        );
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, "Failed to delete interest notification subscription");
      res.status(500).json({ error: "Failed to delete interest notification subscription" });
    }
  },
);

router.post(
  "/email-subscriptions/city-comparison/:id/send-now",
  requireAdminKey,
  async (req, res) => {
    const id = Number(req.params["id"]);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    if (!(await isEmailConfigured())) {
      res.status(503).json({
        error:
          "Servidor de e-mail (SMTP) não configurado. Preencha no painel, aba 'Relatórios por email'.",
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

// ---------------------------------------------------------------------------
// City "below target" digest subscriptions. Admins opt in here to receive a
// daily/weekly email when one or more cities slip below their conversion
// target. Recipients are stored in the same table with reportType
// "city_below_target".
// ---------------------------------------------------------------------------

const belowTargetCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  frequency: z.enum(["daily", "weekly"]),
  enabled: z.boolean().optional(),
});

const belowTargetUpdateSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254).optional(),
  frequency: z.enum(["daily", "weekly"]).optional(),
  enabled: z.boolean().optional(),
});

router.get(
  "/email-subscriptions/city-below-target",
  requireAdminKey,
  async (_req, res) => {
    try {
      const rows = await db
        .select()
        .from(emailReportSubscriptionsTable)
        .where(
          eq(emailReportSubscriptionsTable.reportType, CITY_BELOW_TARGET_REPORT_TYPE),
        )
        .orderBy(asc(emailReportSubscriptionsTable.createdAt));
      res.json({ items: rows, emailConfigured: await isEmailConfigured() });
    } catch (err) {
      logger.error({ err }, "Failed to list below-target subscriptions");
      res.status(500).json({ error: "Failed to list subscriptions" });
    }
  },
);

router.post(
  "/email-subscriptions/city-below-target",
  requireAdminKey,
  async (req, res) => {
    const parsed = belowTargetCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Dados inválidos.", details: parsed.error.flatten() });
      return;
    }
    try {
      const existing = await db
        .select()
        .from(emailReportSubscriptionsTable)
        .where(
          and(
            eq(emailReportSubscriptionsTable.reportType, CITY_BELOW_TARGET_REPORT_TYPE),
            eq(emailReportSubscriptionsTable.email, parsed.data.email),
          ),
        );
      if (existing.length > 0) {
        res.status(409).json({
          error: "Esse email já está cadastrado para receber este alerta.",
        });
        return;
      }
      const [row] = await db
        .insert(emailReportSubscriptionsTable)
        .values({
          email: parsed.data.email,
          frequency: parsed.data.frequency,
          reportType: CITY_BELOW_TARGET_REPORT_TYPE,
          enabled: parsed.data.enabled ?? true,
        })
        .returning();
      res.status(201).json(row);
    } catch (err) {
      logger.error({ err }, "Failed to create below-target subscription");
      res.status(500).json({ error: "Failed to create subscription" });
    }
  },
);

router.patch(
  "/email-subscriptions/city-below-target/:id",
  requireAdminKey,
  async (req, res) => {
    const id = Number(req.params["id"]);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = belowTargetUpdateSchema.safeParse(req.body);
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      res.status(400).json({ error: "Dados inválidos." });
      return;
    }
    try {
      const [row] = await db
        .update(emailReportSubscriptionsTable)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(
          and(
            eq(emailReportSubscriptionsTable.id, id),
            eq(emailReportSubscriptionsTable.reportType, CITY_BELOW_TARGET_REPORT_TYPE),
          ),
        )
        .returning();
      if (!row) {
        res.status(404).json({ error: "Não encontrado." });
        return;
      }
      res.json(row);
    } catch (err) {
      logger.error({ err }, "Failed to update below-target subscription");
      res.status(500).json({ error: "Failed to update subscription" });
    }
  },
);

router.delete(
  "/email-subscriptions/city-below-target/:id",
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
        .where(
          and(
            eq(emailReportSubscriptionsTable.id, id),
            eq(emailReportSubscriptionsTable.reportType, CITY_BELOW_TARGET_REPORT_TYPE),
          ),
        );
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, "Failed to delete below-target subscription");
      res.status(500).json({ error: "Failed to delete subscription" });
    }
  },
);

const belowTargetSendNowSchema = z.object({
  frequency: z.enum(["daily", "weekly"]).optional(),
});

router.post(
  "/email-subscriptions/city-below-target/:id/send-now",
  requireAdminKey,
  async (req, res) => {
    const id = Number(req.params["id"]);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    if (!(await isEmailConfigured())) {
      res.status(503).json({
        error:
          "Servidor de e-mail (SMTP) não configurado. Preencha no painel, aba 'Relatórios por email'.",
      });
      return;
    }
    try {
      const [sub] = await db
        .select()
        .from(emailReportSubscriptionsTable)
        .where(
          and(
            eq(emailReportSubscriptionsTable.id, id),
            eq(emailReportSubscriptionsTable.reportType, CITY_BELOW_TARGET_REPORT_TYPE),
          ),
        );
      if (!sub) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const override = belowTargetSendNowSchema.safeParse(req.body);
      const freq: BelowTargetFrequency =
        override.success && override.data.frequency
          ? override.data.frequency
          : (sub.frequency as BelowTargetFrequency);
      const now = new Date();
      await sendBelowTargetDigest({ to: sub.email, frequency: freq, now });
      const [updated] = await db
        .update(emailReportSubscriptionsTable)
        .set({ lastSentAt: now, updatedAt: now })
        .where(eq(emailReportSubscriptionsTable.id, id))
        .returning();
      res.json(updated);
    } catch (err) {
      logger.error({ err }, "Failed to send below-target digest now");
      res.status(500).json({
        error:
          "Falha ao enviar email de teste. Verifique as credenciais SMTP e tente novamente.",
      });
    }
  },
);

export default router;
