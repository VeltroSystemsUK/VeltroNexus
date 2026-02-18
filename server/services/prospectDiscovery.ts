import { storage } from "../storage";
import { agentJobTracker } from "./agentJobTracker";

/**
 * Prospect Discovery Service
 * 
 * Autonomously discovers new business prospects from Companies House
 */

interface ProspectCriteria {
    minTurnover: number;
    maxTurnover: number;
    excludeSectors?: string[];
    onlyActiveFiling: boolean;
}

interface DiscoveredProspect {
    companyNumber: string;
    companyName: string;
    turnover?: number;
    registeredAddress?: string;
    sector?: string;
    filingStatus: string;
    discoveredAt: Date;
}

export class ProspectDiscoveryService {
    private defaultCriteria: ProspectCriteria = {
        minTurnover: 1_000_000, // £1M
        maxTurnover: 50_000_000, // £50M
        onlyActiveFiling: true,
    };

    /**
     * Discover new prospects based on criteria
     */
    async discoverProspects(
        targetCount: number = 20,
        userId: string,
        jobId?: string
    ): Promise<DiscoveredProspect[]> {
        console.log(`[Prospect Discovery] Starting search for ${targetCount} prospects`);

        if (jobId) {
            await agentJobTracker.updateProgress(
                jobId,
                "Searching Companies House",
                1,
                `Searching for companies with turnover £${this.defaultCriteria.minTurnover.toLocaleString()} - £${this.defaultCriteria.maxTurnover.toLocaleString()}`,
                "info"
            );
        }

        const discovered: DiscoveredProspect[] = [];

        try {
            // Get existing prospect company numbers to avoid duplicates
            const existingProspects = await this.getExistingProspectNumbers(userId);

            if (jobId) {
                await agentJobTracker.updateProgress(
                    jobId,
                    "Filtering results",
                    2,
                    `Excluding ${existingProspects.size} existing prospects`,
                    "info"
                );
            }

            // Search Companies House for active companies
            // Note: This is a simplified version - real implementation would use
            // Companies House Advanced Search API with turnover filters
            const searchResults = await this.searchCompaniesHouse(targetCount * 3); // Get extra to filter

            if (jobId) {
                await agentJobTracker.updateProgress(
                    jobId,
                    "Processing results",
                    3,
                    `Found ${searchResults.length} potential prospects`,
                    "info"
                );
            }

            // Filter and select prospects
            for (const company of searchResults) {
                if (discovered.length >= targetCount) break;

                // Skip if already in database
                if (existingProspects.has(company.companyNumber)) {
                    continue;
                }

                // Check filing status
                if (this.defaultCriteria.onlyActiveFiling && company.filingStatus !== "active") {
                    continue;
                }

                discovered.push({
                    companyNumber: company.companyNumber,
                    companyName: company.companyName,
                    turnover: company.turnover,
                    registeredAddress: company.registeredAddress,
                    sector: company.sector,
                    filingStatus: company.filingStatus,
                    discoveredAt: new Date(),
                });
            }

            if (jobId) {
                await agentJobTracker.updateProgress(
                    jobId,
                    "Saving prospects",
                    4,
                    `Selected ${discovered.length} new prospects`,
                    "success"
                );
            }

            // Save to database
            await this.saveProspects(discovered, userId);

            console.log(`[Prospect Discovery] Discovered ${discovered.length} new prospects`);
            return discovered;
        } catch (error) {
            console.error("[Prospect Discovery] Error:", error);
            if (jobId) {
                await agentJobTracker.updateProgress(
                    jobId,
                    "Error",
                    4,
                    `Discovery failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                    "error"
                );
            }
            throw error;
        }
    }

    /**
     * Search Companies House API
     */
    private async searchCompaniesHouse(limit: number): Promise<any[]> {
        // TODO: Implement real Companies House Advanced Search
        // For now, return mock data for testing

        // In production, this would call:
        // - Companies House Advanced Search API
        // - Filter by turnover range
        // - Filter by SIC codes for target sectors
        // - Sort by incorporation date (newest first)

        console.log(`[Prospect Discovery] Searching Companies House (limit: ${limit})`);

        // Mock data for testing
        return [];
    }

    /**
     * Get existing prospect company numbers from database
     */
    private async getExistingProspectNumbers(userId: string): Promise<Set<string>> {
        try {
            // For now, return empty set - will implement when prospect table ready
            console.log("[Prospect Discovery] Checking existing prospects");
            return new Set();
        } catch (error) {
            console.error("[Prospect Discovery] Error fetching existing prospects:", error);
            return new Set();
        }
    }

    /**
     * Save discovered prospects to database
     */
    private async saveProspects(prospects: DiscoveredProspect[], userId: string): Promise<void> {
        // For now, just log - will implement database save when prospect schema ready
        console.log(`[Prospect Discovery] Would save ${prospects.length} prospects:`);
        prospects.forEach(p => {
            console.log(`  - ${p.companyName} (${p.companyNumber})`);
        });
        // TODO: Implement when prospect table is ready
        // await storage.addProspect(userId, { ...data });
    }

    /**
     * Get discovery statistics
     */
    async getStats(userId: string): Promise<{
        totalDiscovered: number;
        thisWeek: number;
        thisMonth: number;
    }> {
        // Return mock data for now - will implement when prospect table ready
        return {
            totalDiscovered: 0,
            thisWeek: 0,
            thisMonth: 0,
        };
    }
}

export const prospectDiscovery = new ProspectDiscoveryService();
