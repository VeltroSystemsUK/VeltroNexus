export enum AssociateStatus {
  AVAILABLE = "Available for Placement",
  ON_TRIAL = "On Trial with 3 Clients",
  BUSY = "Fully Booked",
  ARES_CERTIFIED = "ARES Certified - Staging",
  LIVE_DEPLOYMENT = "Live Deployment - Revenue Generating",
  HIBERNATION = "System Hibernation - Payment Required",
}

export type LocalizedStr = Record<string, string>;
export type LocalizedList = Record<string, string[]>;

export interface SkillScore {
  subject: string;
  A: number;
  fullMark: number;
}

export type WorkflowTaskTrigger =
  | "on_instruction"
  | "scheduled"
  | "on_event"
  | "deal_closed"
  | "missing_docs_alert"
  | "file_uploaded"
  | "no_response_alert"
  | "proposal_draft_ready";

export interface WorkflowTask {
  id: string;
  name: string;
  description: string;
  trigger: WorkflowTaskTrigger;
  steps: string[];
  expectedOutput: string;
  escalationRule?: string;
}

export interface AgentWorkflow {
  jobDescription: string;
  responsibilities: string[];
  tasks: WorkflowTask[];
}

export interface DigitalAssociate {
  id: string;
  name: string;
  email?: string;
  role: string | LocalizedStr;
  department: string;
  status: AssociateStatus;
  avatar: string;
  expertise: string[] | LocalizedList;
  tools: string[];
  description: string | LocalizedStr;
  hourlyRate: number;
  scores: SkillScore[];
  voiceEnabled: boolean;
  voiceId?: string;
  // Workflow & Task Mapping
  workflow?: AgentWorkflow;
  // Metadata & DNA
  aresCertification?: {
    status: "pending" | "certified" | "failed";
    certifiedAt?: string;
    score: number;
    trainingManifest?: AresTrainingManifest;
  };
  commercial_integrity_layer?: CommercialIntegrityLayer;
}

export interface CommercialIntegrityLayer {
  payment_status: "ACTIVE" | "DELINQUENT" | "SUSPENDED";
  handoff_complete: boolean;
  oversight_mode: "Passive_Remote" | "Active_Intervention";
  delinquency_action: "Warn_Then_Suspend";
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
    authority_level: string;
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
  };
}

export interface AgentChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: Date;
  metadata?: {
    taskId?: string;
    workflowStep?: number;
    processingTime?: number;
  };
}

export interface AgentSession {
  id: string;
  agentId: string;
  userId: string;
  prospectId?: number;
  lastInteractionAt: Date;
  messages: AgentChatMessage[];
  context?: Record<string, any>;
}

export interface MissionDeviation {
  id: string;
  agentId: string;
  sessionId: string;
  userId: string;
  timestamp: Date;
  category: "Logic_Drift" | "Commercial_Breach" | "Instructional_Override";
  assessment: string;
  severity: "info" | "warning" | "critical";
  status: "PENDING" | "RESOLVED";
}
