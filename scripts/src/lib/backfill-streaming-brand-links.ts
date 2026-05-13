import {
  db,
  plansTable,
  streamingBrandsTable,
  planStreamingBrandsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

export interface BackfillResult {
  brandsScanned: number;
  plansScanned: number;
  plansMigrated: number;
  linksInserted: number;
}

/**
 * Idempotent backfill: for any plan that still has a streaming brand name in
 * its `inclusions` text array, insert the matching row into
 * `plan_streaming_brands` (ON CONFLICT DO NOTHING) and remove the brand name
 * from the inclusions array. Safe to run repeatedly — once all brand names
 * have been migrated out of `inclusions`, every subsequent invocation is a
 * no-op.
 */
export async function backfillStreamingBrandLinks(): Promise<BackfillResult> {
  const brands = await db.select().from(streamingBrandsTable);
  const result: BackfillResult = {
    brandsScanned: brands.length,
    plansScanned: 0,
    plansMigrated: 0,
    linksInserted: 0,
  };
  if (brands.length === 0) return result;

  const byLowerName = new Map<string, { id: number; name: string }>();
  for (const b of brands) {
    byLowerName.set(b.name.trim().toLowerCase(), { id: b.id, name: b.name });
  }

  const plans = await db.select().from(plansTable);
  result.plansScanned = plans.length;

  for (const plan of plans) {
    const inclusions = plan.inclusions ?? [];
    const brandHits: { brandId: number; sortOrder: number }[] = [];
    const remaining: string[] = [];
    let pos = 0;
    for (const item of inclusions) {
      const match = byLowerName.get(item.trim().toLowerCase());
      if (match) {
        brandHits.push({ brandId: match.id, sortOrder: pos });
        pos++;
      } else {
        remaining.push(item);
      }
    }
    if (brandHits.length === 0) continue;

    await db.transaction(async (tx) => {
      for (const hit of brandHits) {
        await tx
          .insert(planStreamingBrandsTable)
          .values({
            planId: plan.id,
            brandId: hit.brandId,
            sortOrder: hit.sortOrder,
          })
          .onConflictDoNothing();
      }
      await tx
        .update(plansTable)
        .set({ inclusions: remaining })
        .where(eq(plansTable.id, plan.id));
    });

    result.plansMigrated++;
    result.linksInserted += brandHits.length;
  }

  return result;
}
