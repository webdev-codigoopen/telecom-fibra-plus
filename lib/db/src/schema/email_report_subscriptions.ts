import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const emailReportSubscriptionsTable = pgTable(
  "email_report_subscriptions",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    reportType: text("report_type").notNull().default("city_comparison"),
    frequency: text("frequency").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
    quietHoursEnabled: boolean("quiet_hours_enabled").notNull().default(false),
    quietHoursStart: text("quiet_hours_start").notNull().default("22:00"),
    quietHoursEnd: text("quiet_hours_end").notNull().default("08:00"),
    quietHoursWeekends: boolean("quiet_hours_weekends")
      .notNull()
      .default(false),
    quietHoursMode: text("quiet_hours_mode").notNull().default("queue"),
    quietHoursActiveSince: timestamp("quiet_hours_active_since", {
      withTimezone: true,
    }),
    quietHoursLastDigestSentAt: timestamp("quiet_hours_last_digest_sent_at", {
      withTimezone: true,
    }),
    belowTargetLastCities: text("below_target_last_cities"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export type DbEmailReportSubscription =
  typeof emailReportSubscriptionsTable.$inferSelect;
