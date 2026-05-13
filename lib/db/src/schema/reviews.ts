import { pgTable, serial, text, integer, timestamp, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";

export const reviewsTable = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull().default("manual"), // 'manual' | 'google'
    externalId: text("external_id"), // Google review id (for upsert)
    authorName: text("author_name").notNull(),
    authorAvatarUrl: text("author_avatar_url"),
    rating: integer("rating").notNull(),
    text: text("text").notNull(),
    city: text("city"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    visible: boolean("visible").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    visibleRatingIdx: index("reviews_visible_rating_idx").on(t.visible, t.rating),
    sourceExternalUq: uniqueIndex("reviews_source_external_uq").on(t.source, t.externalId),
  }),
);

export type DbReview = typeof reviewsTable.$inferSelect;
