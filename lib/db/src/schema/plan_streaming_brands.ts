import { pgTable, integer, primaryKey } from "drizzle-orm/pg-core";
import { plansTable } from "./plans";
import { streamingBrandsTable } from "./streaming_brands";

export const planStreamingBrandsTable = pgTable(
  "plan_streaming_brands",
  {
    planId: integer("plan_id")
      .notNull()
      .references(() => plansTable.id, { onDelete: "cascade" }),
    brandId: integer("brand_id")
      .notNull()
      .references(() => streamingBrandsTable.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.planId, t.brandId] })],
);

export type DbPlanStreamingBrand = typeof planStreamingBrandsTable.$inferSelect;
