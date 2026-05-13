import { backfillStreamingBrandLinks } from "./lib/backfill-streaming-brand-links";

backfillStreamingBrandLinks()
  .then((result) => {
    console.log(
      `[backfill-streaming-brand-links] done — brandsScanned=${result.brandsScanned} plansScanned=${result.plansScanned} plansMigrated=${result.plansMigrated} linksInserted=${result.linksInserted}`,
    );
    process.exit(0);
  })
  .catch((err) => {
    console.error("[backfill-streaming-brand-links] failed:", err);
    process.exit(1);
  });
