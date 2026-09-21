/**
 * Rank Clients harvest cards with TypeSafe Jev — run outside NexusApp.
 *
 *   npx tsx --env-file=.env.production server/scripts/rankCrmHarvest.ts
 */
import { isCrmHarvestCandidate } from "@shared/crmLeadContact";
import { cacheLenderCosts, uniqueLenderNames } from "@shared/lenderCost";
import { cacheCrmHarvestRanks, fileCrmHarvestStore, flushCrmHarvestStore } from "../services/crmHarvest";
import { jevRankLead, jevRankLender } from "../services/jevHarvestRank";
import { loadLenderCostCache, saveLenderCostCache } from "../services/lenderCostCache";
import { storage } from "../storage";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pass(limit: number) {
  const leads = await storage.listInternalLeads();
  const candidates = leads.filter((lead) => isCrmHarvestCandidate(lead));
  const names = uniqueLenderNames(leads);
  const costStore = loadLenderCostCache();
  const cost = await cacheLenderCosts({
    names,
    store: costStore,
    rank: jevRankLender,
    limit,
  });
  saveLenderCostCache(costStore);
  console.log(
    `[Jev ranker] clients=${leads.length} candidates=${candidates.length} lenders=${names.length} costKnown=${cost.known} costJev=${cost.jev} costAlready=${cost.already}`,
  );
  const out = await cacheCrmHarvestRanks({
    leads: candidates,
    store: fileCrmHarvestStore(),
    rank: jevRankLead,
    limit,
  });
  flushCrmHarvestStore();
  console.log(`[Jev ranker] obvious=${out.obvious} jev=${out.jev} already=${out.already}`);
  return { ...out, jev: out.jev + cost.jev, obvious: out.obvious + cost.known };
}

async function main() {
  const once = process.argv.includes("--once");
  const limit = Number(process.argv.find((arg) => /^\d+$/.test(arg)) || 0) || Number.POSITIVE_INFINITY;
  do {
    const out = await pass(limit);
    if (once) break;
    await sleep(out.jev + out.obvious > 0 ? 2000 : 10000);
  } while (true);
}

main().catch((err) => {
  console.error("[Jev ranker] failed:", err);
  process.exit(1);
});
