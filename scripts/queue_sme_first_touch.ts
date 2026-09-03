import { agenticWorkflow } from "../server/services/agenticWorkflow";

async function main() {
  const result = await agenticWorkflow.startSmeOutreachBatch();
  const rejected = Object.entries(result.rejected)
    .map(([reason, count]) => `${reason}: ${count}`)
    .join("; ");
  console.log(
    JSON.stringify(
      {
        opened: result.deals.length,
        scanned: result.scanned,
        rejected,
        companies: result.deals.map((deal) => ({
          id: deal.id,
          companyName: deal.companyName,
          email: deal.email,
          status: deal.status,
          humanReason: deal.humanReason,
        })),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
