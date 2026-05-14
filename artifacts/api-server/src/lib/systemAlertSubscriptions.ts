import {
  db,
  appSettingsTable,
  emailReportSubscriptionsTable,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { logger } from "./logger";

export const SYSTEM_ALERT_REPORT_TYPE = "system_alert";
const SYSTEM_ALERT_MIGRATED_KEY = "system_alert_recipients_migrated";

async function readMigratedFlag(): Promise<boolean> {
  try {
    const rows = await db
      .select({ value: appSettingsTable.value })
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, SYSTEM_ALERT_MIGRATED_KEY))
      .limit(1);
    return rows[0]?.value === "true";
  } catch {
    return false;
  }
}

/**
 * One-time migration: if no `system_alert` subscriptions exist yet AND we
 * have never run this migration, seed it from the previous fallback
 * audience (city_comparison subscribers + the legacy
 * `interest_notification_email` setting). After this runs once — even if
 * nothing was seeded — the migrated flag is set so admins fully own the
 * list afterward (clearing it intentionally silences cleanup alerts
 * instead of silently re-falling-back to legacy lists).
 *
 * Idempotent: gated by an `appSettings` flag, never re-adds rows an admin
 * has since removed.
 */
export async function migrateSystemAlertRecipients(): Promise<void> {
  try {
    if (await readMigratedFlag()) return;

    const existing = await db
      .select({ id: emailReportSubscriptionsTable.id })
      .from(emailReportSubscriptionsTable)
      .where(eq(emailReportSubscriptionsTable.reportType, SYSTEM_ALERT_REPORT_TYPE))
      .limit(1);

    if (existing.length === 0) {
      const seen = new Map<string, boolean>();

      // Source 1: city_comparison subscribers (the previous default
      // audience for cleanup alerts).
      try {
        const legacy = await db
          .select({
            email: emailReportSubscriptionsTable.email,
            enabled: emailReportSubscriptionsTable.enabled,
          })
          .from(emailReportSubscriptionsTable)
          .where(eq(emailReportSubscriptionsTable.reportType, "city_comparison"));
        for (const r of legacy) {
          const e = r.email.trim().toLowerCase();
          if (!e) continue;
          const prev = seen.get(e);
          seen.set(e, prev === true ? true : r.enabled);
        }
      } catch (err) {
        logger.warn(
          { err },
          "Failed reading city_comparison while seeding system_alert; continuing",
        );
      }

      // Source 2: legacy single `interest_notification_email` app setting,
      // which the previous cleanup-alert recipient logic also included.
      try {
        const legacyRows = await db
          .select({ key: appSettingsTable.key, value: appSettingsTable.value })
          .from(appSettingsTable)
          .where(
            inArray(appSettingsTable.key, [
              "interest_notification_email",
              "interest_notification_enabled",
            ]),
          );
        const m = new Map(legacyRows.map((r) => [r.key, r.value]));
        const enabled =
          (m.get("interest_notification_enabled") ?? "false") === "true";
        const email = (m.get("interest_notification_email") ?? "")
          .trim()
          .toLowerCase();
        if (email) {
          const prev = seen.get(email);
          // If already seeded as enabled from city_comparison, keep enabled.
          // Otherwise honor the legacy enabled flag.
          seen.set(email, prev === true ? true : enabled);
        }
      } catch (err) {
        logger.warn(
          { err },
          "Failed reading legacy interest_notification_email while seeding system_alert; continuing",
        );
      }

      if (seen.size > 0) {
        await db.insert(emailReportSubscriptionsTable).values(
          [...seen.entries()].map(([email, enabled]) => ({
            email,
            reportType: SYSTEM_ALERT_REPORT_TYPE,
            frequency: "instant",
            enabled,
          })),
        );
        logger.info(
          { count: seen.size },
          "Seeded system_alert subscribers from legacy cleanup-alert audience",
        );
      }
    }

    const now = new Date();
    await db
      .insert(appSettingsTable)
      .values({
        key: SYSTEM_ALERT_MIGRATED_KEY,
        value: "true",
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: appSettingsTable.key,
        set: { value: "true", updatedAt: now },
      });
  } catch (err) {
    logger.error(
      { err },
      "Failed to migrate system_alert recipients from legacy audience",
    );
  }
}

/**
 * Returns the configured system_alert audience.
 *
 * - `configured: true` once the one-time migration has completed (the
 *   `system_alert_recipients_migrated` app setting is `"true"`). From that
 *   point on the admin owns the list — `recipients` reflects exactly the
 *   enabled rows, even if that set is empty (which means "send to nobody"
 *   and callers must NOT fall back to legacy lists).
 * - `configured: false` only when the migration has never completed
 *   successfully (e.g. a transient DB error on the first call). Callers
 *   may then fall back to the legacy audience so cleanup alerts continue
 *   to be delivered until migration finishes.
 */
export async function fetchSystemAlertRecipients(): Promise<{
  configured: boolean;
  recipients: string[];
}> {
  await migrateSystemAlertRecipients();
  const configured = await readMigratedFlag();
  const rows = await db
    .select({
      email: emailReportSubscriptionsTable.email,
      enabled: emailReportSubscriptionsTable.enabled,
    })
    .from(emailReportSubscriptionsTable)
    .where(eq(emailReportSubscriptionsTable.reportType, SYSTEM_ALERT_REPORT_TYPE));
  const seen = new Set<string>();
  for (const r of rows) {
    if (!r.enabled) continue;
    const e = r.email.trim().toLowerCase();
    if (e) seen.add(e);
  }
  return { configured, recipients: [...seen] };
}
