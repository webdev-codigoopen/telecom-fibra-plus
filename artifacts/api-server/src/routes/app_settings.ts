import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin as requireAdminKey } from "../lib/auth";
import { stripHtmlFields } from "../lib/sanitize";

const router: IRouter = Router();


export const SETTING_DEFAULTS = {
  whatsapp_number: "5577998444757",
  cta_subscribe_message:
    "Quero assinar o plano {speed} mega da Provider Mais Fibra na cidade de {place}",
  cta_unavailable_message:
    "Queria saber quando a Provider Mais Fibra vai estar disponível na minha cidade, {place}",
  interest_notification_email: "",
  interest_notification_enabled: "false",
  interest_notification_frequency: "instant",
  interest_digest_last_sent_at: "",
  // Time-of-day (and weekday for weekly) at which the digest is delivered,
  // in America/Sao_Paulo. Hour: 0–23. Weekday: 0=Sunday … 6=Saturday.
  interest_digest_hour: "8",
  interest_digest_weekday: "1",
  // Quiet hours — mute lead notifications during off-hours.
  // Times are HH:MM in America/Sao_Paulo. start>end means overnight window.
  quiet_hours_enabled: "false",
  quiet_hours_start: "22:00",
  quiet_hours_end: "08:00",
  quiet_hours_weekends: "false",
  quiet_hours_digest_enabled: "false",
  // Internal state — set by the server, not editable from the PUT endpoint.
  quiet_hours_active_since: "",
  quiet_hours_digest_last_sent_at: "",
  // WhatsApp lead notification (Meta Cloud API)
  whatsapp_notify_enabled: "false",
  whatsapp_notify_to: "",
  whatsapp_notify_phone_number_id: "",
  whatsapp_notify_access_token: "",
  // 'instant' fires one message per lead. 'daily'/'weekly' group leads into a
  // single digest sent at the same hour/weekday as the email digest.
  whatsapp_notify_frequency: "instant",
  whatsapp_notify_digest_last_sent_at: "",
  // Mute WhatsApp lead pings during the global quiet-hours window.
  // Independent from the per-recipient email quiet hours — applies to the
  // shared WhatsApp webhook (group/team number) as a whole.
  whatsapp_notify_quiet_hours_enabled: "false",
  // When true, send a single WhatsApp summary at the end of the muted window
  // listing the leads received while WhatsApp pings were silenced.
  whatsapp_notify_quiet_hours_digest_enabled: "false",
  recaptcha_enabled: "false",
  recaptcha_site_key: "",
  recaptcha_secret_key: "",
  recaptcha_min_score: "0.5",
  // Marketing / analytics tags (all optional; injected only when filled)
  ga4_measurement_id: "",
  gtm_container_id: "",
  google_ads_conversion_id: "",
  google_ads_conversion_label: "",
  meta_pixel_id: "",
  meta_capi_token: "",
  meta_capi_test_event_code: "",
  // Google Reviews
  gmb_profile_url: "",
  google_places_api_key: "",
  google_places_id: "",
  reviews_min_rating: "4",
  reviews_show_count: "6",
  // SMTP (envio de e-mail)
  smtp_host: "",
  smtp_port: "",
  smtp_secure: "auto", // 'auto' | 'true' | 'false'
  smtp_user: "",
  smtp_password: "",
  smtp_from_email: "",
  smtp_from_name: "",
  // City below-target digest configuration
  below_target_default_pct: "10",
  below_target_min_previews: "5",
} as const;

const ALLOWED_KEYS = Object.keys(SETTING_DEFAULTS) as Array<
  keyof typeof SETTING_DEFAULTS
>;

