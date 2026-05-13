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
