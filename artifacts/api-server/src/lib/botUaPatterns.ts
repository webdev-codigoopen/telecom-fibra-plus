import { db, botUaPatternsTable } from "@workspace/db";
import { logger } from "./logger";

export type CachedBotUaPattern = {
  id: number;
  pattern: string;
  label: string;
  enabled: boolean;
  isDefault: boolean;
};

type Cache = {
  patterns: CachedBotUaPattern[];
  combined: string | null;
  combinedRegex: RegExp | null;
};

let cache: Cache = {
  patterns: [],
  combined: null,
  combinedRegex: null,
};

let initialized = false;

// Default seed list — mirrors the historical hardcoded list in
// routes/plans.ts and routes/clicks.ts. Each entry is a single regex chunk
// joined into one big OR-pattern at runtime.
export const DEFAULT_SEED_PATTERNS: ReadonlyArray<{ pattern: string; label: string }> = [
  { pattern: "facebookexternalhit", label: "Facebook" },
  { pattern: "facebookcatalog", label: "Facebook Catalog" },
  { pattern: "facebot", label: "Facebot" },
  { pattern: "twitterbot", label: "Twitter / X" },
  { pattern: "slackbot", label: "Slack" },
  { pattern: "slack-imgproxy", label: "Slack image proxy" },
  { pattern: "linkedinbot", label: "LinkedIn" },
  { pattern: "discordbot", label: "Discord" },
  { pattern: "telegrambot", label: "Telegram" },
  { pattern: "skypeuripreview", label: "Skype" },
  { pattern: "pinterest", label: "Pinterest" },
  { pattern: "embedly", label: "Embedly" },
  { pattern: "quora link preview", label: "Quora link preview" },
  { pattern: "vkshare", label: "VK" },
  { pattern: "w3c_validator", label: "W3C Validator" },
  { pattern: "redditbot", label: "Reddit" },
  { pattern: "applebot", label: "Apple" },
  { pattern: "bingpreview", label: "Bing preview" },
  { pattern: "googlebot", label: "Google" },
  { pattern: "google-inspectiontool", label: "Google Inspection" },
  { pattern: "googleother", label: "GoogleOther" },
  { pattern: "yandexbot", label: "Yandex" },
  { pattern: "duckduckbot", label: "DuckDuckGo" },
  { pattern: "baiduspider", label: "Baidu" },
  { pattern: "petalbot", label: "Petal (Huawei)" },
  { pattern: "chatgpt-user", label: "ChatGPT-User" },
  { pattern: "gptbot", label: "GPTBot" },
  { pattern: "oai-searchbot", label: "OAI SearchBot" },
  { pattern: "perplexitybot", label: "Perplexity" },
  { pattern: "claudebot", label: "ClaudeBot" },
  { pattern: "anthropic-ai", label: "Anthropic-AI" },
  { pattern: "bytespider", label: "ByteSpider" },
];

export function isValidJsRegex(pattern: string): boolean {
  try {
    new RegExp(pattern, "i");
    return true;
  } catch {
    return false;
  }
}

export async function ensureSeeded(): Promise<void> {
  try {
    const rows = await db.select({ id: botUaPatternsTable.id }).from(botUaPatternsTable).limit(1);
    if (rows.length > 0) return;
    await db.insert(botUaPatternsTable).values(
      DEFAULT_SEED_PATTERNS.map((p) => ({
        pattern: p.pattern,
        label: p.label,
        enabled: true,
        isDefault: true,
      })),
    );
    logger.info(
      { count: DEFAULT_SEED_PATTERNS.length },
      "[bot-ua-patterns] seeded default patterns",
    );
  } catch (err) {
    logger.error({ err }, "[bot-ua-patterns] failed to seed defaults");
  }
}

export async function refreshBotUaPatternCache(): Promise<void> {
  try {
    const rows = await db.select().from(botUaPatternsTable).orderBy(botUaPatternsTable.id);
    const patterns: CachedBotUaPattern[] = rows.map((r) => ({
      id: r.id,
      pattern: r.pattern,
      label: r.label,
      enabled: r.enabled,
      isDefault: r.isDefault,
    }));
    const enabled = patterns.filter((p) => p.enabled).map((p) => p.pattern);
    const candidate = enabled.length > 0 ? enabled.join("|") : null;
    let regex: RegExp | null = null;
    let combined: string | null = candidate;
    if (candidate) {
      try {
        regex = new RegExp(candidate, "i");
      } catch (err) {
        logger.error(
          { err, combinedLength: candidate.length },
          "[bot-ua-patterns] failed to compile combined regex; disabling pattern matching (JS + SQL) until fixed",
        );
        // Keep JS-side and SQL-side matching in lockstep: if the combined
        // regex doesn't compile in JS we also stop publishing it for SQL,
        // otherwise routes/clicks.ts would still attempt a Postgres ~* with
        // a string we can't trust.
        regex = null;
        combined = null;
      }
    }
    cache = { patterns, combined, combinedRegex: regex };
    initialized = true;
  } catch (err) {
    logger.error({ err }, "[bot-ua-patterns] failed to refresh cache");
  }
}

export async function initBotUaPatterns(): Promise<void> {
  await ensureSeeded();
  await refreshBotUaPatternCache();
}

export function getCachedPatterns(): CachedBotUaPattern[] {
  return cache.patterns;
}

export function getCombinedUaPattern(): string | null {
  return cache.combined;
}

export function isCacheReady(): boolean {
  return initialized;
}

// Match a UA string against the cached enabled patterns.
// Mirrors the SQL semantics in clicks.ts (case-insensitive ~* match).
export function matchesEnabledPattern(ua: string): boolean {
  return cache.combinedRegex ? cache.combinedRegex.test(ua) : false;
}