// Settings that must NEVER be returned by the public GET /settings endpoint.
// These are admin-only configuration (e.g. recipient email for lead notifications,
// reCAPTCHA secret key).
const PRIVATE_KEYS = new Set<keyof typeof SETTING_DEFAULTS>([
  "interest_notification_email",
  "interest_notification_enabled",
  "interest_notification_frequency",
  "interest_digest_last_sent_at",
  "interest_digest_hour",
  "interest_digest_weekday",
  "quiet_hours_enabled",
  "quiet_hours_start",
  "quiet_hours_end",
  "quiet_hours_weekends",
  "quiet_hours_digest_enabled",
  "quiet_hours_active_since",
  "quiet_hours_digest_last_sent_at",
  "whatsapp_notify_enabled",
  "whatsapp_notify_to",
  "whatsapp_notify_phone_number_id",
  "whatsapp_notify_access_token",
  "whatsapp_notify_frequency",
  "whatsapp_notify_digest_last_sent_at",
  "whatsapp_notify_quiet_hours_enabled",
  "whatsapp_notify_quiet_hours_digest_enabled",
  "recaptcha_secret_key",
  "meta_capi_token",
  "meta_capi_test_event_code",
  "google_places_api_key",
  "smtp_password",
  "smtp_user",
  "smtp_host",
  "below_target_default_pct",
  "below_target_min_previews",
]);

function rowsToObject(
  rows: Array<{ key: string; value: string }>,
  opts: { includePrivate: boolean },
) {
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const result: Record<string, string> = {};
  for (const k of ALLOWED_KEYS) {
    if (!opts.includePrivate && PRIVATE_KEYS.has(k)) continue;
    result[k] = map.get(k) ?? SETTING_DEFAULTS[k];
  }
  return result;
}

