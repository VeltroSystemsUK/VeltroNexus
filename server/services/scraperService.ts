import { exec } from "child_process";
import { promisify } from "util";
import { leadScoring } from "./leadScoringService";
import { storage } from "../storage";
import { Campaign } from "@shared/schema";
import * as path from 'path';

const execAsync = promisify(exec);

export class ScraperService {
    async runCampaign(campaign: Campaign) {
        console.log(`🚀 [ScraperService] Starting Campaign: ${campaign.name} (ID: ${campaign.id})`);

        try {
            // 1. Construct Command
            let args = `--json`;
            if (campaign.type === 'region') {
                args += ` --location "${campaign.value}"`;
            } else if (campaign.type === 'sector') {
                args += ` --sic_codes "${campaign.value}"`;
            }

            // Execute Python Scraper
            // Use --env-file=.env if running via tsx, but here we are inside node execution from index.ts 
            // which should have env vars loaded (except index.ts uses dotenv flow?). 
            // exec inherits process.env by default.
            const { stdout, stderr } = await execAsync(`python scripts/debt_marker_scraper.py ${args}`, {
                maxBuffer: 1024 * 1024 * 10, // 10MB buffer
                env: process.env
            });

            if (stderr) console.log("[Scraper Logs]:", stderr);

            // 2. Parse Results
            let candidates: any[] = [];

            // Try last line first
            const lines = stdout.split('\n').filter(line => line.trim().length > 0).reverse();
            for (const line of lines) {
                try {
                    if (line.trim().startsWith('[') && line.trim().endsWith(']')) {
                        candidates = JSON.parse(line);
                        break;
                    }
                } catch (e) { }
            }

            // Fallback for empty/malformed
            if (!candidates) candidates = [];

            console.log(`✅ [ScraperService] Found ${candidates.length} candidates.`);

            // 3. Qualify & Save
            let newLeadsCount = 0;
            for (const candidate of candidates) {
                try {
                    const scoredLead = await leadScoring.qualifyLead(candidate.companyNumber, candidate.companyName);

                    // Threshold: Score >= 50
                    if (scoredLead && scoredLead.score >= 50) {
                        try {
                            const newLead = await storage.createScrapedLead({
                                companyName: scoredLead.companyName,
                                companyNumber: scoredLead.companyNumber,
                                sicCode: candidate.sicCodes?.[0] || "",
                                incorporationDate: candidate.incorporationDate,
                                score: scoredLead.score,
                                priority: scoredLead.priority,
                                recommendedApproach: scoredLead.recommendedApproach,
                                identifiedLender: scoredLead.chargeMarkers?.[0]?.identifiedLender?.name,
                                chargeDate: scoredLead.chargeMarkers?.[0]?.createdDate ? new Date(scoredLead.chargeMarkers[0].createdDate) : new Date(),
                                chargeAmount: null,
                                cashAtBank: scoredLead.financialMetrics?.cashAtBank,
                                creditorsDue: scoredLead.financialMetrics?.creditorsUnderOneYear,
                                netAssets: scoredLead.financialMetrics?.netAssets,
                                crisisRatio: scoredLead.financialMetrics?.crisisRatio,
                                status: "new",
                                emailDraftId: null
                            });
                            newLeadsCount++;
                            console.log(`   💾 Saved Lead: ${scoredLead.companyName} (ID: ${newLead.id})`);
                        } catch (err: any) {
                            // Duplicate leads are expected; log unexpected errors
                            if (!err?.message?.includes("duplicate") && !err?.code?.includes("already-exists")) {
                                console.error(`[ScraperService] Failed to save lead ${scoredLead.companyName}:`, err?.message);
                            }
                        }
                    }
                } catch (err) {
                    console.error(`Error processing candidate ${candidate.companyNumber}:`, err);
                }
            }

            // 4. Update Campaign Stats
            if (campaign.id) {
                await storage.updateCampaign(campaign.id, {
                    lastRun: new Date(),
                    leadsFound: (campaign.leadsFound || 0) + newLeadsCount
                });
            }

            console.log(`🏁 [ScraperService] Campaign Complete. New Leads: ${newLeadsCount}`);

        } catch (error) {
            console.error("❌ Campaign Failed:", error);
        }
    }
}

export const scraperService = new ScraperService();
