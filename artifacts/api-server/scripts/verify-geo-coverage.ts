// Usage:
//   pnpm --filter @workspace/api-server exec tsx scripts/verify-geo-coverage.ts
//   pnpm --filter @workspace/api-server exec tsx scripts/verify-geo-coverage.ts --since=2026-05-01
//
// Sanity-check that POST /clicks is correctly resolving geolocation for new
// rows. Because we deliberately do NOT store the raw IP (only a salted SHA-256
// hash for LGPD), this script cannot retroactively backfill country/city for
// historical rows. Instead it answers the operational question: "going
// forward, are new clicks landing without a country_code?". A non-zero count
// usually points to a misconfigured proxy that strips X-Forwarded-For, or to
// an IP that isn't in the bundled geoip-lite database (e.g. private/loopback
// ranges hitting the API directly).
//
// Exits with code 0 when no missing rows are found in the inspected window,
// and code 1 otherwise so it can be wired into a cron / monitoring pipeline.

import { and, desc, gte, isNull, sql } from "drizzle-orm";
import { db, planClicksTable } from "@workspace/db";

function parseSince(): Date {
  const arg = process.argv.find((a) => a.startsWith("--since="));
  if (arg) {
    const raw = arg.slice("--since=".length);
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      console.error(`ERR: --since="${raw}" não é uma data ISO válida.`);
      process.exit(2);
    }
    return parsed;
  }
  // Default window: last 24h, which is the most common operational question
  // ("are clicks landing without geo right now?").
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

async function main(): Promise<void> {
  const since = parseSince();

  const [totals] = await db
    .select({
      total: sql<number>`cast(count(*) as int)`,
      missingGeo: sql<number>`cast(count(*) filter (where ${planClicksTable.countryCode} is null) as int)`,
      withGeo: sql<number>`cast(count(*) filter (where ${planClicksTable.countryCode} is not null) as int)`,
    })
    .from(planClicksTable)
    .where(gte(planClicksTable.clickedAt, since));

  const total = totals?.total ?? 0;
  const missing = totals?.missingGeo ?? 0;
  const withGeo = totals?.withGeo ?? 0;

  console.log(`Janela inspecionada: desde ${since.toISOString()}`);
  console.log(`  Total de cliques:        ${total}`);
  console.log(`  Com país identificado:   ${withGeo}`);
  console.log(`  Sem país (country_code): ${missing}`);

  if (total === 0) {
    console.log("Nenhum clique no período. Nada a verificar.");
    process.exit(0);
  }

  if (missing === 0) {
    console.log("OK: 100% dos cliques recentes têm país identificado.");
    process.exit(0);
  }

  // Show a small sample of the offending rows so an operator can inspect the
  // user-agent / source / hashed IP and figure out whether the proxy is
  // stripping X-Forwarded-For or whether the IP is genuinely unresolvable
  // (private range, loopback, brand-new allocation, etc.).
  const sample = await db
    .select({
      id: planClicksTable.id,
      clickedAt: planClicksTable.clickedAt,
      source: planClicksTable.source,
      ipHash: planClicksTable.ipHash,
      userAgent: planClicksTable.userAgent,
    })
    .from(planClicksTable)
    .where(and(gte(planClicksTable.clickedAt, since), isNull(planClicksTable.countryCode)))
    .orderBy(desc(planClicksTable.clickedAt))
    .limit(10);

  console.log("\nAmostra de cliques sem geo (até 10):");
  for (const r of sample) {
    console.log(
      `  ${r.clickedAt.toISOString()}  source=${r.source}  ipHash=${r.ipHash ?? "(null)"}  ua=${(r.userAgent ?? "").slice(0, 80)}`,
    );
  }

  console.log(
    "\nProvável causa: proxy reescrevendo/removendo X-Forwarded-For, ou IP em faixa privada/loopback chegando direto na API.",
  );
  process.exit(1);
}

void main().catch((err) => {
  console.error("Falha ao verificar cobertura geo:", err);
  process.exit(2);
});
