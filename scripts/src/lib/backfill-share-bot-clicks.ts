import { db, planClicksTable } from "@workspace/db";
import { sql } from "drizzle-orm";

export interface BackfillLogger {
  info: (obj: Record<string, unknown> | string, msg?: string) => void;
  warn?: (obj: Record<string, unknown> | string, msg?: string) => void;
  error?: (obj: Record<string, unknown> | string, msg?: string) => void;
}

export interface BackfillOptions {
  windowSeconds?: number;
  minBurst?: number;
  dryRun?: boolean;
  useUserAgent?: boolean;
  /**
   * Optional override for the bot-UA regex pattern. When omitted, falls back
   * to the historical hardcoded list. The API server passes the admin-managed
   * combined pattern from the bot_ua_patterns table.
   */
  botUaPattern?: string;
  /**
   * When true, skip the same-second burst detection pass and only run the
   * user-agent based relabeling. Used when applying a single new/edited
   * admin pattern to historical rows so we don't accidentally relabel rows
   * unrelated to the pattern being saved.
   */
  skipBurstDetection?: boolean;
  logger?: BackfillLogger;
}

export interface BackfillBurstGroup {
  bucket: string;
  planSpeed: string;
  planPrice: string;
  source: string;
  count: number;
}

export interface BackfillResult {
  windowSeconds: number;
  minBurst: number;
  dryRun: boolean;
  useUserAgent: boolean;
  burstGroupsFound: number;
  burstGroupsSample: BackfillBurstGroup[];
  rowsRelabeled: number;
  rowsRelabeledByUserAgent: number;
}

const DEFAULT_BOT_UA_SQL_PATTERN =
  "facebookexternalhit|facebookcatalog|facebot|twitterbot|slackbot|slack-imgproxy|linkedinbot|discordbot|telegrambot|skypeuripreview|pinterest|embedly|quora link preview|vkshare|w3c_validator|redditbot|applebot|bingpreview|googlebot|google-inspectiontool|googleother|yandexbot|duckduckbot|baiduspider|petalbot|chatgpt-user|gptbot|oai-searchbot|perplexitybot|claudebot|anthropic-ai|bytespider";

const DEFAULT_WINDOW_SECONDS = 1;
const DEFAULT_MIN_BURST = 2;

function consoleLogger(): BackfillLogger {
  return {
    info: (obj, msg) => {
      if (typeof obj === "string") console.log(obj);
      else console.log(msg ?? "", obj);
    },
    warn: (obj, msg) => {
      if (typeof obj === "string") console.warn(obj);
      else console.warn(msg ?? "", obj);
    },
    error: (obj, msg) => {
      if (typeof obj === "string") console.error(obj);
      else console.error(msg ?? "", obj);
    },
  };
}

