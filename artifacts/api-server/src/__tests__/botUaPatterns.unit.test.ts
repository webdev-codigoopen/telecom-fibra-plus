import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { db, botUaPatternsTable, planClicksTable, pool } from "@workspace/db";
import {
  DEFAULT_SEED_PATTERNS,
  ensureSeeded,
  refreshBotUaPatternCache,
  isValidJsRegex,
  getCachedPatterns,
  getCombinedUaPattern,
  matchesEnabledPattern,
  matchesWhatsappHeuristic,
  findMatchingPattern,
} from "../lib/botUaPatterns";
import { buildIsBotSqlExpr } from "../routes/clicks";

async function resetPatternsTable(): Promise<void> {
  await db.execute(sql`truncate table ${botUaPatternsTable} restart identity cascade`);
}

const dialect = new PgDialect();

describe("botUaPatterns lib", () => {
  beforeEach(async () => {
    await resetPatternsTable();
    await refreshBotUaPatternCache();
  });

  afterAll(async () => {
    // Leave the dev DB in a usable state: re-seed defaults so the running
    // app (and subsequent test files) start from the canonical seed list.
    await resetPatternsTable();
    await ensureSeeded();
    await refreshBotUaPatternCache();
    await pool.end();
  });

  describe("isValidJsRegex", () => {
    it("accepts well-formed patterns", () => {
      expect(isValidJsRegex("googlebot")).toBe(true);
      expect(isValidJsRegex("foo|bar")).toBe(true);
      expect(isValidJsRegex("\\bWhatsApp/[0-9.]+")).toBe(true);
    });
    it("rejects malformed patterns", () => {
      expect(isValidJsRegex("(unclosed")).toBe(false);
      expect(isValidJsRegex("[a-")).toBe(false);
      expect(isValidJsRegex("*leading-quantifier")).toBe(false);
    });
  });

  describe("ensureSeeded idempotency", () => {
    it("seeds defaults exactly once across repeated calls", async () => {
      await ensureSeeded();
      const first = await db.select().from(botUaPatternsTable);
      expect(first.length).toBe(DEFAULT_SEED_PATTERNS.length);
      expect(first.every((r) => r.isDefault)).toBe(true);

      // Calling again must NOT duplicate rows.
      await ensureSeeded();
      await ensureSeeded();
      const after = await db.select().from(botUaPatternsTable);
      expect(after.length).toBe(DEFAULT_SEED_PATTERNS.length);

      // Patterns and labels match the seed list.
      const seenPatterns = new Set(after.map((r) => r.pattern));
      for (const seed of DEFAULT_SEED_PATTERNS) {
        expect(seenPatterns.has(seed.pattern)).toBe(true);
      }
    });
  });

  describe("cache + matching", () => {
    it("matches enabled crawler UAs and ignores real browsers", async () => {
      await ensureSeeded();
      await refreshBotUaPatternCache();

      expect(matchesEnabledPattern("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
      expect(matchesEnabledPattern("facebookexternalhit/1.1")).toBe(true);
      expect(matchesEnabledPattern("Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Safari")).toBe(false);
    });

    it("matches the bare-WhatsApp heuristic only without real browser tokens", () => {
      expect(matchesWhatsappHeuristic("WhatsApp/2.23.10.78 A")).toBe(true);
      // A real browser UA that happens to mention WhatsApp must not be flagged.
      expect(matchesWhatsappHeuristic("Mozilla/5.0 WhatsApp/2.23 Chrome/118")).toBe(false);
      expect(matchesWhatsappHeuristic("plain browser")).toBe(false);
    });

    it("findMatchingPattern returns the rule that caught the UA, with current label", async () => {
      await ensureSeeded();
      await refreshBotUaPatternCache();
      const m = findMatchingPattern("Mozilla/5.0 (compatible; Googlebot/2.1)");
      expect(m).not.toBeNull();
      expect(m!.label).toBe("Google");
    });

    it("invalidates the per-pattern cache after a label edit", async () => {
      await ensureSeeded();
      await refreshBotUaPatternCache();
      // Warm the per-pattern cache.
      findMatchingPattern("Mozilla/5.0 Googlebot/2.1");
      // Rename the Google rule and refresh cache.
      await db
        .update(botUaPatternsTable)
        .set({ label: "Google (renamed)" })
        .where(sql`${botUaPatternsTable.pattern} = 'googlebot'`);
      await refreshBotUaPatternCache();
      const m = findMatchingPattern("Mozilla/5.0 Googlebot/2.1");
      expect(m).not.toBeNull();
      expect(m!.label).toBe("Google (renamed)");
    });

    it("disables JS+SQL matching together when the combined regex fails to compile", async () => {
      // Insert a pattern that is invalid as a regex (unclosed group) so the
      // OR-joined combined regex fails. The cache must publish null on BOTH
      // sides so SQL never sees a string JS can't trust.
      await db.insert(botUaPatternsTable).values({
        pattern: "(unclosed",
        label: "broken",
        enabled: true,
        isDefault: false,
      });
      await refreshBotUaPatternCache();
      expect(getCombinedUaPattern()).toBeNull();
      expect(matchesEnabledPattern("anything")).toBe(false);
    });

    it("excludes disabled patterns from the combined regex", async () => {
      await ensureSeeded();
      await db
        .update(botUaPatternsTable)
        .set({ enabled: false })
        .where(sql`${botUaPatternsTable.pattern} = 'googlebot'`);
      await refreshBotUaPatternCache();
      const cached = getCachedPatterns();
      const google = cached.find((p) => p.pattern === "googlebot");
      expect(google?.enabled).toBe(false);
      expect(matchesEnabledPattern("Googlebot/2.1")).toBe(false);
      // Other crawlers still match.
      expect(matchesEnabledPattern("facebookexternalhit/1.1")).toBe(true);
    });
  });

  describe("buildIsBotSqlExpr snapshot", () => {
    it("with default seeds, the combined OR-pattern equals the historical hardcoded list", async () => {
      await ensureSeeded();
      await refreshBotUaPatternCache();
      const expected = DEFAULT_SEED_PATTERNS.map((p) => p.pattern).join("|");
      expect(getCombinedUaPattern()).toBe(expected);
    });

    it("renders the same SQL shape as the prior hardcoded expression", async () => {
      await ensureSeeded();
      await refreshBotUaPatternCache();
      const combined = DEFAULT_SEED_PATTERNS.map((p) => p.pattern).join("|");

      // The "prior hardcoded" reference: the dynamic expression with the
      // default seed list inlined as a single string literal.
      const reference = sql<boolean>`(
      ${planClicksTable.source} like 'whatsapp-share-bot%'
      or (
        ${planClicksTable.userAgent} is not null
        and (
          ${planClicksTable.userAgent} ~* ${combined}
          or (
            ${planClicksTable.userAgent} ~* '\\mWhatsApp/[0-9.]+'
            and ${planClicksTable.userAgent} !~* 'Mozilla|AppleWebKit|Chrome|Safari'
          )
        )
      )
    )`;

      const actualQuery = dialect.sqlToQuery(buildIsBotSqlExpr().getSQL());
      const expectedQuery = dialect.sqlToQuery(reference.getSQL());
      expect(actualQuery.sql).toBe(expectedQuery.sql);
      expect(actualQuery.params).toEqual(expectedQuery.params);
    });

    it("falls back to the WhatsApp-only branch when the cache is empty", async () => {
      // No rows seeded → combined is null.
      await refreshBotUaPatternCache();
      expect(getCombinedUaPattern()).toBeNull();

      const reference = sql<boolean>`(
    ${planClicksTable.source} like 'whatsapp-share-bot%'
    or (
      ${planClicksTable.userAgent} is not null
      and ${planClicksTable.userAgent} ~* '\\mWhatsApp/[0-9.]+'
      and ${planClicksTable.userAgent} !~* 'Mozilla|AppleWebKit|Chrome|Safari'
    )
  )`;

      const actualQuery = dialect.sqlToQuery(buildIsBotSqlExpr().getSQL());
      const expectedQuery = dialect.sqlToQuery(reference.getSQL());
      expect(actualQuery.sql).toBe(expectedQuery.sql);
    });
  });
});
