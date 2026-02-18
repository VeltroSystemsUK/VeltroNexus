import { aresControlCenter } from "./aresControlCenter";
import { storage } from "../storage";

/**
 * ARES Scheduler
 * 
 * Manages automated recurring tasks for autonomous agent operations
 */

interface ScheduleConfig {
    enabled: boolean;
    dailyEnrichmentTime: string; // HH:MM format (24-hour)
    checkIntervalMs: number; // How often to check if it's time to run
}

class AresScheduler {
    private config: ScheduleConfig = {
        enabled: true,
        dailyEnrichmentTime: "09:00", // Default: 9 AM daily
        checkIntervalMs: 60000, // Check every minute
    };

    private intervalId: NodeJS.Timeout | null = null;
    private lastRunDate: string | null = null;

    /**
     * Start the scheduler
     */
    start() {
        if (this.intervalId) {
            console.log("[ARES Scheduler] Already running");
            return;
        }

        console.log(`[ARES Scheduler] Starting with daily enrichment at ${this.config.dailyEnrichmentTime}`);

        // Check immediately on startup
        this.checkAndRun();

        // Then check at regular intervals
        this.intervalId = setInterval(() => {
            this.checkAndRun();
        }, this.config.checkIntervalMs);
    }

    /**
     * Stop the scheduler
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log("[ARES Scheduler] Stopped");
        }
    }

    /**
     * Check if it's time to run and execute if needed
     */
    private async checkAndRun() {
        if (!this.config.enabled) {
            return;
        }

        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
        const currentDate = now.toISOString().split("T")[0];

        // Check if we've already run today
        if (this.lastRunDate === currentDate) {
            return;
        }

        // Check if it's time to run
        if (currentTime === this.config.dailyEnrichmentTime) {
            console.log("[ARES Scheduler] Triggering daily autonomous tasks");
            this.lastRunDate = currentDate;

            try {
                // Get system user ID (or use first admin)
                const userId = "system"; // TODO: Get actual system user or admin

                // 1. Discover new prospects
                console.log("[ARES Scheduler] Starting prospect discovery");
                const { prospectDiscovery } = await import("./prospectDiscovery");
                await prospectDiscovery.discoverProspects(20, userId);

                // 3. Automated regional discovery (Town-based)
                console.log("[ARES Scheduler] Starting Database Builder discovery");
                const { databaseBuilderService } = await import("./databaseBuilder");

                // Midlands North/West
                await databaseBuilderService.runDiscoveryLoop([
                    { location: "Leicester", postcode: "LE" },
                    { location: "Nottingham", postcode: "NG" },
                    { location: "Derby", postcode: "DE" },
                    { location: "Lincoln", postcode: "LN" }
                ], { autoEnrich: true });

                // Midlands South/East
                await databaseBuilderService.runDiscoveryLoop([
                    { location: "Northampton", postcode: "NN" },
                    { location: "Coventry", postcode: "CV" },
                    { location: "Peterborough", postcode: "PE" },
                    { location: "Milton Keynes", postcode: "MK" }
                ], { autoEnrich: true });

                console.log("[ARES Scheduler] Daily autonomous tasks completed");
            } catch (error) {
                console.error("[ARES Scheduler] Daily tasks failed:", error);
            }
        }
    }

    /**
     * Update schedule configuration
     */
    updateConfig(config: Partial<ScheduleConfig>) {
        this.config = { ...this.config, ...config };
        console.log("[ARES Scheduler] Config updated:", this.config);

        // Restart if already running
        if (this.intervalId) {
            this.stop();
            this.start();
        }
    }

    /**
     * Get current configuration
     */
    getConfig(): ScheduleConfig {
        return { ...this.config };
    }

    /**
     * Get status
     */
    getStatus() {
        return {
            running: this.intervalId !== null,
            enabled: this.config.enabled,
            scheduledTime: this.config.dailyEnrichmentTime,
            lastRunDate: this.lastRunDate,
            nextRunDate: this.getNextRunDate(),
        };
    }

    /**
     * Calculate next run date
     */
    private getNextRunDate(): string {
        const now = new Date();
        const [hours, minutes] = this.config.dailyEnrichmentTime.split(":").map(Number);

        const nextRun = new Date();
        nextRun.setHours(hours, minutes, 0, 0);

        // If we've passed today's time, schedule for tomorrow
        if (nextRun <= now) {
            nextRun.setDate(nextRun.getDate() + 1);
        }

        return nextRun.toISOString();
    }
}

export const aresScheduler = new AresScheduler();
