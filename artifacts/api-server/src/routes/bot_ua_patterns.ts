import { Router, type IRouter } from "express";
import { db, botUaPatternsTable, planClicksTable } from "@workspace/db";
import { sql, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin as requireAdminKey } from "../lib/auth";
import {
  refreshBotUaPatternCache,
  getCombinedUaPattern,
  isValidJsRegex,
} from "../lib/botUaPatterns";
import { backfillShareBotClicks } from "@workspace/scripts/backfill-share-bot-clicks";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const patternSchema = z.object({
  pattern: z.string().trim().min(1).max(500),
  label: z.string().trim().max(120).default(""),
  enabled: z.boolean().default(true),
});

const updateSchema = z.object({
  pattern: z.string().trim().min(1).max(500).optional(),
  label: z.string().trim().max(120).optional(),
  enabled: z.boolean().optional(),
});

router.get("/bot-ua-patterns", requireAdminKey, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(botUaPatternsTable)
      .orderBy(desc(botUaPatternsTable.enabled), botUaPatternsTable.label, botUaPatternsTable.id);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch bot UA patterns" });
  }
});

// Validate that Postgres can compile the pattern as well — a pattern that's
// valid in JS may still be invalid in PCRE-style POSIX, and vice versa. We
// run a no-op match that triggers regex compilation.
async function validateSqlRegex(pattern: string): Promise<string | null> {
  try {
    await db.execute(sql`select ('x' ~* ${pattern})::boolean as ok`);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "Padrão regex inválido para o banco";
  }
}

router.post("/bot-ua-patterns", requireAdminKey, async (req, res) => {
  const parsed = patternSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    return;
  }
  if (!isValidJsRegex(parsed.data.pattern)) {
    res.status(400).json({ error: "Expressão regular inválida (JavaScript)" });
    return;
  }
  const sqlErr = await validateSqlRegex(parsed.data.pattern);
  if (sqlErr) {
    res.status(400).json({ error: `Expressão regular inválida no banco: ${sqlErr}` });
    return;
  }
  try {
    const [row] = await db
      .insert(botUaPatternsTable)
      .values({
        pattern: parsed.data.pattern,
        label: parsed.data.label,
        enabled: parsed.data.enabled,
        isDefault: false,
      })
      .returning();
    await refreshBotUaPatternCache();
    res.status(201).json(row);
  } catch {
    res.status(500).json({ error: "Falha ao criar padrão" });
  }
});

router.patch("/bot-ua-patterns/:id", requireAdminKey, async (req, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "Nada para atualizar" });
    return;
  }
  if (parsed.data.pattern !== undefined) {
    if (!isValidJsRegex(parsed.data.pattern)) {
      res.status(400).json({ error: "Expressão regular inválida (JavaScript)" });
      return;
    }
    const sqlErr = await validateSqlRegex(parsed.data.pattern);
    if (sqlErr) {
      res.status(400).json({ error: `Expressão regular inválida no banco: ${sqlErr}` });
      return;
    }
  }
  try {
    const setData: Record<string, unknown> = { updatedAt: sql`now()` };
    if (parsed.data.pattern !== undefined) setData["pattern"] = parsed.data.pattern;
    if (parsed.data.label !== undefined) setData["label"] = parsed.data.label;
    if (parsed.data.enabled !== undefined) setData["enabled"] = parsed.data.enabled;
    const [row] = await db
      .update(botUaPatternsTable)
      .set(setData)
      .where(eq(botUaPatternsTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Padrão não encontrado" });
      return;
    }
    await refreshBotUaPatternCache();
    res.json(row);
  } catch {
    res.status(500).json({ error: "Falha ao atualizar padrão" });
  }
});

