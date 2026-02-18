// ARES SELF-HEALING INFRASTRUCTURE TYPES
// Add these to types.ts

export type AresProposalType = 'HOTFIX' | 'UI_OPTIMIZATION' | 'PERFORMANCE' | 'SECURITY' | 'CLEANUP';
export type AresProposalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'DEPLOYED';
export type AresSeverity = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' | 'INFO';

export interface AresSystemIntegrityMonitor {
    uptime_target: string;
    error_threshold: string;
    auto_patch_enabled: boolean;
    last_health_check: string;
    identified_bottlenecks: string[];
    system_health_score: number; // 0-100
    active_alerts: AresAlert[];
}

export interface AresAlert {
    id: string;
    timestamp: string;
    severity: AresSeverity;
    component: string;
    error_type: string;
    message: string;
    stack_trace?: string;
    proposed_fix?: string;
    status: 'NEW' | 'INVESTIGATING' | 'FIX_PROPOSED' | 'RESOLVED' | 'IGNORED';
}

export interface AresProposal {
    id: string;
    type: AresProposalType;
    severity: AresSeverity;
    timestamp: string;
    title: string;
    description: string;
    rationale: string;
    affected_component: string;
    code_changes?: {
        file_path: string;
        original_code: string;
        proposed_code: string;
        explanation: string;
    }[];
    ui_changes?: {
        component: string;
        current_state: string;
        proposed_state: string;
        mockup_url?: string;
    }[];
    estimated_impact: {
        performance_improvement?: string;
        user_experience_improvement?: string;
        risk_level: 'LOW' | 'MODERATE' | 'HIGH';
        rollback_plan: string;
    };
    status: AresProposalStatus;
    approval_required: boolean;
    auto_deploy_allowed: boolean;
    created_by: 'ARES';
    approved_by?: string;
    approved_at?: string;
    deployed_at?: string;
    metrics_before?: any;
    metrics_after?: any;
}

export interface AresHealthLog {
    id: string;
    timestamp: string;
    log_type: 'FIXED' | 'PROPOSAL' | 'CLEANUP' | 'OPTIMIZATION' | 'WARNING' | 'INFO';
    severity: AresSeverity;
    message: string;
    details?: string;
    component: string;
    metrics?: {
        before?: any;
        after?: any;
        improvement_percentage?: number;
    };
    proposal_id?: string; // Link to AresProposal if applicable
}

export interface AresAnalytics {
    heatmap_data: {
        component: string;
        clicks: number;
        avg_time_spent: number;
        bounce_rate: number;
        last_updated: string;
    }[];
    user_journey_bottlenecks: {
        step: string;
        drop_off_rate: number;
        suggested_fix: string;
    }[];
    performance_metrics: {
        api_response_times: {
            endpoint: string;
            avg_ms: number;
            p95_ms: number;
            p99_ms: number;
        }[];
        frontend_load_times: {
            page: string;
            avg_ms: number;
            suggestions: string[];
        }[];
    };
}

export interface AresDevOpsConfig {
    monitoring_enabled: boolean;
    auto_fix_enabled: boolean;
    approval_required_for: AresProposalType[];
    staging_branch: string;
    production_branch: string;
    safety_toggle: boolean; // Human override
    telemetry_endpoints: string[];
    alert_thresholds: {
        error_rate_percentage: number;
        api_timeout_ms: number;
        memory_usage_percentage: number;
    };
}

// Extended Agent Manifest with System Integrity
export interface AresAgentManifestWithMonitoring extends AresTrainingManifest {
    system_integrity_monitor?: AresSystemIntegrityMonitor;
}
