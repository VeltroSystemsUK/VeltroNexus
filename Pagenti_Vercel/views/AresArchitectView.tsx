import React, { useState, useEffect } from 'react';
import { AresArchitectDashboard } from '../components/AresArchitect';
import { AresDevOpsConfig, AresProposal } from '../types';
import { monitorSystemHealth } from '../services/aresTelemetry';

export const AresArchitectView: React.FC = () => {
    const [config, setConfig] = useState<AresDevOpsConfig>({
        monitoring_enabled: true,
        auto_fix_enabled: false, // Start conservatively
        approval_required_for: ['HOTFIX', 'SECURITY', 'PERFORMANCE', 'UI_OPTIMIZATION'],
        staging_branch: 'staging',
        production_branch: 'main',
        safety_toggle: true, // CRITICAL: Always ON in production
        telemetry_endpoints: ['/api/health', '/api/logs'],
        alert_thresholds: {
            error_rate_percentage: 0.05, // 5%
            api_timeout_ms: 1000,
            memory_usage_percentage: 85
        }
    });

    // Background monitoring (runs every 60 seconds)
    useEffect(() => {
        if (!config.monitoring_enabled) return;

        const interval = setInterval(async () => {
            try {
                const { health_score, alerts } = await monitorSystemHealth();
                console.log('[ARES Monitor] Health Score:', health_score, 'Alerts:', alerts.length);

                // In production, this would send alerts to the dashboard
                // and auto-generate proposals for critical issues
            } catch (error) {
                console.error('[ARES Monitor] Health check failed:', error);
            }
        }, 60000);

        return () => clearInterval(interval);
    }, [config.monitoring_enabled]);

    const handleConfigUpdate = (newConfig: AresDevOpsConfig) => {
        console.log('[ARES Config] Updated:', newConfig);
        setConfig(newConfig);

        // In production, save to backend
        // await fetch('/api/ares/config', { method: 'POST', body: JSON.stringify(newConfig) });
    };

    const handleApproveProposal = async (proposalId: string) => {
        console.log('[ARES] Proposal approved:', proposalId);

        // In production, this would:
        // 1. Update proposal status
        // 2. Execute if auto-deploy allowed
        // 3. Log the approval
        // 4. Monitor post-deployment metrics

        // Example:
        // const response = await fetch(`/api/ares/proposals/${proposalId}/approve`, { method: 'POST' });
        // const result = await response.json();

        // For now, just log
        alert(`✅ Proposal ${proposalId} approved! In production, this would deploy to staging.`);
    };

    const handleRejectProposal = async (proposalId: string) => {
        console.log('[ARES] Proposal rejected:', proposalId);

        // In production:
        // await fetch(`/api/ares/proposals/${proposalId}/reject`, { method: 'POST' });

        alert(`❌ Proposal ${proposalId} rejected.`);
    };

    return (
        <AresArchitectDashboard
            config={config}
            onConfigUpdate={handleConfigUpdate}
            onApproveProposal={handleApproveProposal}
            onRejectProposal={handleRejectProposal}
        />
    );
};
