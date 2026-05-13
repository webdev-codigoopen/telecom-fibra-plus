import { pgTable, serial, integer, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const adminUsersTable = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const adminAuditLogTable = pgTable("admin_audit_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  email: text("email"),
  action: text("action").notNull(),
  method: text("method").notNull(),
  path: text("path").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  status: text("status").notNull().default("ok"),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DbAdminUser = typeof adminUsersTable.$inferSelect;
export type DbAdminAuditLog = typeof adminAuditLogTable.$inferSelect;
