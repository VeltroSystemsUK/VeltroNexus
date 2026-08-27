import dotenv from "dotenv";
import { storage } from "../storage";
import { ensureSterlingHandoff } from "../services/sterlingHandoff";

dotenv.config({ path: ".env.local" });

const OPEN = new Set(["submitted", "in_review", "sent_to_broker"]);

async function main() {
  const submissions = await storage.listUnderwritingSubmissions({});
  let created = 0;
  for (const sub of submissions) {
    if (!OPEN.has(sub.status)) continue;
    const prospect = await storage.getProspectById(sub.prospectId);
    if (!prospect) {
      console.log(`skip submission ${sub.id}: prospect ${sub.prospectId} missing`);
      continue;
    }
    const result = await ensureSterlingHandoff({
      prospectId: sub.prospectId,
      userId: sub.brokerId,
      submissionId: sub.id,
    });
    console.log(
      `${result.ok ? "ok" : "fail"} submission ${sub.id} ${prospect.company?.companyName} ${result.reason || ""}`.trim(),
    );
    if (result.ok) created += 1;
  }
  console.log(`Done. ${created} open underwriting file(s) in the Sterling portal.`);
  process.exit(0);
}

main();
