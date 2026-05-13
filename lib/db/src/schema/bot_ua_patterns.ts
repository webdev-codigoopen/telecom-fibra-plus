import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const botUaPatternsTable = pgTable("bot_ua_patterns", {
  id: serial("id").primaryKey(),
  pattern: text("pattern").notNull(),
  label: text("label").notNull().default(""),
  enabled: boolean("enabled").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DbBotUaPattern = typeof botUaPatternsTable.$inferSelect;
