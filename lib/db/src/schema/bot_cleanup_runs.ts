import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const botCleanupRunsTable = pgTable("bot_cleanup_runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }).notNull(),
  durationMs: integer("duration_ms").notNull(),
  ok: boolean("ok").notNull(),
  rowsRelabeled: integer("rows_relabeled").notNull().default(0),
  rowsRelabeledByUserAgent: integer("rows_relabeled_by_user_agent").notNull().default(0),
  burstGroupsFound: integer("burst_groups_found").notNull().default(0),
  windowSeconds: integer("window_seconds").notNull().default(0),
  minBurst: integer("min_burst").notNull().default(0),
  useUserAgent: boolean("use_user_agent").notNull().default(true),
  trigger: text("trigger").notNull().default("scheduled"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DbBotCleanupRun = typeof botCleanupRunsTable.$inferSelect;
