/**
 * scheduler.ts
 * Cron-based scheduler for autonomous agent
 */

import * as cron from 'node-cron';
import { AutonomousLeadAgent, AutoRunConfig } from './autonomousAgent.js';

export class AgentScheduler {
    private cronJob: cron.ScheduledTask | null = null;
    private agent: AutonomousLeadAgent;
    private isEnabled: boolean;

    constructor(config: AutoRunConfig = {}) {
        this.agent = new AutonomousLeadAgent(config);
        this.isEnabled = process.env.LEAD_FINDER_AUTO_ENABLED === 'true';
    }

    /**
     * Start the cron scheduler
     * Default: 6 AM Monday-Friday
     */
    start(schedule?: string): void {
        if (!this.isEnabled) {
            console.log('⏸️  Lead Finder automation is disabled (LEAD_FINDER_AUTO_ENABLED=false)');
            return;
        }

        const cronSchedule = schedule || process.env.LEAD_FINDER_SCHEDULE || '0 6 * * 1-5';

        if (this.cronJob) {
            console.log('⚠️  Scheduler already running');
            return;
        }

        console.log(`⏰ Starting Lead Finder scheduler: ${cronSchedule}`);
        console.log(`   (6 AM Monday-Friday by default)`);

        this.cronJob = cron.schedule(cronSchedule, async () => {
            console.log('\n⏰ Scheduled run triggered');
            await this.runAgent();
        });

        console.log('✅ Scheduler started successfully\n');
    }

    /**
     * Stop the scheduler
     */
    stop(): void {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            console.log('⏹️  Scheduler stopped');
        }
    }

    /**
     * Run the agent manually
     */
    async runManually(): Promise<void> {
        console.log('🎯 Manual run triggered');
        await this.runAgent();
    }

    /**
     * Execute the agent run with error handling
     */
    private async runAgent(): Promise<void> {
        try {
            const result = await this.agent.runDaily();

            console.log('\n✅ Agent run completed successfully');
            console.log(`   Total Leads: ${result.totalLeads}`);
            console.log(`   High Quality: ${result.highQuality}`);
            console.log(`   Migrated: ${result.migrated}`);
            console.log(`   Runtime: ${(result.runtime / 60).toFixed(1)} minutes\n`);

        } catch (error) {
            console.error('\n❌ Agent run failed:', error);
            // TODO: Send alert/notification
        }
    }

    /**
     * Get scheduler status
     */
    getStatus(): {
        enabled: boolean;
        running: boolean;
        agentRunning: boolean;
    } {
        return {
            enabled: this.isEnabled,
            running: this.cronJob !== null,
            agentRunning: this.agent.isAgentRunning(),
        };
    }
}

// Singleton instance
let schedulerInstance: AgentScheduler | null = null;

export function getScheduler(config?: AutoRunConfig): AgentScheduler {
    if (!schedulerInstance) {
        schedulerInstance = new AgentScheduler(config);
    }
    return schedulerInstance;
}
