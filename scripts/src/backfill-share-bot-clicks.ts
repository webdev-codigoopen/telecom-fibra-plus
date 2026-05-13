import { backfillShareBotClicks } from "./lib/backfill-share-bot-clicks";

const windowSeconds = Number(
  process.env["BACKFILL_BURST_WINDOW_SECONDS"] ?? "1",
);
const minBurst = Number(process.env["BACKFILL_BURST_MIN_ROWS"] ?? "2");
const dryRun = process.env["BACKFILL_DRY_RUN"] === "1";

backfillShareBotClicks({ windowSeconds, minBurst, dryRun })
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill] failed:", err);
    process.exit(1);
  });
