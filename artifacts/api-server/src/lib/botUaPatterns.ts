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
    // Invalidate the per-pattern compiled cache so label changes (and any
    // other pattern edits) are picked up on the very next match call.
    perPatternRegexCache = null;
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

// Return the first enabled pattern that matches `ua`, or null. Used by the
// admin "recent clicks" view so each bot-flagged row can show *which* rule
// caught it. We compile each pattern individually here (case-insensitive,
// matching the combined-regex semantics) and cache the compiled list lazily
// so repeated calls within a request don't re-parse every regex.
let perPatternRegexCache: { signature: string; entries: { id: number; label: string; regex: RegExp }[] } | null = null;

function getPerPatternRegexes(): { id: number; label: string; regex: RegExp }[] {
  const enabled = cache.patterns.filter((p) => p.enabled);
  const signature = enabled.map((p) => `${p.id}:${p.pattern}`).join("|");
  if (perPatternRegexCache && perPatternRegexCache.signature === signature) {
    return perPatternRegexCache.entries;
  }
  const entries: { id: number; label: string; regex: RegExp }[] = [];
  for (const p of enabled) {
    try {
      entries.push({ id: p.id, label: p.label, regex: new RegExp(p.pattern, "i") });
    } catch {
      // Skip invalid individual patterns; refreshBotUaPatternCache already
      // disables the combined regex if the OR-join fails to compile, so a
      // single broken entry just gets ignored here.
    }
  }
  perPatternRegexCache = { signature, entries };
  return entries;
}

export function findMatchingPattern(
  ua: string,
): { id: number; label: string } | null {
  for (const e of getPerPatternRegexes()) {
    if (e.regex.test(ua)) return { id: e.id, label: e.label };
  }
  return null;
}

// Mirrors the WhatsApp link-preview heuristic in routes/clicks.ts:
// bare `WhatsApp/<version>` UA without a real browser token.
// Case-insensitive to match Postgres ~*/!~* semantics in buildIsBotSqlExpr.
const WHATSAPP_HEURISTIC_RE = /\bWhatsApp\/[0-9.]+/i;
const REAL_BROWSER_TOKENS_RE = /Mozilla|AppleWebKit|Chrome|Safari/i;

export function matchesWhatsappHeuristic(ua: string): boolean {
  return WHATSAPP_HEURISTIC_RE.test(ua) && !REAL_BROWSER_TOKENS_RE.test(ua);
}
