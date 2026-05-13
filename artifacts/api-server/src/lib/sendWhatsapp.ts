import { db, appSettingsTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { logger } from "./logger";

export type WhatsappNotifyConfig = {
  to: string;
  phoneNumberId: string;
  accessToken: string;
};

const KEYS = [
  "whatsapp_notify_enabled",
  "whatsapp_notify_to",
  "whatsapp_notify_phone_number_id",
  "whatsapp_notify_access_token",
] as const;

function normalizeDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

async function loadConfig(): Promise<{
  enabled: boolean;
  config: WhatsappNotifyConfig | null;
}> {
  try {
    const rows = await db
      .select({ key: appSettingsTable.key, value: appSettingsTable.value })
      .from(appSettingsTable)
      .where(inArray(appSettingsTable.key, KEYS as unknown as string[]));
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const enabled = (map.get("whatsapp_notify_enabled") ?? "false") === "true";
    const to = normalizeDigits((map.get("whatsapp_notify_to") ?? "").trim());
    const phoneNumberId = (map.get("whatsapp_notify_phone_number_id") ?? "").trim();
    const accessToken = (map.get("whatsapp_notify_access_token") ?? "").trim();
    if (!to || !phoneNumberId || !accessToken) {
      return { enabled, config: null };
    }
    return { enabled, config: { to, phoneNumberId, accessToken } };
  } catch (err) {
    logger.warn({ err }, "whatsapp: could not read settings from db");
    return { enabled: false, config: null };
  }
}

export async function isWhatsappNotifyConfigured(): Promise<boolean> {
  const { config } = await loadConfig();
  return config !== null;
}

export async function isWhatsappNotifyEnabled(): Promise<boolean> {
  const { enabled, config } = await loadConfig();
  return enabled && config !== null;
}

async function callMetaCloudApi(
  cfg: WhatsappNotifyConfig,
  body: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = `https://graph.facebook.com/v20.0/${encodeURIComponent(cfg.phoneNumberId)}/messages`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.accessToken}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let detail = text;
      try {
        const parsed = JSON.parse(text) as {
          error?: { message?: string; code?: number };
        };
        if (parsed.error?.message) {
          detail = `${parsed.error.message}${parsed.error.code ? ` (code ${parsed.error.code})` : ""}`;
        }
      } catch {
        // keep raw text
      }
      return { ok: false, error: `HTTP ${res.status}: ${detail.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

export async function sendWhatsappNotification(
  text: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { enabled, config } = await loadConfig();
  if (!enabled) return { ok: false, error: "WhatsApp notifications disabled" };
  if (!config) return { ok: false, error: "WhatsApp notifications not configured" };
  const body = {
    messaging_product: "whatsapp",
    to: config.to,
    type: "text",
    text: { preview_url: true, body: text.slice(0, 4096) },
  };
  const result = await callMetaCloudApi(config, body);
  if (result.ok) {
    logger.info({ to: config.to }, "WhatsApp notification sent");
  } else {
    logger.error({ to: config.to, error: result.error }, "WhatsApp notification failed");
  }
  return result;
}

export async function sendWhatsappTest(
  text: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { config } = await loadConfig();
  if (!config) return { ok: false, error: "WhatsApp notifications not configured" };
  const body = {
    messaging_product: "whatsapp",
    to: config.to,
    type: "text",
    text: { preview_url: false, body: text.slice(0, 4096) },
  };
  return callMetaCloudApi(config, body);
}
