import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const faqItemsTable = pgTable("faq_items", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  column: text("column").notNull().default("left"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type DbFaqItem = typeof faqItemsTable.$inferSelect;
