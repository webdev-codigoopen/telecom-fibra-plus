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
  burstGroupsFound: number;
  burstGroupsSample: BackfillBurstGroup[];
  rowsRelabeled: number;
}

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
  const log = opts.logger ?? consoleLogger();

  if (!Number.isInteger(windowSeconds) || windowSeconds < 1) {
    throw new Error("windowSeconds must be a positive integer");
  }
  if (!Number.isInteger(minBurst) || minBurst < 2) {
    throw new Error("minBurst must be an integer >= 2");
  }

  log.info(
    { windowSeconds, minBurst, dryRun },
    "[backfill-share-bot-clicks] starting",
  );

  const bucketSeconds = sql.raw(String(windowSeconds));

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
      burstGroupsFound: previewRows.length,
      burstGroupsSample: sample,
      rowsRelabeled: 0,
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
    burstGroupsFound: previewRows.length,
    burstGroupsSample: sample,
    rowsRelabeled,
  };
}
