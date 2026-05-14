import {
  db,
  appSettingsTable,
  whatsappNotifyDestinationsTable,
} from "@workspace/db";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { logger } from "./logger";

export type WhatsappCredentials = {
  phoneNumberId: string;
  accessToken: string;
};

export type WhatsappNotifyConfig = WhatsappCredentials & {
  to: string;
};

export type WhatsappNotifyFrequency = "instant" | "daily" | "weekly";

export type WhatsappDestination = {
  id: number;
  label: string | null;
  number: string;
  enabled: boolean;
  frequency: WhatsappNotifyFrequency;
};

const KEYS = [
  "whatsapp_notify_enabled",
  "whatsapp_notify_to",
  "whatsapp_notify_phone_number_id",
  "whatsapp_notify_access_token",
  "whatsapp_notify_frequency",
] as const;

const QUIET_KEYS = [
  "whatsapp_notify_quiet_hours_enabled",
  "whatsapp_notify_quiet_hours_digest_enabled",
] as const;

export type WhatsappQuietHoursSettings = {
  /** Mute the per-lead WhatsApp ping during the global quiet-hours window. */
  enabled: boolean;
  /** Send a single WhatsApp summary at the end of the muted window. */
  digestEnabled: boolean;
};

export async function loadWhatsappQuietHoursSettings(): Promise<WhatsappQuietHoursSettings> {
  try {
    const rows = await db
      .select({ key: appSettingsTable.key, value: appSettingsTable.value })
      .from(appSettingsTable)
      .where(inArray(appSettingsTable.key, QUIET_KEYS as unknown as string[]));
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return {
      enabled:
        (map.get("whatsapp_notify_quiet_hours_enabled") ?? "false") === "true",
      digestEnabled:
        (map.get("whatsapp_notify_quiet_hours_digest_enabled") ?? "false") ===
        "true",
    };
  } catch (err) {
    logger.warn({ err }, "whatsapp: could not read quiet-hours settings from db");
    return { enabled: false, digestEnabled: false };
  }
}

function normalizeDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

function parseFrequency(raw: string | undefined): WhatsappNotifyFrequency {
  const v = (raw ?? "").trim();
  return v === "daily" || v === "weekly" ? v : "instant";
}

export type WhatsappNotifyState = {
  enabled: boolean;
  credentials: WhatsappCredentials | null;
  /** Legacy single destination from `whatsapp_notify_to`. May be null. */
  legacyTo: string | null;
  /**
   * Backward-compat config used when no destinations exist yet (returned
   * only when `legacyTo` is set). New code should prefer
   * `loadEnabledDestinationConfigs`.
   */
  config: WhatsappNotifyConfig | null;
  frequency: WhatsappNotifyFrequency;
};

export async function loadWhatsappNotifyState(): Promise<WhatsappNotifyState> {
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
    const frequency = parseFrequency(map.get("whatsapp_notify_frequency"));
    const credentials: WhatsappCredentials | null =
      phoneNumberId && accessToken ? { phoneNumberId, accessToken } : null;
    const legacyTo = to.length > 0 ? to : null;
    const config: WhatsappNotifyConfig | null =
      credentials && legacyTo
        ? { ...credentials, to: legacyTo }
        : null;
    return { enabled, credentials, legacyTo, config, frequency };
  } catch (err) {
    logger.warn({ err }, "whatsapp: could not read settings from db");
    return {
      enabled: false,
      credentials: null,
      legacyTo: null,
      config: null,
      frequency: "instant",
    };
  }
}

/**
 * Migrate the legacy single `whatsapp_notify_to` setting into a row in the
 * destinations table, AND backfill the per-destination `frequency` column from
 * the legacy global `whatsapp_notify_frequency` setting on first run. Both
 * migrations are idempotent and gated by the `whatsapp_destinations_freq_migrated`
 * flag so they only run once.
 */
