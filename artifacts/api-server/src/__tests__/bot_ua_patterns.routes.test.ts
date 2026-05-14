import express, { type Express } from "express";
import request from "supertest";
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { sql } from "drizzle-orm";
import { db, botUaPatternsTable, planClicksTable, pool } from "@workspace/db";

// Bypass admin JWT + audit logging in route tests. The auth flow is covered
// by its own tests; here we want to exercise the bot-ua-patterns CRUD and
// preview endpoints in isolation.
vi.mock("../lib/auth", () => ({
  requireAdmin: (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => {
    (req as unknown as { adminUser: unknown }).adminUser = { id: 1, email: "test@example.com" };
    next();
  },
}));

// Avoid actually backfilling clicks during the /apply path; we don't test
// that endpoint here but the import would still pull the real script in.
vi.mock("@workspace/scripts/backfill-share-bot-clicks", () => ({
  backfillShareBotClicks: vi.fn(async () => ({ rowsRelabeledByUserAgent: 0 })),
}));

const TEST_UA_MARKER = "pmf-test-ua-";

async function resetState(): Promise<void> {
  await db.execute(sql`truncate table ${botUaPatternsTable} restart identity cascade`);
  await db.execute(
    sql`delete from ${planClicksTable} where ${planClicksTable.userAgent} like ${TEST_UA_MARKER + "%"}`,
  );
}

let app: Express;

beforeAll(async () => {
  const { default: router } = await import("../routes/bot_ua_patterns");
  const { ensureSeeded, refreshBotUaPatternCache } = await import("../lib/botUaPatterns");
  await resetState();
  await ensureSeeded();
  await refreshBotUaPatternCache();
  app = express();
  app.use(express.json());
  app.use(router);
});

beforeEach(async () => {
  const { ensureSeeded, refreshBotUaPatternCache } = await import("../lib/botUaPatterns");
  await resetState();
  await ensureSeeded();
  await refreshBotUaPatternCache();
});

afterAll(async () => {
  await resetState();
  const { ensureSeeded, refreshBotUaPatternCache } = await import("../lib/botUaPatterns");
  await ensureSeeded();
  await refreshBotUaPatternCache();
  await pool.end();
});

describe("POST /bot-ua-patterns — validation", () => {
  it("rejects an invalid JS regex with 400", async () => {
    const res = await request(app)
      .post("/bot-ua-patterns")
      .send({ pattern: "(unclosed", label: "broken", enabled: true });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/JavaScript/);
  });

  it("rejects a regex Postgres can't compile with 400 (JS-valid, SQL-invalid)", async () => {
    // `[[:notarealclass:]]` is a valid JS regex (parsed as a character class
    // containing the literal chars `[`, `:`, `n`, `o`, ...). Postgres POSIX
    // however parses `[[:name:]]` as a named character class and rejects an
    // unknown name. This guarantees the SQL-side validation branch fires.
    const sqlOnlyInvalid = "[[:notarealclass:]]";
    const { isValidJsRegex } = await import("../lib/botUaPatterns");
    expect(isValidJsRegex(sqlOnlyInvalid)).toBe(true); // sanity: JS accepts it

    const res = await request(app)
      .post("/bot-ua-patterns")
      .send({ pattern: sqlOnlyInvalid, label: "pg-only", enabled: true });
    expect(res.status).toBe(400);
    // Must specifically be the SQL-side validation, not the JS one.
    expect(res.body.error).toMatch(/banco/);
    expect(res.body.error).not.toMatch(/JavaScript/);
  });

  it("creates a valid pattern, returns the row, and refreshes the cache", async () => {
    const { matchesEnabledPattern, getCombinedUaPattern } = await import(
      "../lib/botUaPatterns"
    );
    expect(matchesEnabledPattern("MyTestCrawler/1.0")).toBe(false);
    const beforeCombined = getCombinedUaPattern();

    const res = await request(app)
      .post("/bot-ua-patterns")
      .send({ pattern: "mytestcrawler", label: "MyTest", enabled: true });
    expect(res.status).toBe(201);
    expect(res.body.pattern).toBe("mytestcrawler");
    expect(res.body.isDefault).toBe(false);

    expect(matchesEnabledPattern("MyTestCrawler/1.0")).toBe(true);
    expect(getCombinedUaPattern()).not.toBe(beforeCombined);
  });
});

