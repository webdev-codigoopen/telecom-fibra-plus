import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const whatsappNotifyDestinationsTable = pgTable(
  "whatsapp_notify_destinations",
  {
    id: serial("id").primaryKey(),
    label: text("label"),
    number: text("number").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    frequency: text("frequency").notNull().default("instant"),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export type DbWhatsappNotifyDestination =
  typeof whatsappNotifyDestinationsTable.$inferSelect;
