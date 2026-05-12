import { db, planClicksTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const WINDOW_SECONDS = Number(process.env["BACKFILL_BURST_WINDOW_SECONDS"] ?? "1");
const MIN_BURST = Number(process.env["BACKFILL_BURST_MIN_ROWS"] ?? "2");
const DRY_RUN = process.env["BACKFILL_DRY_RUN"] === "1";

if (!Number.isInteger(WINDOW_SECONDS) || WINDOW_SECONDS < 1) {
  throw new Error("BACKFILL_BURST_WINDOW_SECONDS must be a positive integer");
}
if (!Number.isInteger(MIN_BURST) || MIN_BURST < 2) {
  throw new Error("BACKFILL_BURST_MIN_ROWS must be an integer >= 2");
}

async function main(): Promise<void> {
  console.log(
    `[backfill] window=${WINDOW_SECONDS}s minBurst=${MIN_BURST} dryRun=${DRY_RUN}`,
  );

  const bucketSeconds = sql.raw(String(WINDOW_SECONDS));

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
    having count(*) >= ${MIN_BURST}
    order by n desc
    limit 50
  `);

  const previewRows = (burstRows as unknown as { rows: Array<{ bucket: string; plan_speed: string; plan_price: string; source: string; n: number }> }).rows;
  console.log(`[backfill] found ${previewRows.length} burst groups (showing up to 50):`);
  for (const r of previewRows.slice(0, 10)) {
    console.log(`  - ${r.bucket} | ${r.plan_speed} MEGA / R$${r.plan_price} | ${r.source} x${r.n}`);
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
      having count(*) >= ${MIN_BURST}
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

  if (DRY_RUN) {
    console.log("[backfill] DRY_RUN=1 — no rows updated.");
    return;
  }

  const result = await db.execute(updateSql);
  const rowCount = (result as unknown as { rowCount?: number | null }).rowCount ?? 0;
  console.log(`[backfill] relabeled ${rowCount} rows from whatsapp-share* to whatsapp-share-bot*`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill] failed:", err);
    process.exit(1);
  });
