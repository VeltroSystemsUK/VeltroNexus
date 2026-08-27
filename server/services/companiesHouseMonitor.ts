import cron from "node-cron";
import { storage } from "../storage";
import { companiesHouseClient } from "../utils/companiesHouseClient";

const FINAL_STAGES = ["approved", "declined"];

interface ChSnapshot {
  companyStatus: string | null;
  officerCount: number;
  chargesCount: number;
}

function diffSnapshot(prev: ChSnapshot | null | undefined, next: ChSnapshot): string | null {
  if (!prev) return null; // first check — nothing to compare against yet
  if (prev.companyStatus !== next.companyStatus) {
    return `Company status changed: "${prev.companyStatus}" → "${next.companyStatus}"`;
  }
  if (next.chargesCount > prev.chargesCount) {
    return `New charge(s) registered (${prev.chargesCount} → ${next.chargesCount})`;
  }
  if (next.officerCount !== prev.officerCount) {
    return `Officer count changed (${prev.officerCount} → ${next.officerCount})`;
  }
  return null;
}

export class CompaniesHouseMonitor {
  start() {
    // Nightly at 02:00 — runs locally alongside the app, no external scheduler needed.
    cron.schedule("0 2 * * *", () => this.run());
    console.log("[CH Monitor] Scheduled nightly Companies House re-check for 02:00.");
  }

  async run() {
    console.log("[CH Monitor] Starting nightly Companies House re-check...");
    try {
      const users = await storage.getAllUsers();
      let checked = 0;
      let flagged = 0;

      for (const user of users) {
        const prospects = await storage.listProspects(user.id);
        for (const prospect of prospects) {
          if (FINAL_STAGES.includes(prospect.stage)) continue;
          const company = prospect.company;
          if (!company?.companyNumber || company.companyNumber.startsWith("UNREG-")) continue;

          try {
            const [profile, officers, charges] = await Promise.all([
              companiesHouseClient.getCompanyProfile(company.companyNumber),
              companiesHouseClient.getCompanyOfficers(company.companyNumber),
              companiesHouseClient.getCompanyCharges(company.companyNumber),
            ]);
            checked++;

            const snapshot: ChSnapshot = {
              companyStatus: profile?.company_status ?? null,
              officerCount: Array.isArray(officers) ? officers.length : 0,
              chargesCount: charges?.items?.length ?? 0,
            };

            const diffMessage = diffSnapshot(
              company.companiesHouseSnapshot as ChSnapshot | undefined,
              snapshot
            );
            if (diffMessage) {
              flagged++;
              await storage.createException({
                prospectId: prospect.id!,
                source: "companies_house",
                severity: "medium",
                message: diffMessage,
              });
            }

            await storage.updateCompany(company.id!, {
              lastCheckedAt: new Date().toISOString(),
              companiesHouseSnapshot: snapshot,
            } as any);
          } catch (err) {
            console.error(`[CH Monitor] Failed to check ${company.companyNumber}:`, err);
          }
        }
      }

      console.log(`[CH Monitor] Done — checked ${checked} companies, flagged ${flagged} changes.`);
    } catch (err) {
      console.error("[CH Monitor] Run failed:", err);
    }
  }
}

export const companiesHouseMonitor = new CompaniesHouseMonitor();
