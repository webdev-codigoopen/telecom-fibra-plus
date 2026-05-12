import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const streamingBrandsTable = pgTable("streaming_brands", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  logoUrl: text("logo_url"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const insertStreamingBrandSchema = createInsertSchema(streamingBrandsTable).omit({ id: true });
export type InsertStreamingBrand = z.infer<typeof insertStreamingBrandSchema>;
export type DbStreamingBrand = typeof streamingBrandsTable.$inferSelect;
