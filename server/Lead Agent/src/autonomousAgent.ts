/**
 * autonomousAgent.ts
 * Main orchestrator for autonomous lead generation
 * Runs daily, targets 1,000+ leads across 6 niches
 */

import { LeadFinderAPI } from './api.js';
import { NICHES, Niche } from './config/niches.js';
import { getDailyCities, buildCityQuery, City } from './config/cities.js';
import { getDailyMetrics, logDailySummary, getWeeklyReport, logWeeklyReport } from './performanceMonitor.js';
import { Business } from './models/business.js';

export interface AutoRunConfig {
    dryRun?: boolean;
    maxLeadsPerSearch?: number;
    autoMigrate?: boolean;
    migrateThreshold?: number;
}

export interface AutoRunResult {
    totalLeads: number;
    enriched: number;
    emailsFound: number;
    highQuality: number;
    migrated: number;
    nicheResults: Record<string, {
        leads: number;
        highQuality: number;
    }>;
    runtime: number;
}

export class AutonomousLeadAgent {
    private api: LeadFinderAPI;
    private config: Required<AutoRunConfig>;
    private isRunning: boolean = false;

    constructor(config: AutoRunConfig = {}) {
        this.api = new LeadFinderAPI();
        this.config = {
            dryRun: config.dryRun ?? false,
            maxLeadsPerSearch: config.maxLeadsPerSearch ?? 50,
            autoMigrate: config.autoMigrate ?? true,
            migrateThreshold: config.migrateThreshold ?? 0.65,
        };
    }

    /**
     * Main daily run - executes all niches across cities
     */
    async runDaily(): Promise<AutoRunResult> {
        if (this.isRunning) {
            throw new Error('Agent is already running');
        }

        this.isRunning = true;
        const startTime = Date.now();

        console.log('\n🚀 Starting Autonomous Lead Generation Agent');
        console.log(`Target: ${NICHES.reduce((sum, n) => sum + n.dailyTarget, 0)} leads`);
        console.log(`Niches: ${NICHES.map(n => n.name).join(', ')}`);
        console.log(`Config: ${this.config.dryRun ? 'DRY RUN' : 'PRODUCTION'}\n`);

        const result: AutoRunResult = {
            totalLeads: 0,
            enriched: 0,
            emailsFound: 0,
            highQuality: 0,
            migrated: 0,
            nicheResults: {},
            runtime: 0,
        };

        try {
            // Get cities for today (rotates daily)
            const dayOffset = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
            const cities = getDailyCities(dayOffset);

            console.log(`📍 Today's cities: ${cities.map(c => c.name).join(', ')}\n`);

            // Process each niche
            for (const niche of NICHES) {
                console.log(`\n${'='.repeat(60)}`);
                console.log(`🎯 Processing Niche: ${niche.name}`);
                console.log(`   Target: ${niche.dailyTarget} leads`);
                console.log(`${'='.repeat(60)}\n`);

                const nicheResult = await this.processNiche(niche, cities);

                result.nicheResults[niche.id] = nicheResult;
                result.totalLeads += nicheResult.leads;
                result.highQuality += nicheResult.highQuality;
            }

            // Get final stats
            const finalStats = await this.api.status();
            result.enriched = finalStats.enriched;
            result.emailsFound = finalStats.emailsFound;

            // Migrate high-quality leads
            if (this.config.autoMigrate && !this.config.dryRun) {
                result.migrated = await this.migrateHighQualityLeads();
            }

            result.runtime = (Date.now() - startTime) / 1000;

            // Log daily summary
            const metrics = getDailyMetrics();
            logDailySummary(metrics);

            // Log weekly report on Fridays
            if (new Date().getDay() === 5) {
                const weeklyReport = getWeeklyReport();
                logWeeklyReport(weeklyReport);
            }

        } catch (error) {
            console.error('❌ Agent run failed:', error);
            throw error;
        } finally {
            this.isRunning = false;
        }

        return result;
    }

    /**
     * Process a single niche across multiple cities
     */
    private async processNiche(niche: Niche, cities: City[]): Promise<{
        leads: number;
        highQuality: number;
    }> {
        let totalLeads = 0;
        let totalHighQuality = 0;

        // Determine number of searches needed
        const searchesPerTerm = Math.ceil(niche.dailyTarget / (niche.searchTerms.length * cities.length));
        const maxResultsPerSearch = Math.min(this.config.maxLeadsPerSearch, searchesPerTerm);

        for (const searchTerm of niche.searchTerms) {
            for (const city of cities) {
                const query = buildCityQuery(searchTerm, city);

                try {
                    console.log(`🔍 Searching: "${query}"`);

                    const searchResult = await this.api.search({
                        query,
                        maxResults: maxResultsPerSearch,
                        filters: {
                            ...niche.filters,
                            operationalOnly: true,
                            requireWebsite: true,
                        },
                        enrich: true,
                    });

                    totalLeads += searchResult.summary.passedFilters;
                    totalHighQuality += searchResult.summary.highQuality;

                    console.log(`   ✓ Found: ${searchResult.summary.passedFilters} leads (${searchResult.summary.highQuality} high-quality)`);

                    // Filter out NHS for social care
                    if (niche.id === 'social_care') {
                        await this.filterNHS(searchResult.leads);
                    }

                    // Brief delay between searches
                    await this.sleep(1000);

                } catch (error) {
                    console.error(`   ✗ Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    // Continue with next search
                }
            }
        }

        console.log(`\n   📊 Niche Total: ${totalLeads} leads (${totalHighQuality} high-quality)`);

        return {
            leads: totalLeads,
            highQuality: totalHighQuality,
        };
    }

    /**
     * Filter out NHS organizations from social care results
     */
    private async filterNHS(leads: Business[]): Promise<void> {
        // TODO: Implement NHS filtering logic
        // Check business name, website for NHS indicators
        // Mark as migrated=true or delete if NHS-related
    }

    /**
     * Migrate high-quality leads to CRM
     */
    private async migrateHighQualityLeads(): Promise<number> {
        console.log('\n📤 Migrating high-quality leads to CRM...');

        // TODO: Implement CRM migration
        // 1. Query leads where leadScore >= threshold and migrated = false
        // 2. For each lead:
        //    - Create company in main CRM database
        //    - Add primary contact
        //    - Mark as migrated in Lead Finder DB
        // 3. Return count of migrated leads

        return 0; // Placeholder
    }

    /**
     * Helper: Sleep for ms
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Check if agent is currently running
     */
    public isAgentRunning(): boolean {
        return this.isRunning;
    }
}
