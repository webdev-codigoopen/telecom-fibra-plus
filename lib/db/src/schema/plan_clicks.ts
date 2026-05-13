import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";

export const planClicksTable = pgTable(
  "plan_clicks",
  {
    id: serial("id").primaryKey(),
    planSpeed: text("plan_speed").notNull(),
    planPrice: text("plan_price").notNull(),
    source: text("source").notNull().default("hero"),
    city: text("city"),
    userAgent: text("user_agent"),
    // LGPD: never store the raw IP. We keep a one-way hash (SHA-256 + server salt)
    // so we can de-duplicate / debug without retaining personal data.
    ipHash: text("ip_hash"),
    // ISO 3166-1 alpha-2 (e.g. "BR", "US"). Derived from IP at insert time.
    countryCode: text("country_code"),
    countryName: text("country_name"),
    geoRegion: text("geo_region"),
    // City as derived from IP (separate from the `city` column above, which stores
    // the page/CTA city slug picked by the visitor).
    geoCity: text("geo_city"),
    clickedAt: timestamp("clicked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    countryCodeIdx: index("plan_clicks_country_code_idx").on(t.countryCode),
  }),
);

export type DbPlanClick = typeof planClicksTable.$inferSelect;
