
import { Language } from './I18nContext';

export enum AssociateStatus {
  AVAILABLE = 'Available for Placement',
  ON_TRIAL = 'On Trial with 3 Clients',
  BUSY = 'Fully Booked',
  ARES_CERTIFIED = 'ARES Certified - Staging',
  LIVE_DEPLOYMENT = 'Live Deployment - Revenue Generating',
  HIBERNATION = 'System Hibernation - Payment Required'
}

export type LocalizedStr = Record<Language, string>;
export type LocalizedList = Record<Language, string[]>;

export interface SkillScore {
  subject: string;
  A: number;
  fullMark: number;
}

export type MessagingChannelType = 'whatsapp' | 'telegram' | 'slack' | 'email';

export interface CommunicationChannel {
  type: MessagingChannelType;
  handle: string;
  connected: boolean;
  lastActive?: string;
}

export interface CommunicationConfig {
  channels: CommunicationChannel[];
  preferences: {
    urgentOnly: boolean;
    frequency: 'real-time' | 'daily-summary' | 'weekly-digest';
  };
}

export interface DigitalAssociate {
  id: string;
  name: string;
  role: LocalizedStr;
  department: string; // Used as key for localization
  status: AssociateStatus;
  avatar: string;
  expertise: LocalizedList;
  tools: string[];
  description: LocalizedStr;
  hourlyRate: number;
  scores: SkillScore[];
  demoVideo: string;
  terminalLogs?: LocalizedList;
  voiceId?: string;
  voiceEnabled: boolean;
  // Enhanced Profile Fields
  workingHours?: string;
  salary?: string;
  languages?: string[];
  caseStudy?: {
    title: string;
    outcome: string;
  };
  onboarding?: {
    requirements: string[];
    trialPeriod: string;
  };
  communicationConfig?: CommunicationConfig;
  knowledgeBase?: {
    id: string;
    name: string;
    content: string;
    uploadedAt: string;
  }[];
  // Ares Master Architect Metadata
  aresCertification?: {
    status: 'pending' | 'certified' | 'failed';
    certifiedAt?: string;
    score: number;
    trainingManifest?: AresTrainingManifest;
    uselessnessReport?: UselessnessReport;
  };
  commercial_integrity_layer?: CommercialIntegrityLayer;
}

export interface CommercialIntegrityLayer {
  payment_status: 'ACTIVE' | 'DELINQUENT' | 'SUSPENDED';
  handoff_complete: boolean;
  oversight_mode: 'Passive_Remote' | 'Active_Intervention';
  billing_sync_frequency: string; // e.g. "24h"
  delinquency_action: 'Warn_Then_Suspend';
  intervention_threshold: 'High_Risk_Deviation_Only' | 'Always_Active';
}

export interface AresMissionDeviation {
  id: string;
  agentId: string;
  timestamp: string;
  category: 'Logic_Drift' | 'Commercial_Breach' | 'Instructional_Override';
  evidence: {
    input: string;
    output: string;
    assessment: string;
  };
  severity: 'info' | 'warning' | 'critical';
  status: 'PENDING' | 'ACKNOWLEDGED' | 'RESOLVED_RETRAINED' | 'RESOLVED_SUSPENDED';
  assessment?: string; // Adding top-level for convenience as requested by UI
}

export interface RetentionLogic {
  utilization_threshold: string; // e.g., "10_tasks_per_week"
  idle_timer_trigger: string; // e.g., "24h"
  engagement_score: number; // 0 to 100
  retention_actions: Array<{
    trigger: 'Low_Engagement' | 'High_Inertia';
    action: 'Proactive_Suggestion_Nudge' | 'Trigger_Value_Add_Consultation';
  }>;
}