router.delete("/bot-ua-patterns/:id", requireAdminKey, async (req, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  try {
    const [row] = await db
      .delete(botUaPatternsTable)
      .where(eq(botUaPatternsTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Padrão não encontrado" });
      return;
    }
    await refreshBotUaPatternCache();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Falha ao remover padrão" });
  }
});

// Preview how many existing rows the candidate pattern would match, and how
// many of those would *flip* from "human" to "bot" (i.e. are not already
// flagged today via UA, source, or the bare-WhatsApp heuristic).
const previewSchema = z.object({
  pattern: z.string().trim().min(1).max(500),
});

router.post("/bot-ua-patterns/preview", requireAdminKey, async (req, res) => {
  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos" });
    return;
  }
  if (!isValidJsRegex(parsed.data.pattern)) {
    res.status(400).json({ error: "Expressão regular inválida (JavaScript)" });
    return;
  }
  const sqlErr = await validateSqlRegex(parsed.data.pattern);
  if (sqlErr) {
    res.status(400).json({ error: `Expressão regular inválida no banco: ${sqlErr}` });
    return;
  }
  try {
    const combined = getCombinedUaPattern();
    // Mirrors isBotSqlExpr semantics in clicks.ts
    const currentBotPredicate = combined
      ? sql`(${planClicksTable.source} like 'whatsapp-share-bot%' or (${planClicksTable.userAgent} is not null and (${planClicksTable.userAgent} ~* ${combined} or (${planClicksTable.userAgent} ~* '\\mWhatsApp/[0-9.]+' and ${planClicksTable.userAgent} !~* 'Mozilla|AppleWebKit|Chrome|Safari'))))`
      : sql`(${planClicksTable.source} like 'whatsapp-share-bot%' or (${planClicksTable.userAgent} is not null and ${planClicksTable.userAgent} ~* '\\mWhatsApp/[0-9.]+' and ${planClicksTable.userAgent} !~* 'Mozilla|AppleWebKit|Chrome|Safari'))`;

    const result = await db.execute<{
      total: number;
      matched: number;
      would_flip: number;
      sample_ua: string | null;
    }>(sql`
      select
        count(*)::int as total,
        count(*) filter (where user_agent is not null and user_agent ~* ${parsed.data.pattern})::int as matched,
        count(*) filter (where user_agent is not null and user_agent ~* ${parsed.data.pattern} and not ${currentBotPredicate})::int as would_flip,
        (
          select user_agent from ${planClicksTable}
          where user_agent is not null and user_agent ~* ${parsed.data.pattern}
          order by clicked_at desc
          limit 1
        ) as sample_ua
      from ${planClicksTable}
    `);
    const rows = (result as unknown as { rows: Array<{ total: number; matched: number; would_flip: number; sample_ua: string | null }> }).rows;
    const row = rows[0] ?? { total: 0, matched: 0, would_flip: 0, sample_ua: null };
    res.json({
      total: row.total ?? 0,
      matched: row.matched ?? 0,
      wouldFlip: row.would_flip ?? 0,
      sampleUserAgent: row.sample_ua ?? null,
    });
  } catch {
    res.status(500).json({ error: "Falha ao avaliar padrão" });
  }
});

// One-shot relabel of historical rows whose user-agent matches the supplied
// pattern. Mirrors the user-agent pass of the daily bot-cleanup backfill, but
// is scoped to a single admin-supplied pattern so saving a new/edited rule can
// retroactively flip already-stored clicks from "human" to "bot".
const applySchema = z.object({
  pattern: z.string().trim().min(1).max(500),
});

router.post("/bot-ua-patterns/apply", requireAdminKey, async (req, res) => {
  const parsed = applySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos" });
    return;
  }
  if (!isValidJsRegex(parsed.data.pattern)) {
    res.status(400).json({ error: "Expressão regular inválida (JavaScript)" });
    return;
  }
  const sqlErr = await validateSqlRegex(parsed.data.pattern);
  if (sqlErr) {
    res.status(400).json({ error: `Expressão regular inválida no banco: ${sqlErr}` });
    return;
  }
  try {
    const result = await backfillShareBotClicks({
      useUserAgent: true,
      botUaPattern: parsed.data.pattern,
      skipBurstDetection: true,
      logger: {
        info: (obj, msg) => {
          if (typeof obj === "string") logger.info(obj);
          else logger.info(obj, msg);
        },
        warn: (obj, msg) => {
          if (typeof obj === "string") logger.warn(obj);
          else logger.warn(obj, msg);
        },
        error: (obj, msg) => {
          if (typeof obj === "string") logger.error(obj);
          else logger.error(obj, msg);
        },
      },
    });
    res.json({ rowsRelabeled: result.rowsRelabeledByUserAgent });
  } catch (err) {
    logger.error({ err }, "[bot-ua-patterns] apply failed");
    res.status(500).json({ error: "Falha ao aplicar padrão a cliques existentes" });
  }
});

export default router;
