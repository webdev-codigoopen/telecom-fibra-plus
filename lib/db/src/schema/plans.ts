import { pgTable, text, serial, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const plansTable = pgTable("plans", {
  id: serial("id").primaryKey(),
  speed: text("speed").notNull(),
  wifi: text("wifi").notNull(),
  price: text("price").notNull(),
  inclusions: text("inclusions").array().notNull().default([]),
  featured: boolean("featured").notNull().default(false),
  badge: text("badge"),
  bonus: text("bonus"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const insertPlanSchema = createInsertSchema(plansTable).omit({ id: true });
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type DbPlan = typeof plansTable.$inferSelect;
