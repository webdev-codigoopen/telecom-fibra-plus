import { db, emailReportSubscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { isEmailConfigured, sendEmail } from "./sendEmail";
import {
  generateCityComparisonReport,
  reportFilename,
  reportSubject,
  reportToCsv,
  reportToHtml,
  type Frequency,
} from "./cityComparisonReport";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

function isDue(frequency: Frequency, lastSentAt: Date | null, now: Date): boolean {
  if (!lastSentAt) return true;
  const elapsed = now.getTime() - lastSentAt.getTime();
  if (frequency === "weekly") return elapsed >= 7 * 24 * 60 * 60 * 1000;
  if (frequency === "monthly") return elapsed >= 30 * 24 * 60 * 60 * 1000;
  return false;
}

let runningTick = false;

export async function tick(now: Date = new Date()): Promise<void> {
  if (runningTick) return;
  runningTick = true;
  try {
    const subs = await db
      .select()
      .from(emailReportSubscriptionsTable)
      .where(eq(emailReportSubscriptionsTable.enabled, true));

    const due = subs.filter(
      (s) =>
        s.reportType === "city_comparison" &&
        (s.frequency === "weekly" || s.frequency === "monthly") &&
        isDue(s.frequency as Frequency, s.lastSentAt, now),
    );
    if (due.length === 0) return;

    if (!isEmailConfigured()) {
      logger.warn(
        { dueCount: due.length },
        "Email not configured (set SMTP_HOST/PORT/USER/PASS/FROM); skipping scheduled email reports.",
      );
      return;
    }

    // Cache reports per frequency since they're identical for all subscribers in this tick.
    const reportCache = new Map<
      Frequency,
      Awaited<ReturnType<typeof generateCityComparisonReport>>
    >();

    for (const sub of due) {
      const freq = sub.frequency as Frequency;
      try {
        let report = reportCache.get(freq);
        if (!report) {
          report = await generateCityComparisonReport(freq, now);
          reportCache.set(freq, report);
        }
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
        await db
          .update(emailReportSubscriptionsTable)
          .set({ lastSentAt: now, updatedAt: now })
          .where(eq(emailReportSubscriptionsTable.id, sub.id));
      } catch (err) {
        logger.error(
          { err, subscriptionId: sub.id, email: sub.email, frequency: freq },
          "Failed to send scheduled city comparison email",
        );
      }
    }
  } catch (err) {
    logger.error({ err }, "Scheduler tick failed");
  } finally {
    runningTick = false;
  }
}

let started = false;
let timer: ReturnType<typeof setInterval> | null = null;

export function startEmailReportScheduler(): void {
  if (started) return;
  started = true;
  // Initial run shortly after boot so missed reports go out promptly.
  setTimeout(() => {
    void tick();
  }, 30 * 1000);
  timer = setInterval(() => {
    void tick();
  }, CHECK_INTERVAL_MS);
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, "Email report scheduler started");
}

export function stopEmailReportScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  started = false;
}
