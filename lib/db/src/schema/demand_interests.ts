import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const demandInterestsTable = pgTable("demand_interests", {
  id: serial("id").primaryKey(),
  city: text("city").notNull(),
  neighborhood: text("neighborhood").notNull(),
  whatsapp: text("whatsapp").notNull(),
  ipHash: text("ip_hash"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DbDemandInterest = typeof demandInterestsTable.$inferSelect;