export async function migrateLegacyWhatsappDestination(): Promise<void> {
  try {
    // Read the relevant legacy settings once.
    const settingsRows = await db
      .select({ key: appSettingsTable.key, value: appSettingsTable.value })
      .from(appSettingsTable)
      .where(
        inArray(appSettingsTable.key, [
          "whatsapp_notify_to",
          "whatsapp_notify_frequency",
          "whatsapp_destinations_freq_migrated",
          "whatsapp_notify_digest_last_sent_at",
          "whatsapp_destinations_cursor_migrated",
        ]),
      );
    const map = new Map(settingsRows.map((r) => [r.key, r.value]));
    const legacy = normalizeDigits((map.get("whatsapp_notify_to") ?? "").trim());
    const legacyFrequency = parseFrequency(map.get("whatsapp_notify_frequency"));
    const freqMigrated =
      (map.get("whatsapp_destinations_freq_migrated") ?? "false") === "true";
    const cursorMigrated =
      (map.get("whatsapp_destinations_cursor_migrated") ?? "false") === "true";
    const legacyCursorRaw = map.get("whatsapp_notify_digest_last_sent_at") ?? "";
    const legacyCursor = legacyCursorRaw
      ? new Date(legacyCursorRaw)
      : null;
    const legacyCursorValid =
      legacyCursor && !Number.isNaN(legacyCursor.getTime())
        ? legacyCursor
        : null;

    // 1) Seed the table from the legacy single number if empty.
    const existing = await db
      .select({ id: whatsappNotifyDestinationsTable.id })
      .from(whatsappNotifyDestinationsTable)
      .limit(1);
    if (existing.length === 0 && legacy) {
      await db.insert(whatsappNotifyDestinationsTable).values({
        number: legacy,
        enabled: true,
        frequency: legacyFrequency,
      });
      await db
        .insert(appSettingsTable)
        .values({ key: "whatsapp_notify_to", value: "" })
        .onConflictDoUpdate({
          target: appSettingsTable.key,
          set: { value: "" },
        });
      logger.info(
        { number: legacy, frequency: legacyFrequency },
        "Migrated legacy whatsapp_notify_to into destinations table",
      );
    }

    // 2) On first run after the per-destination `frequency` column was added,
    // copy the legacy global frequency onto every existing row. This preserves
    // intent for installs that already had multi-destination but a non-instant
    // global cadence. New rows created after this point pick their own.
    if (!freqMigrated) {
      if (legacyFrequency !== "instant") {
        await db
          .update(whatsappNotifyDestinationsTable)
          .set({ frequency: legacyFrequency, updatedAt: new Date() });
        logger.info(
          { frequency: legacyFrequency },
          "Backfilled per-destination whatsapp frequency from legacy global setting",
        );
      }
      await db
        .insert(appSettingsTable)
        .values({
          key: "whatsapp_destinations_freq_migrated",
          value: "true",
        })
        .onConflictDoUpdate({
          target: appSettingsTable.key,
          set: { value: "true" },
        });
    }

    // 3) On first run after the per-destination `lastSentAt` cursor was added,
    // backfill it from the legacy global digest cursor for every existing
    // destination whose `lastSentAt` is still null. This prevents the first
    // post-upgrade digest from resending the entire historical backlog to
    // recipients that were already up-to-date under the old single-cursor
    // model. Idempotent and gated by `whatsapp_destinations_cursor_migrated`.
    if (!cursorMigrated) {
      if (legacyCursorValid) {
        await db
          .update(whatsappNotifyDestinationsTable)
          .set({ lastSentAt: legacyCursorValid })
          .where(isNull(whatsappNotifyDestinationsTable.lastSentAt));
        logger.info(
          { cursor: legacyCursorValid.toISOString() },
          "Backfilled per-destination whatsapp lastSentAt from legacy digest cursor",
        );
      }
      await db
        .insert(appSettingsTable)
        .values({
          key: "whatsapp_destinations_cursor_migrated",
          value: "true",
        })
        .onConflictDoUpdate({
          target: appSettingsTable.key,
          set: { value: "true" },
        });
    }
  } catch (err) {
    logger.error({ err }, "Failed to migrate legacy whatsapp_notify_to");
  }
}

export async function listWhatsappDestinations(): Promise<WhatsappDestination[]> {
  await migrateLegacyWhatsappDestination();
  const rows = await db
    .select({
      id: whatsappNotifyDestinationsTable.id,
      label: whatsappNotifyDestinationsTable.label,
      number: whatsappNotifyDestinationsTable.number,
      enabled: whatsappNotifyDestinationsTable.enabled,
      frequency: whatsappNotifyDestinationsTable.frequency,
    })
    .from(whatsappNotifyDestinationsTable)
    .orderBy(asc(whatsappNotifyDestinationsTable.createdAt));
  return rows.map((r) => ({ ...r, frequency: parseFrequency(r.frequency) }));
}

/**
 * Load enabled destinations restricted to a frequency (default: "instant").
 * Used both for the per-lead instant fanout and for the per-recipient digest
 * loop, which iterates daily/weekly destinations independently.
 */
export async function loadEnabledDestinationsByFrequency(
  frequency: WhatsappNotifyFrequency,
): Promise<
  Array<{ id: number; number: string; lastSentAt: Date | null }>
