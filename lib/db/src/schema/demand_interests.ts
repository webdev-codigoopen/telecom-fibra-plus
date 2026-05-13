import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const demandInterestsTable = pgTable("demand_interests", {
  id: serial("id").primaryKey(),
  city: text("city").notNull(),
  neighborhood: text("neighborhood").notNull(),
  whatsapp: text("whatsapp").notNull(),
  status: text("status").notNull().default("novo"),
  note: text("note"),
  ipHash: text("ip_hash"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DbDemandInterest = typeof demandInterestsTable.$inferSelect;
