
import { exec } from "child_process";
import { promisify } from "util";
import { leadScoring } from "../server/services/leadScoringService";
import { storage } from "../server/storage";
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const execAsync = promisify(exec);

async function runPipeline() {
    console.log("🚀 Starting Real-Time Debt Marker Pipeline Test...");
    console.log("------------------------------------------------");

    // 1. Run Python Scraper
    console.log("🔍 [Phase 1] Running Intelligent Debt Marker Scraper (Python)...");
    try {
        // Ensure API key is present
        if (!process.env.COMPANIES_HOUSE_API_KEY) {
            throw new Error("COMPANIES_HOUSE_API_KEY is missing in .env");
        }

        const { stdout, stderr } = await execAsync(`python scripts/debt_marker_scraper.py --json`, {
            maxBuffer: 1024 * 1024 * 5, // 5MB buffer
            env: process.env
        });

        if (stderr) {
            // Python stderr might contain logs, not just errors
            console.log("[Scraper Logs]:", stderr);
        }

        let candidates = [];
        try {
            // Try to parse the last valid JSON array from the output
            const lines = stdout.split('\n').filter(line => line.trim().length > 0).reverse();
            let parsed = false;

            for (const line of lines) {
                try {
                    if (line.trim().startsWith('[') && line.trim().endsWith(']')) {
                        candidates = JSON.parse(line);
                        parsed = true;
                        break;
                    }
                } catch (e) {
                    // Not valid JSON, continue
                }
            }

            if (!parsed) {
                // Fallback: Try regex to extract JSON array
                const jsonMatch = stdout.match(/\[.*\]/s);
                if (jsonMatch) {
                    // Check if it's the log message [SIC...] or actual JSON
                    // Actual JSON should not contain bare words like SIC:
                    try {
                        const potentialJson = jsonMatch[0];
                        if (potentialJson.includes('"companyNumber"')) {
                            candidates = JSON.parse(potentialJson);
                        } else if (potentialJson === "[]") {
                            candidates = [];
                        }
                    } catch (e) { }
                }
            }
        } catch (e) {
            console.error("❌ Failed to parse scraper output:", e);
            console.log("Raw Output:", stdout);
            return;
        }

        console.log(`✅ Scraper found ${candidates.length} potential candidates.`);

        // 2. Qualify Candidates
        console.log("\n🧠 [Phase 2] Qualifying Candidates (Node.js LeadScoringService)...");

        for (const candidate of candidates) {
            console.log(`\n👉 Processing: ${candidate.companyName} (${candidate.companyNumber})`);

            // Run full qualification (Debt Check Layer 2 + Financial Audit Layer 3 + Scoring)
            const scoredLead = await leadScoring.qualifyLead(candidate.companyNumber, candidate.companyName);

            if (scoredLead) {
                console.log(`   📊 Score: ${scoredLead.score}/100 | Priority: ${scoredLead.priority}`);
                console.log(`   💡 Approach: ${scoredLead.recommendedApproach}`);

                if (scoredLead.score >= 50) {
                    console.log("   🎯 TARGET DETECTED! Saving to DB...");

                    // 3. Persist to DB
                    await storage.createScrapedLead({
                        companyName: scoredLead.companyName,
                        companyNumber: scoredLead.companyNumber,
                        sicCode: candidate.sicCodes?.[0] || "",
                        incorporationDate: candidate.incorporationDate,
                        score: scoredLead.score,
                        priority: scoredLead.priority,
                        recommendedApproach: scoredLead.recommendedApproach,
                        identifiedLender: scoredLead.chargeMarkers[0]?.identifiedLender?.name,
                        chargeDate: scoredLead.chargeMarkers[0]?.createdDate ? new Date(scoredLead.chargeMarkers[0].createdDate) : new Date(),
                        chargeAmount: null, // Scraper doesn't get amount yet
                        cashAtBank: scoredLead.financialMetrics.cashAtBank,
                        creditorsDue: scoredLead.financialMetrics.creditorsUnderOneYear, // Map correctly
                        netAssets: scoredLead.financialMetrics.netAssets,
                        crisisRatio: scoredLead.financialMetrics.crisisRatio,
                        status: "new",
                        emailDraftId: null // Placeholder
                    });
                    console.log("   💾 Saved to 'Auto-Qualified Leads' Dashboard Widget.");
                } else {
                    console.log("   Info: Score below threshold (50), skipping storage.");
                }
            }
        }

        console.log("\n------------------------------------------------");
        console.log("✅ Pipeline Test Complete.");

    } catch (error) {
        console.error("❌ Pipeline Failed:", error);
    }
}

runPipeline().catch(console.error);
