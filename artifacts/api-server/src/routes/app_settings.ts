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
  "recaptcha_secret_key",
  "meta_capi_token",
  "meta_capi_test_event_code",
  "google_places_api_key",
  "smtp_password",
  "smtp_user",
  "smtp_host",
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

export default router;