describe("PATCH /bot-ua-patterns/:id — cache refresh", () => {
  it("disabling an enabled rule removes it from the live matcher", async () => {
    const { matchesEnabledPattern } = await import("../lib/botUaPatterns");
    expect(matchesEnabledPattern("Googlebot/2.1")).toBe(true);
    const [row] = await db
      .select()
      .from(botUaPatternsTable)
      .where(sql`${botUaPatternsTable.pattern} = 'googlebot'`);
    expect(row).toBeDefined();

    const res = await request(app)
      .patch(`/bot-ua-patterns/${row!.id}`)
      .send({ enabled: false });
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);

    expect(matchesEnabledPattern("Googlebot/2.1")).toBe(false);
  });

  it("rejects an invalid pattern update without touching the row", async () => {
    const [row] = await db
      .select()
      .from(botUaPatternsTable)
      .where(sql`${botUaPatternsTable.pattern} = 'googlebot'`);
    const res = await request(app)
      .patch(`/bot-ua-patterns/${row!.id}`)
      .send({ pattern: "(unclosed" });
    expect(res.status).toBe(400);
    const [after] = await db
      .select()
      .from(botUaPatternsTable)
      .where(sql`${botUaPatternsTable.id} = ${row!.id}`);
    expect(after!.pattern).toBe("googlebot");
  });

  it("404s on a non-existent id", async () => {
    const res = await request(app).patch(`/bot-ua-patterns/9999999`).send({ enabled: false });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /bot-ua-patterns/:id — cache refresh", () => {
  it("removes the rule from the live matcher", async () => {
    const { matchesEnabledPattern } = await import("../lib/botUaPatterns");
    const [row] = await db
      .select()
      .from(botUaPatternsTable)
      .where(sql`${botUaPatternsTable.pattern} = 'twitterbot'`);
    expect(matchesEnabledPattern("Twitterbot/1.0")).toBe(true);

    const res = await request(app).delete(`/bot-ua-patterns/${row!.id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    expect(matchesEnabledPattern("Twitterbot/1.0")).toBe(false);
    const remaining = await db
      .select()
      .from(botUaPatternsTable)
      .where(sql`${botUaPatternsTable.id} = ${row!.id}`);
    expect(remaining.length).toBe(0);
  });
});

describe("POST /bot-ua-patterns/preview — matched / wouldFlip math", () => {
  // A token unique enough that no preexisting dev-DB row could possibly
  // match. This lets us assert the endpoint's matched/wouldFlip values
  // exactly, rather than via a >= floor.
  const UNIQUE_TOKEN = "pmftestcrawlerXyZq9999";

  beforeEach(async () => {
    // Wipe any residue from a previous run of this suite.
    await db.execute(
      sql`delete from ${planClicksTable} where ${planClicksTable.userAgent} like ${"%" + UNIQUE_TOKEN + "%"}`,
    );
    // Seed plan_clicks with a controlled mix. With the unique token, no
    // other rows in the DB will match the candidate pattern, so endpoint
    // counts must equal exactly what we insert.
    //   row A — matches AND already bot via existing UA rule (googlebot)
    //   row B — matches, NOT currently flagged as bot         → wouldFlip
    //   row C — matches, already bot via source label
    //   row D — matches, already bot via bare-WhatsApp heuristic
    //   row E — does NOT match (sanity baseline; must be ignored)
    await db.insert(planClicksTable).values([
      {
        planSpeed: "100",
        planPrice: "99.90",
        source: "hero",
        userAgent: `${TEST_UA_MARKER}A ${UNIQUE_TOKEN} (compatible; Googlebot/2.1)`,
      },
      {
        planSpeed: "100",
        planPrice: "99.90",
        source: "hero",
        userAgent: `${TEST_UA_MARKER}B ${UNIQUE_TOKEN} plain`,
      },
      {
        planSpeed: "100",
        planPrice: "99.90",
        source: "whatsapp-share-bot",
        userAgent: `${TEST_UA_MARKER}C ${UNIQUE_TOKEN} via-source`,
      },
      {
        planSpeed: "100",
        planPrice: "99.90",
        source: "hero",
        userAgent: `${TEST_UA_MARKER}D ${UNIQUE_TOKEN} WhatsApp/2.23.10.78`,
      },
      {
        planSpeed: "100",
        planPrice: "99.90",
        source: "hero",
        userAgent: `${TEST_UA_MARKER}E unrelated Mozilla/5.0 Safari`,
      },
    ]);
  });

  it("returns matched = total UA hits and wouldFlip = only the not-yet-bot ones", async () => {
    const res = await request(app)
      .post("/bot-ua-patterns/preview")
      .send({ pattern: UNIQUE_TOKEN });
    expect(res.status).toBe(200);

    // Exact assertions on the endpoint's response payload, not on a
    // recomputed DB query — that's the whole point of this test.
    expect(res.body.matched).toBe(4); // rows A, B, C, D
    expect(res.body.wouldFlip).toBe(1); // only row B (the rest are already bot)

    // total is the row count of the whole table; at least our 5 inserts.
    expect(typeof res.body.total).toBe("number");
    expect(res.body.total).toBeGreaterThanOrEqual(5);

    // sampleUserAgent must come from a matching row.
    expect(typeof res.body.sampleUserAgent).toBe("string");
    expect(String(res.body.sampleUserAgent)).toContain(UNIQUE_TOKEN);
  });

  it("wouldFlip drops to 0 once a matching rule is enabled", async () => {
    // Add the candidate as a real enabled rule. All previously matching rows
    // are now considered bot already, so wouldFlip must collapse to zero
    // even though matched stays the same.
    await db.insert(botUaPatternsTable).values({
      pattern: UNIQUE_TOKEN,
      label: "unique-test",
      enabled: true,
      isDefault: false,
    });
    const { refreshBotUaPatternCache } = await import("../lib/botUaPatterns");
    await refreshBotUaPatternCache();

    const res = await request(app)
      .post("/bot-ua-patterns/preview")
      .send({ pattern: UNIQUE_TOKEN });
    expect(res.status).toBe(200);
    expect(res.body.matched).toBe(4);
    expect(res.body.wouldFlip).toBe(0);
  });

  it("rejects an invalid regex with 400", async () => {
    const res = await request(app)
      .post("/bot-ua-patterns/preview")
      .send({ pattern: "(unclosed" });
    expect(res.status).toBe(400);
  });
});
