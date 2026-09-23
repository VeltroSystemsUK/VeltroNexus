import { sendableIndustry } from "../shared/openers";
import { tickDirectOutreachBriefings } from "../server/services/briefings";
import { listOpeners } from "../server/services/openers";

async function main() {
  console.log(`origin ${process.env.HELLO_PUBLIC_URL || "default"}`);
  let sent = 0;
  for (let pass = 1; pass <= 6; pass++) {
    const n = await tickDirectOutreachBriefings();
    sent += n;
    console.log(`tick ${pass}: sent ${n} (total ${sent})`);
    if (n === 0) break;
  }
  const desk = listOpeners().filter((row) => row.status === "direct_outreach");
  const held = desk.filter((row) => row.briefingHold);
  console.log(`SAL-3 sent ${sent}`);
  console.log(`Direct Outreach ${desk.length} · held ${held.length}`);
  for (const row of desk) {
    const industry = sendableIndustry(row) || "none";
    const hold = row.briefingHold
      ? `${row.briefingHold.reason}${row.briefingHold.detail ? ` (${row.briefingHold.detail})` : ""}`
      : row.briefingId
        ? "queued/sent"
        : "waiting";
    console.log(`${row.companyName || row.email}\t${row.email}\t${industry}\t${hold}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