router.get("/settings", async (_req, res) => {
  try {
    const rows = await db.select().from(appSettingsTable);
    res.json(rowsToObject(rows, { includePrivate: false }));
  } catch {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.get("/settings/admin", requireAdminKey, async (_req, res) => {
  try {
    const rows = await db.select().from(appSettingsTable);
    res.json(rowsToObject(rows, { includePrivate: true }));
  } catch {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

const settingsBodySchema = z
  .object({
    whatsapp_number: z.string().trim().min(8).max(20).optional(),
    cta_subscribe_message: z.string().trim().min(1).max(500).optional(),
    cta_unavailable_message: z.string().trim().min(1).max(500).optional(),
    interest_notification_email: z
      .union([z.literal(""), z.string().trim().toLowerCase().email().max(254)])
      .optional(),
    interest_notification_enabled: z.enum(["true", "false"]).optional(),
    interest_notification_frequency: z.enum(["instant", "daily", "weekly"]).optional(),
    interest_digest_hour: z
      .string()
      .trim()
      .regex(/^([0-9]|1[0-9]|2[0-3])$/, "Use uma hora entre 0 e 23.")
      .optional(),
    interest_digest_weekday: z
      .string()
      .trim()
      .regex(/^[0-6]$/, "Use um dia da semana entre 0 (domingo) e 6 (sábado).")
      .optional(),
    quiet_hours_enabled: z.enum(["true", "false"]).optional(),
    quiet_hours_start: z
      .string()
      .trim()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use o formato HH:MM (00:00–23:59).")
      .optional(),
    quiet_hours_end: z
      .string()
      .trim()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use o formato HH:MM (00:00–23:59).")
      .optional(),
    quiet_hours_weekends: z.enum(["true", "false"]).optional(),
    quiet_hours_digest_enabled: z.enum(["true", "false"]).optional(),
    whatsapp_notify_enabled: z.enum(["true", "false"]).optional(),
    whatsapp_notify_to: z
      .string()
      .trim()
      .max(20)
      .refine(
        (v) => v === "" || /^\d{10,15}$/.test(v.replace(/\D/g, "")),
        "Informe um número de WhatsApp válido com DDI/DDD (somente dígitos).",
      )
      .transform((v) => (v === "" ? "" : v.replace(/\D/g, "")))
      .optional(),
    whatsapp_notify_phone_number_id: z.string().trim().max(40).optional(),
    whatsapp_notify_access_token: z.string().trim().max(500).optional(),
    whatsapp_notify_frequency: z.enum(["instant", "daily", "weekly"]).optional(),
    whatsapp_notify_quiet_hours_enabled: z.enum(["true", "false"]).optional(),
    whatsapp_notify_quiet_hours_digest_enabled: z.enum(["true", "false"]).optional(),
    recaptcha_enabled: z.enum(["true", "false"]).optional(),
    recaptcha_site_key: z.string().trim().max(120).optional(),
    recaptcha_secret_key: z.string().trim().max(120).optional(),
    recaptcha_min_score: z
      .string()
      .trim()
      .regex(/^(0(\.\d+)?|1(\.0+)?)$/, "Use um valor entre 0 e 1, ex: 0.5")
      .optional(),
    ga4_measurement_id: z.string().trim().max(40).optional(),
    gtm_container_id: z.string().trim().max(40).optional(),
    google_ads_conversion_id: z.string().trim().max(40).optional(),
    google_ads_conversion_label: z.string().trim().max(60).optional(),
    meta_pixel_id: z.string().trim().max(40).optional(),
    meta_capi_token: z.string().trim().max(300).optional(),
    meta_capi_test_event_code: z.string().trim().max(40).optional(),
    gmb_profile_url: z.string().trim().max(500).optional(),
    google_places_api_key: z.string().trim().max(120).optional(),
    google_places_id: z.string().trim().max(120).optional(),
    reviews_min_rating: z.enum(["1", "2", "3", "4", "5"]).optional(),
    reviews_show_count: z
      .string()
      .trim()
      .regex(/^([1-9]|1[0-2])$/, "Entre 1 e 12")
      .optional(),
    smtp_host: z.string().trim().max(200).optional(),
    smtp_port: z
      .string()
      .trim()
      .regex(/^$|^([1-9][0-9]{0,4})$/, "Porta inválida (1-65535)")
      .optional(),
    smtp_secure: z.enum(["auto", "true", "false"]).optional(),
    smtp_user: z.string().trim().max(200).optional(),
    smtp_password: z.string().max(300).optional(),
    smtp_from_email: z
      .string()
      .trim()
      .max(200)
      .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail inválido")
      .optional(),
    smtp_from_name: z.string().trim().max(120).optional(),
    below_target_default_pct: z
      .string()
      .trim()
      .refine((v) => {
        const n = Number(v);
        return Number.isFinite(n) && n > 0 && n <= 100;
      }, "Use um valor entre 0 e 100.")
      .optional(),
    below_target_min_previews: z
      .string()
      .trim()
      .refine((v) => {
        const n = Number(v);
        return Number.isFinite(n) && Number.isInteger(n) && n >= 1 && n <= 1000;
      }, "Use um inteiro entre 1 e 1000.")
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No settings provided" });

router.put("/settings", requireAdminKey, async (req, res) => {
  const parsed = settingsBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid settings", details: parsed.error.flatten() });
    return;
  }
  try {
    // Defense-in-depth: strip any HTML from free-text fields before persist.
    // The site already escapes on output, but stripping on persist prevents
    // future code paths that forget to escape from being exploitable.
    const SANITIZE_KEYS = [
      "cta_subscribe_message",
      "cta_unavailable_message",
      "smtp_from_name",
    ] as const;
    const sanitized = stripHtmlFields(parsed.data, SANITIZE_KEYS);
    const entries = Object.entries(sanitized) as Array<[string, string]>;
    let touchedSmtp = false;
    for (const [key, value] of entries) {
      if (key.startsWith("smtp_")) touchedSmtp = true;
      await db
        .insert(appSettingsTable)
        .values({ key, value })
        .onConflictDoUpdate({
          target: appSettingsTable.key,
          set: { value, updatedAt: sql`now()` },
        });
    }
    if (touchedSmtp) {
      const { invalidateEmailCache } = await import("../lib/sendEmail");
      invalidateEmailCache();
    }
    const rows = await db.select().from(appSettingsTable);
    res.json(rowsToObject(rows, { includePrivate: true }));
  } catch {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// ---------------------------------------------------------------------------
// SMTP test: tries to deliver a real e-mail with the currently saved settings
// ---------------------------------------------------------------------------
const smtpTestSchema = z.object({
  to: z.string().trim().email("E-mail de destino inválido"),
});

router.post("/settings/smtp/test", requireAdminKey, async (req, res) => {
  const parsed = smtpTestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "E-mail inválido" });
    return;
  }
  try {
    const { sendEmail, verifySmtp, invalidateEmailCache } = await import("../lib/sendEmail");
    invalidateEmailCache();
    const v = await verifySmtp();
    if (!v.ok) {
      res.status(400).json({ error: `Falha ao conectar no SMTP: ${v.error}` });
      return;
    }
    await sendEmail({
      to: parsed.data.to,
      subject: "Teste de e-mail — Provider Mais Fibra",
      html: `<p>Este é um e-mail de teste enviado pelo painel.</p><p>Se você recebeu, o servidor de e-mail está configurado corretamente.</p>`,
      text: "Este é um e-mail de teste enviado pelo painel. Se você recebeu, o servidor de e-mail está configurado corretamente.",
    });
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    res.status(500).json({ error: msg });
  }
});

// ---------------------------------------------------------------------------
// WhatsApp test: tries to deliver a real WhatsApp message via Meta Cloud API
// using the currently saved settings.
// ---------------------------------------------------------------------------
router.post("/settings/whatsapp/test", requireAdminKey, async (_req, res) => {
  try {
    const { sendWhatsappTest, isWhatsappNotifyConfigured } = await import(
      "../lib/sendWhatsapp"
    );
    if (!(await isWhatsappNotifyConfigured())) {
      res.status(400).json({
        error:
          "WhatsApp não configurado. Preencha o Phone Number ID e o Access Token, e cadastre pelo menos um número de destino ativo.",
      });
      return;
    }
    const result = await sendWhatsappTest(
      "✅ Teste — Provider Mais Fibra. Se você recebeu esta mensagem, as notificações por WhatsApp estão funcionando.",
    );
    if (!result.ok) {
      res.status(400).json({ error: `Falha ao enviar: ${result.error}` });
      return;
    }
    res.json({
      ok: true,
      sent: result.result.sent,
      total: result.result.total,
      failed: result.result.failed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    res.status(500).json({ error: msg });
  }
});

// ---------------------------------------------------------------------------
// Quiet-hours digest preview: renders the email + WhatsApp content that would
// be sent at the end of the current (or most recent) muted window without
// actually sending anything.
// ---------------------------------------------------------------------------
router.post("/settings/quiet-hours/preview", requireAdminKey, async (_req, res) => {
  try {
    const { previewQuietHoursDigest } = await import("../lib/quietHours");
    const preview = await previewQuietHoursDigest(new Date());
    res.json(preview);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    res.status(500).json({ error: msg });
  }
});

// ---------------------------------------------------------------------------
// Quiet-hours digest send-test: delivers the preview content right now to the
// configured email/WhatsApp recipients, prefixed with "[TESTE]".
// ---------------------------------------------------------------------------
router.post("/settings/quiet-hours/send-test", requireAdminKey, async (_req, res) => {
  try {
    const { sendQuietHoursDigestTest } = await import("../lib/quietHours");
    const result = await sendQuietHoursDigestTest(new Date());
    res.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    res.status(500).json({ error: msg });
  }
});

// ---------------------------------------------------------------------------
// WhatsApp digest send-now: builds and sends a digest of new interests right
// now (only valid when frequency is daily/weekly).
// ---------------------------------------------------------------------------
router.post("/settings/whatsapp/digest/send-now", requireAdminKey, async (_req, res) => {
  try {
    const { sendWhatsappDigestNow } = await import("../lib/interestDigest");
    const result = await sendWhatsappDigestNow(new Date());
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ ok: true, count: result.count });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    res.status(500).json({ error: msg });
  }
});

export default router;
