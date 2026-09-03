import { runDailyReporterDigest } from "../server/services/reporterAgent";

const result = await runDailyReporterDigest();
console.log(`[Reporter] drafted=${result.drafted} skipped=${result.skipped}`);
process.exit(0);