> {
  await migrateLegacyWhatsappDestination();
  const rows = await db
    .select({
      id: whatsappNotifyDestinationsTable.id,
      number: whatsappNotifyDestinationsTable.number,
      frequency: whatsappNotifyDestinationsTable.frequency,
      lastSentAt: whatsappNotifyDestinationsTable.lastSentAt,
    })
    .from(whatsappNotifyDestinationsTable)
    .where(eq(whatsappNotifyDestinationsTable.enabled, true));
  return rows
    .filter((r) => parseFrequency(r.frequency) === frequency)
    .map((r) => ({
      id: r.id,
      number: normalizeDigits(r.number),
      lastSentAt: r.lastSentAt,
    }))
    .filter((r) => r.number.length > 0);
}

/** Numbers of every enabled destination, regardless of cadence. */
export async function loadEnabledDestinationNumbers(): Promise<string[]> {
  await migrateLegacyWhatsappDestination();
  const rows = await db
    .select({ number: whatsappNotifyDestinationsTable.number })
    .from(whatsappNotifyDestinationsTable)
    .where(eq(whatsappNotifyDestinationsTable.enabled, true));
  return rows.map((r) => normalizeDigits(r.number)).filter((n) => n.length > 0);
}

export async function isWhatsappNotifyConfigured(): Promise<boolean> {
  const { credentials } = await loadWhatsappNotifyState();
  if (!credentials) return false;
  const numbers = await loadEnabledDestinationNumbers();
  return numbers.length > 0;
}

export async function isWhatsappNotifyEnabled(): Promise<boolean> {
  const { enabled, credentials } = await loadWhatsappNotifyState();
  if (!enabled || !credentials) return false;
  const numbers = await loadEnabledDestinationNumbers();
  return numbers.length > 0;
}

export async function getWhatsappNotifyFrequency(): Promise<WhatsappNotifyFrequency> {
  const { frequency } = await loadWhatsappNotifyState();
  return frequency;
}

export async function sendWhatsappWithConfig(
  cfg: WhatsappNotifyConfig,
  text: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const body = {
    messaging_product: "whatsapp",
    to: cfg.to,
    type: "text",
    text: { preview_url: true, body: text.slice(0, 4096) },
  };
  return callMetaCloudApi(cfg, body);
}

