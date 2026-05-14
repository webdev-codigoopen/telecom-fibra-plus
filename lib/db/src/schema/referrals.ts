import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  indicadorNome: text("indicador_nome").notNull(),
  indicadorTelefone: text("indicador_telefone").notNull(),
  indicadorCidade: text("indicador_cidade").notNull(),
  indicadorCpf: text("indicador_cpf").notNull(),
  amigoNome: text("amigo_nome").notNull(),
  amigoTelefone: text("amigo_telefone").notNull(),
  amigoCidade: text("amigo_cidade").notNull(),
  amigoCpf: text("amigo_cpf").notNull(),
  status: text("status").notNull().default("novo"),
  note: text("note"),
  ipHash: text("ip_hash"),
  userAgent: text("user_agent"),
  whatsappNotifiedAt: timestamp("whatsapp_notified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type DbReferral = typeof referralsTable.$inferSelect;