export async function backfillShareBotClicks(
  opts: BackfillOptions = {},
): Promise<BackfillResult> {
  const windowSeconds = opts.windowSeconds ?? DEFAULT_WINDOW_SECONDS;
  const minBurst = opts.minBurst ?? DEFAULT_MIN_BURST;
  const dryRun = opts.dryRun ?? false;
  const useUserAgent = opts.useUserAgent ?? false;
  const botUaPattern = opts.botUaPattern ?? DEFAULT_BOT_UA_SQL_PATTERN;
  const skipBurstDetection = opts.skipBurstDetection ?? false;
  const log = opts.logger ?? consoleLogger();

  if (!Number.isInteger(windowSeconds) || windowSeconds < 1) {
    throw new Error("windowSeconds must be a positive integer");
  }
  if (!Number.isInteger(minBurst) || minBurst < 2) {
    throw new Error("minBurst must be an integer >= 2");
  }

  log.info(
    { windowSeconds, minBurst, dryRun, useUserAgent },
    "[backfill-share-bot-clicks] starting",
  );

  // Mirrors isBotUserAgent() in artifacts/api-server/src/routes/plans.ts:
  // a row is bot-flagged if its UA matches a known crawler, OR if it is a
  // bare WhatsApp link-preview UA (no browser engine).
  const uaBotPredicate = sql`(
    pc.user_agent ~* ${botUaPattern}
    or (
      pc.user_agent ~* '\\mWhatsApp/[0-9.]+'
      and pc.user_agent !~* 'Mozilla|AppleWebKit|Chrome|Safari'
    )
  )`;
  // Same predicate but unaliased, for the dryRun count query below.
  const uaBotPredicateUnaliased = sql`(
    user_agent ~* ${botUaPattern}
    or (
      user_agent ~* '\\mWhatsApp/[0-9.]+'
      and user_agent !~* 'Mozilla|AppleWebKit|Chrome|Safari'
    )
  )`;

  let rowsRelabeledByUserAgent = 0;
  if (useUserAgent && !dryRun) {
    const uaUpdateSql = sql`
      update ${planClicksTable} as pc
      set source = case
        when pc.source = 'whatsapp-share' then 'whatsapp-share-bot'
        else 'whatsapp-share-bot:' || substring(pc.source from char_length('whatsapp-share:') + 1)
      end
      where (pc.source = 'whatsapp-share' or pc.source like 'whatsapp-share:%')
        and pc.user_agent is not null
        and ${uaBotPredicate}
    `;
    const uaResult = await db.execute(uaUpdateSql);
    rowsRelabeledByUserAgent =
      (uaResult as unknown as { rowCount?: number | null }).rowCount ?? 0;
    log.info(
      { rowsRelabeledByUserAgent },
      `[backfill-share-bot-clicks] relabeled ${rowsRelabeledByUserAgent} rows by user agent`,
    );
  } else if (useUserAgent && dryRun) {
    const uaCount = await db.execute<{ n: number }>(sql`
      select count(*)::int as n
      from ${planClicksTable}
      where (source = 'whatsapp-share' or source like 'whatsapp-share:%')
        and user_agent is not null
        and ${uaBotPredicateUnaliased}
    `);
    const rows = (uaCount as unknown as { rows: Array<{ n: number }> }).rows;
    rowsRelabeledByUserAgent = rows[0]?.n ?? 0;
    log.info(
      { rowsRelabeledByUserAgent },
      `[backfill-share-bot-clicks] would relabel ${rowsRelabeledByUserAgent} rows by user agent (dryRun)`,
    );
  }

  const bucketSeconds = sql.raw(String(windowSeconds));

  if (skipBurstDetection) {
    log.info(
      "[backfill-share-bot-clicks] skipBurstDetection=true — skipping burst pass",
    );
    return {
      windowSeconds,
      minBurst,
      dryRun,
      useUserAgent,
      burstGroupsFound: 0,
      burstGroupsSample: [],
      rowsRelabeled: 0,
      rowsRelabeledByUserAgent,
    };
  }

  const burstRows = await db.execute<{
    bucket: string;
    plan_speed: string;
    plan_price: string;
    source: string;
    n: number;
  }>(sql`
    select
      to_timestamp(floor(extract(epoch from clicked_at) / ${bucketSeconds}) * ${bucketSeconds}) as bucket,
      plan_speed,
      plan_price,
      source,
      count(*)::int as n
    from ${planClicksTable}
    where source = 'whatsapp-share' or source like 'whatsapp-share:%'
    group by 1, 2, 3, 4
    having count(*) >= ${minBurst}
    order by n desc
    limit 50
  `);

  const previewRows = (
    burstRows as unknown as {
      rows: Array<{
        bucket: string;
        plan_speed: string;
        plan_price: string;
        source: string;
        n: number;
      }>;
    }
  ).rows;

  const sample: BackfillBurstGroup[] = previewRows.slice(0, 10).map((r) => ({
    bucket: r.bucket,
    planSpeed: r.plan_speed,
    planPrice: r.plan_price,
    source: r.source,
    count: r.n,
  }));

  log.info(
    { burstGroupsFound: previewRows.length, sample },
    `[backfill-share-bot-clicks] found ${previewRows.length} burst groups`,
  );

  if (dryRun) {
    log.info("[backfill-share-bot-clicks] dryRun=true — no rows updated");
    return {
      windowSeconds,
      minBurst,
      dryRun,
      useUserAgent,
      burstGroupsFound: previewRows.length,
      burstGroupsSample: sample,
      rowsRelabeled: 0,
      rowsRelabeledByUserAgent,
    };
  }

  const updateSql = sql`
    with bursts as (
      select
        to_timestamp(floor(extract(epoch from clicked_at) / ${bucketSeconds}) * ${bucketSeconds}) as bucket,
        plan_speed,
        plan_price,
        source
      from ${planClicksTable}
      where source = 'whatsapp-share' or source like 'whatsapp-share:%'
      group by 1, 2, 3, 4
      having count(*) >= ${minBurst}
    )
    update ${planClicksTable} as pc
    set source = case
      when pc.source = 'whatsapp-share' then 'whatsapp-share-bot'
      else 'whatsapp-share-bot:' || substring(pc.source from char_length('whatsapp-share:') + 1)
    end
    from bursts b
    where (pc.source = 'whatsapp-share' or pc.source like 'whatsapp-share:%')
      and pc.plan_speed = b.plan_speed
      and pc.plan_price = b.plan_price
      and pc.source = b.source
      and to_timestamp(floor(extract(epoch from pc.clicked_at) / ${bucketSeconds}) * ${bucketSeconds}) = b.bucket
  `;

  const result = await db.execute(updateSql);
  const rowsRelabeled =
    (result as unknown as { rowCount?: number | null }).rowCount ?? 0;

  log.info(
    { rowsRelabeled },
    `[backfill-share-bot-clicks] relabeled ${rowsRelabeled} rows from whatsapp-share* to whatsapp-share-bot*`,
  );

  return {
    windowSeconds,
    minBurst,
    dryRun,
    useUserAgent,
    burstGroupsFound: previewRows.length,
    burstGroupsSample: sample,
    rowsRelabeled,
    rowsRelabeledByUserAgent,
  };
}
