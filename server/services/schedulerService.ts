import cron from "node-cron";
import { scraperService } from "./scraperService";
import { storage } from "../storage";
import { Campaign } from "@shared/schema";

export class SchedulerService {
    constructor() {
        this.initializeSchedules();
    }

    initializeSchedules() {
        // Daily at 08:00 AM (Search)
        cron.schedule("0 8 * * *", async () => {
            await this.runDailyCampaigns();
        });

        console.log("[Scheduler] Daily Debt Marker Scraper scheduled for 08:00 AM.");
    }

    async runDailyCampaigns() {
        console.log("[Scheduler] Waking up to run campaigns...");
        try {
            const campaigns = await storage.listCampaigns();
            const activeCampaigns = campaigns.filter(c => c.status === 'active');

            if (activeCampaigns.length === 0) {
                console.log("[Scheduler] No active campaigns.");
                return;
            }

            // Strategy: Run the one with highest priority, then oldest lastRun
            // Sort by priority (high > medium > low), then lastRun (null > old > new)
            const priorityMap = { high: 3, medium: 2, low: 1 };

            activeCampaigns.sort((a, b) => {
                const pA = priorityMap[a.priority as keyof typeof priorityMap] || 1;
                const pB = priorityMap[b.priority as keyof typeof priorityMap] || 1;

                if (pA !== pB) return pB - pA; // Higher priority first

                if (!a.lastRun) return -1; // Never run first
                if (!b.lastRun) return 1;
                return new Date(a.lastRun).getTime() - new Date(b.lastRun).getTime(); // Oldest run first
            });

            const target = activeCampaigns[0];
            await scraperService.runCampaign(target);

        } catch (e) {
            console.error("[Scheduler] Error running daily campaigns:", e);
        }
    }
}

export const schedulerService = new SchedulerService();