export interface AresTrainingManifest {
  agent_metadata: {
    designation: string;
    role_id: string;
    version: string;
    timestamp: string;
  };
  identity_matrix: {
    role_function: string;
    hourly_rate: string;
    authority_level: string;
  };
  commercial_integrity_layer?: CommercialIntegrityLayer;
  tech_stack_mapping: {
    crm?: {
      provider: string;
      authorized_actions: string[];
      api_status: string;
    };
    communication?: {
      provider: string;
      channel_id: string;
      alert_protocol: string;
    };
    scheduling?: {
      provider: string;
      booking_link: string;
      buffer_time_minutes: number;
    };
    storage?: {
      provider: string;
      access_level: string;
    };
    [key: string]: any; // Allow additional tech stack entries
  };
  knowledge_dna: {
    base_id: string;
    pricing_logic: string;
    escalation_path: string;
    capabilities: string[];
    procedures: Array<{
      process: string;
      steps: string[];
    }>;
    knowledge_gaps?: string[];
  };
  retention_logic?: RetentionLogic;
  deviations?: AresMissionDeviation[];
  // Deprecated legacy fields (for backwards compatibility)
  ecosystemLayer?: {
    softwareSystems: string[];
    logicFlow: string;
  };
  linguisticLayer?: {
    brandTone: string;
    uvp: string;
    jargon: string[];
  };
  workflowLayer?: {
    procedures: { process: string; steps: string[] }[];
  };
  edgeCaseLayer?: {
    knowledgeGaps: string[];
  };
  firstPrinciples?: string[];
  systemMastery?: string;
  interviewData?: AresInterviewState;
  deploymentReport?: DeploymentReadinessReport;
}

export interface UselessnessReport {
  status: 'PASS' | 'FAIL_KNOWLEDGE_GAP';
  score: string;
  criticalFailures: {
    test: string;
    result: string;
    fix: string;
  }[];
  recommendation: string;
}

export interface AresInterviewQuestion {
  id: string;
  type: 'PRICING' | 'SYSTEM' | 'VOICE' | 'ESCALATION' | 'CUSTOM';
  prompt: string;
  answer?: string;
  status: 'pending' | 'answered';
}

export interface AresInterviewState {
  questions: AresInterviewQuestion[];
  currentQuestionIndex: number;
  dnaStrength: number; // 0-100
  status: 'idle' | 'in-progress' | 'completed';
}

export interface DeploymentReadinessReport {
  executiveSummary: string;
  masteredDomains: {
    domain: string;
    details: string;
  }[];
  guardrailManifesto: {
    rule: string;
    constraint: string;
  }[];
  simulationResults: {
    scenario: string;
    result: string;
    accuracy: string;
  };
  metrics: {
    accuracy: number;
    tone: number;
    speed: number;
    toolUse: number;
  };
  architectNote: string;
}

export interface DraftMessage {
  id: string;
  associateName: string;
  to: string;
  subject: string;
  content: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: string;
}

export interface PerformanceMetric {
  name: string;
  hoursReclaimed: number;
  leadsQualified: number;
}

export interface UserRegistration {
  id: string;
  name: string;
  company: string;
  email: string;
  phone?: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: string;
}

// ============================================================================
// ARES SELF-HEALING INFRASTRUCTURE TYPES
// ============================================================================

export type AresProposalType = 'HOTFIX' | 'UI_OPTIMIZATION' | 'PERFORMANCE' | 'SECURITY' | 'CLEANUP' | 'AGENT_GENERATION' | 'INFRASTRUCTURE_SCALING';
export type AresProposalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'DEPLOYED';
export type AresSeverity = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' | 'INFO';

export interface AresSystemIntegrityMonitor {
  uptime_target: string;
  error_threshold: string;
  auto_patch_enabled: boolean;
  last_health_check: string;
  identified_bottlenecks: string[];
  system_health_score: number;
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
    original_code?: string;
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
  created_by: 'ARES' | 'USER_DIRECTIVE' | 'SYSTEM';
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
  proposal_id?: string;
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
  safety_toggle: boolean;
  telemetry_endpoints: string[];
  alert_thresholds: {
    error_rate_percentage: number;
    api_timeout_ms: number;
    memory_usage_percentage: number;
  };
}

export interface AresAgentManifestWithMonitoring extends AresTrainingManifest {
  system_integrity_monitor?: AresSystemIntegrityMonitor;
}

// ARES BUG REPORT PARSER TYPES
export interface AresBugTicket {
  ticket_metadata: {
    issue_id: string;
    reporter: string;
    priority: "P0 - Critical" | "P1 - Operational" | "P2 - UX/UI";
  };
  diagnostic_report: {
    symptom: string;
    root_cause: string;
    telemetry_log?: string;
  };
  proposed_resolution: {
    fix_type: "Code_Patch" | "Config_Update" | "Rollback";
    action: string;
    impact_analysis: string;
  };
  ares_certification: {
    status: "Awaiting_Human_Approval" | "Approved" | "Rejected" | "Patched";
    safety_toggle: "Active" | "Bypassed";
  };
}
