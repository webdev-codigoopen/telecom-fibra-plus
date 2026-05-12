import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const planClicksTable = pgTable("plan_clicks", {
  id: serial("id").primaryKey(),
  planSpeed: text("plan_speed").notNull(),
  planPrice: text("plan_price").notNull(),
  source: text("source").notNull().default("hero"),
  clickedAt: timestamp("clicked_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DbPlanClick = typeof planClicksTable.$inferSelect;
