import { storage } from "../server/storage";
import { factoryParkReleasePatch } from "../shared/mailDesk";
import { linkedInHoldReleasePatch } from "../shared/outreachSend";
import type { AgenticDealFile } from "../shared/agenticWorkflow";

function addEvent(deal: AgenticDealFile, message: string, agent: string) {
  return [
    ...(deal.events || []),
    { at: new Date().toISOString(), stage: deal.stage, agent, message },
  ];
}

async function main() {
  const now = new Date();
  const deals = await storage.listAgenticDeals();
  const patches: Array<{ id: number; updates: Record<string, unknown> }> = [];
  for (const deal of deals) {
    const linkedIn = linkedInHoldReleasePatch(deal, now);
    if (linkedIn) {
      patches.push({
        id: deal.id,
        updates: {
          ...linkedIn,
          events: addEvent(deal, "LinkedIn hold released — next email is on the timer", "outreach-sales"),
        },
      });
      continue;
    }
    const parked = factoryParkReleasePatch(deal, now);
    if (!parked) continue;
    const bounce = /bounce|mailbox is not this company/i.test(deal.humanReason || "");
    patches.push({
      id: deal.id,
      updates: {
        ...parked,
        events: addEvent(
          deal,
          bounce
            ? "Unconfirmed mailbox stripped — Harper will hunt a director address"
            : "Automatic reply filed — cadence stays on the timer",
          bounce ? "harvest" : "mailbox-clerk"
        ),
      },
    });
  }
  if (patches.length) await storage.updateAgenticDealsBulk(patches);
  console.log(`Released ${patches.length} factory holds`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
