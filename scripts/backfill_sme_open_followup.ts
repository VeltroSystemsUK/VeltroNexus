import { backfillSmeOpenFollowUps } from "../server/services/smeOpenFollowUp";

const result = await backfillSmeOpenFollowUps();
console.log(
  `[backfill] sme_open candidates=${result.candidates} sent=${result.sent} skipped=${result.skipped}`
);
process.exit(result.sent > 0 || result.candidates === 0 ? 0 : 1);
