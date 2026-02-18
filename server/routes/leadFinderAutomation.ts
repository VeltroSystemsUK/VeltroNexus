/**
 * Lead Finder Automation API Routes
 * Manual control and monitoring endpoints
 */

import { Router } from 'express';
import { getScheduler } from '../Lead Agent/src/scheduler.js';
import { getDailyMetrics, getWeeklyReport } from '../Lead Agent/src/performanceMonitor.js';
import { AutonomousLeadAgent } from '../Lead Agent/src/autonomousAgent.js';

const router = Router();

/**
 * POST /api/lead-finder/automation/start
 * Manually trigger an agent run
 */
router.post('/automation/start', async (req, res) => {
    try {
        const scheduler = getScheduler();

        if (scheduler.getStatus().agentRunning) {
            return res.status(409).json({
                error: 'Agent is already running'
            });
        }

        // Run async - don't wait for completion
        scheduler.runManually().catch((error) => {
            console.error('Manual run failed:', error);
        });

        res.json({
            message: 'Agent run started',
            status: 'running'
        });
    } catch (error: any) {
        res.status(500).json({
            error: error.message || 'Failed to start agent'
        });
    }
});

/**
 * GET /api/lead-finder/automation/status
 * Get current automation status
 */
router.get('/automation/status', (req, res) => {
    try {
        const scheduler = getScheduler();
        const status = scheduler.getStatus();

        res.json({
            automation: {
                enabled: status.enabled,
                schedulerRunning: status.running,
                agentRunning: status.agentRunning,
            },
            schedule: process.env.LEAD_FINDER_SCHEDULE || '0 6 * * 1-5',
            dailyTarget: parseInt(process.env.LEAD_FINDER_DAILY_TARGET || '1000'),
        });
    } catch (error: any) {
        res.status(500).json({
            error: error.message || 'Failed to get status'
        });
    }
});

/**
 * GET /api/lead-finder/automation/metrics
 * Get daily performance metrics
 */
router.get('/automation/metrics', (req, res) => {
    try {
        const metrics = getDailyMetrics();
        res.json(metrics);
    } catch (error: any) {
        res.status(500).json({
            error: error.message || 'Failed to get metrics'
        });
    }
});

/**
 * GET /api/lead-finder/automation/report/weekly
 * Get weekly performance report
 */
router.get('/automation/report/weekly', (req, res) => {
    try {
        const report = getWeeklyReport();
        res.json(report);
    } catch (error: any) {
        res.status(500).json({
            error: error.message || 'Failed to generate report'
        });
    }
});

/**
 * POST /api/lead-finder/automation/test
 * Run a test with limited scope
 */
router.post('/automation/test', async (req, res) => {
    try {
        const agent = new AutonomousLeadAgent({
            dryRun: false,
            maxLeadsPerSearch: 10, // Limit to 10 per search for testing
            autoMigrate: false,
        });

        // Run async
        agent.runDaily().then((result) => {
            console.log('Test run completed:', result);
        }).catch((error) => {
            console.error('Test run failed:', error);
        });

        res.json({
            message: 'Test run started (limited scope)',
            config: {
                maxLeadsPerSearch: 10,
                autoMigrate: false,
            }
        });
    } catch (error: any) {
        res.status(500).json({
            error: error.message || 'Failed to start test'
        });
    }
});

export default router;