async function callMetaCloudApi(
  cfg: WhatsappCredentials,
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

export type WhatsappFanoutResult = {
  total: number;
  sent: number;
  failed: Array<{ to: string; error: string }>;
};

/**
 * Send the same text message to every enabled destination using the shared
 * Meta Cloud API credentials. Each destination is attempted independently;
 * a failure on one number does not stop the rest.
 */
export async function sendWhatsappToAllDestinations(
  text: string,
  opts: { previewUrl?: boolean } = {},
): Promise<
  | { ok: true; result: WhatsappFanoutResult }
  | { ok: false; error: string; result?: WhatsappFanoutResult }
> {
  const { credentials } = await loadWhatsappNotifyState();
  if (!credentials) {
    return { ok: false, error: "WhatsApp notifications not configured" };
  }
  await migrateLegacyWhatsappDestination();
  // Per-lead instant fanout only goes to recipients on the "instant" cadence.
  // Daily/weekly recipients receive a digest at their own schedule.
  const rows = await db
    .select({
      id: whatsappNotifyDestinationsTable.id,
      number: whatsappNotifyDestinationsTable.number,
      frequency: whatsappNotifyDestinationsTable.frequency,
    })
    .from(whatsappNotifyDestinationsTable)
    .where(eq(whatsappNotifyDestinationsTable.enabled, true));
  const instantRows = rows.filter(
    (r) => parseFrequency(r.frequency) === "instant",
  );
  if (instantRows.length === 0) {
    return {
      ok: false,
      error:
        rows.length === 0
          ? "Nenhum destino de WhatsApp ativo cadastrado."
          : "Nenhum destino com frequência instantânea cadastrado.",
    };
  }
  const result: WhatsappFanoutResult = {
    total: instantRows.length,
    sent: 0,
    failed: [],
  };
  const sentIds: number[] = [];
  await Promise.all(
    instantRows.map(async (row) => {
      const to = normalizeDigits(row.number);
      if (!to) return;
      const body = {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: {
          preview_url: opts.previewUrl ?? true,
          body: text.slice(0, 4096),
        },
      };
      const r = await callMetaCloudApi(credentials, body);
      if (r.ok) {
        result.sent += 1;
        sentIds.push(row.id);
      } else {
        result.failed.push({ to, error: r.error });
      }
    }),
  );
  if (sentIds.length > 0) {
    try {
      await db
        .update(whatsappNotifyDestinationsTable)
        .set({ lastSentAt: new Date() })
        .where(inArray(whatsappNotifyDestinationsTable.id, sentIds));
    } catch (err) {
      logger.warn({ err }, "Failed to update lastSentAt for whatsapp destinations");
    }
  }
  if (result.sent === 0) {
    return {
      ok: false,
      error:
        result.failed[0]?.error ??
        "Falha ao enviar para qualquer destino de WhatsApp.",
      result,
    };
  }
  return { ok: true, result };
}

export async function sendWhatsappNotification(
  text: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { enabled, credentials } = await loadWhatsappNotifyState();
  if (!enabled) return { ok: false, error: "WhatsApp notifications disabled" };
  if (!credentials) {
    return { ok: false, error: "WhatsApp notifications not configured" };
  }
  const out = await sendWhatsappToAllDestinations(text, { previewUrl: true });
  if (out.ok) {
    logger.info(
      { sent: out.result.sent, failed: out.result.failed.length },
      "WhatsApp notification fanned out",
    );
    if (out.result.failed.length > 0) {
      logger.error(
        { failed: out.result.failed },
        "WhatsApp notification failed for some destinations",
      );
    }
    return { ok: true };
  }
  // "No instant recipients" is an expected state when every destination is
  // on a daily/weekly cadence — those will be picked up by the digest. Demote
  // it to info so logs don't flood with false-positive errors.
  const expected = out.error.includes("instantânea");
  if (expected) {
    logger.info(
      { reason: out.error },
      "WhatsApp notification deferred to digest (no instant recipients)",
    );
  } else {
    logger.error(
      { error: out.error, failed: out.result?.failed ?? [] },
      "WhatsApp notification failed for every destination",
    );
  }
  return { ok: false, error: out.error };
}

export async function sendWhatsappTest(
  text: string,
): Promise<{ ok: true; result: WhatsappFanoutResult } | { ok: false; error: string }> {
  const { credentials } = await loadWhatsappNotifyState();
  if (!credentials) {
    return { ok: false, error: "WhatsApp notifications not configured" };
  }
  await migrateLegacyWhatsappDestination();
  // The test endpoint reaches every enabled destination regardless of cadence
  // so admins can validate daily/weekly recipients without waiting for the
  // digest to fire.
  const rows = await db
    .select({
      id: whatsappNotifyDestinationsTable.id,
      number: whatsappNotifyDestinationsTable.number,
    })
    .from(whatsappNotifyDestinationsTable)
    .where(eq(whatsappNotifyDestinationsTable.enabled, true));
  if (rows.length === 0) {
    return {
      ok: false,
      error: "Nenhum destino de WhatsApp ativo cadastrado.",
    };
  }
  const result: WhatsappFanoutResult = {
    total: rows.length,
    sent: 0,
    failed: [],
  };
  await Promise.all(
    rows.map(async (row) => {
      const to = normalizeDigits(row.number);
      if (!to) {
        result.failed.push({ to: row.number, error: "Número inválido." });
        return;
      }
      const body = {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { preview_url: false, body: text.slice(0, 4096) },
      };
      const r = await callMetaCloudApi(credentials, body);
      if (r.ok) {
        result.sent += 1;
      } else {
        result.failed.push({ to, error: r.error });
      }
    }),
  );
  // Note: test sends intentionally do NOT bump `lastSentAt`. That column is
  // the per-recipient digest cursor — advancing it from a test would cause
  // real daily/weekly leads to be skipped on the next scheduled digest.
  if (result.sent === 0) {
    return {
      ok: false,
      error:
        result.failed[0]?.error ??
        "Falha ao enviar para qualquer destino de WhatsApp.",
    };
  }
  return { ok: true, result };
}

/**
 * Send a test message to a single destination by id, using the shared
 * credentials. Useful for "Test this number" buttons in the UI.
 */
export async function sendWhatsappTestToDestination(
  destinationId: number,
  text: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { credentials } = await loadWhatsappNotifyState();
  if (!credentials) {
    return { ok: false, error: "WhatsApp notifications not configured" };
  }
  const [row] = await db
    .select({
      id: whatsappNotifyDestinationsTable.id,
      number: whatsappNotifyDestinationsTable.number,
    })
    .from(whatsappNotifyDestinationsTable)
    .where(eq(whatsappNotifyDestinationsTable.id, destinationId));
  if (!row) return { ok: false, error: "Destino não encontrado." };
  const to = normalizeDigits(row.number);
  if (!to) return { ok: false, error: "Número inválido." };
  const body = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { preview_url: false, body: text.slice(0, 4096) },
  };
  // Test sends intentionally do NOT bump `lastSentAt`. That column is the
  // per-recipient digest cursor — advancing it from a test would cause real
  // daily/weekly leads to be skipped on the next scheduled digest.
  return callMetaCloudApi(credentials, body);
}

// Re-exported for the digest module; lets it bump per-destination lastSentAt.
export { whatsappNotifyDestinationsTable, and };
