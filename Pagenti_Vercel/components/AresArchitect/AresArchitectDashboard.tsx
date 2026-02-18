import React, { useState, useEffect } from 'react';
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Code,
    Cpu,
    Flame,
    GitBranch,
    Layers,
    Loader2,
    Shield,
    ShieldAlert,
    TrendingUp,
    Zap,
    X,
    Check,
    Eye,
    Trash2,
    Terminal,
    Map
} from 'lucide-react';

import { parseUserDirective } from '../../services/aresDirectiveParser';
import { agentService } from '../../services/agentService';
import { AssociateStatus } from '../../types';

// Import types (these will be added to your main types.ts)
import {
    AresProposal,
    AresHealthLog,
    AresAlert,
    AresAnalytics,
    AresDevOpsConfig,
    AresSeverity,
    AresProposalStatus,
    AresBugTicket
} from '../../types';

import { AresFixItNotification } from './AresFixItNotification';
import { AresChat } from './AresChat';
import { AresCommandCenter } from './AresCommandCenter';
import { aresService } from '../../services/aresService';
import { monitorSystemHealth, analyzeErrorAndProposeFix, executeProposal } from '../../services/aresTelemetry';
import { db, ARES_PROPOSALS_COLLECTION, ARES_LOGS_COLLECTION } from '../../services/firebase';
import { onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';

interface AresArchitectDashboardProps {
    config: AresDevOpsConfig;
    onConfigUpdate: (config: AresDevOpsConfig) => void;
    onApproveProposal: (proposalId: string) => void;
    onRejectProposal: (proposalId: string) => void;
}

import { useAresTheme } from '../../contexts/AresThemeContext';

export const AresArchitectDashboard: React.FC<AresArchitectDashboardProps> = ({
    config,
    onConfigUpdate,
    onApproveProposal,
    onRejectProposal
}) => {
    const { updateTheme } = useAresTheme(); // Access the Theme Engine
    const [activeTab, setActiveTab] = useState<'health' | 'proposals' | 'analytics' | 'config' | 'directives' | 'center'>('health');
    const [proposals, setProposals] = useState<AresProposal[]>([]);
    const [healthLogs, setHealthLogs] = useState<AresHealthLog[]>([]);
    const [alerts, setAlerts] = useState<AresAlert[]>([]);
    const [analytics, setAnalytics] = useState<AresAnalytics | null>(null);
    const [systemHealth, setSystemHealth] = useState(98.5);
    const [activeTicket, setActiveTicket] = useState<AresBugTicket | null>(null);

    // Directive State
    const [directiveInput, setDirectiveInput] = useState('');
    const [isProcessingDirective, setIsProcessingDirective] = useState(false);
    const [lastDirectiveResult, setLastDirectiveResult] = useState<string | null>(null);

    // Real Data Loading
    useEffect(() => {
        if (!db) return;

        // 1. Listen for Proposals
        const qProposals = query(collection(db, ARES_PROPOSALS_COLLECTION), orderBy('timestamp', 'desc'));
        const unsubscribeProposals = onSnapshot(qProposals, (snapshot) => {
            const newProposals: AresProposal[] = [];
            snapshot.forEach(doc => newProposals.push(doc.data() as AresProposal));
            setProposals(newProposals);
        });

        // 2. Listen for Health Logs
        const qLogs = query(collection(db, ARES_LOGS_COLLECTION), orderBy('timestamp', 'desc'), limit(50));
        const unsubscribeLogs = onSnapshot(qLogs, (snapshot) => {
            const newLogs: AresHealthLog[] = [];
            snapshot.forEach(doc => newLogs.push(doc.data() as AresHealthLog));
            setHealthLogs(newLogs);

            // Derive System Health Score (simple heuristic)
            if (newLogs.length > 0) {
                const recentLogs = newLogs.slice(0, 10);
                const errors = recentLogs.filter(l => l.severity === 'HIGH' || l.severity === 'CRITICAL').length;
                setSystemHealth(Math.max(0, 100 - (errors * 10)));
            }
        });

        // 3. Load Config
        const fetchConfig = async () => {
            const remoteConfig = await aresService.getConfig();
            if (remoteConfig) onConfigUpdate(remoteConfig);
        };
        fetchConfig();

        return () => {
            unsubscribeProposals();
            unsubscribeLogs();
        };
    }, [db, onConfigUpdate]);

    // Active Ticket Mock (keep for demo or integrate with real alerts)
    useEffect(() => {
        // Mock an active bug ticket for demonstration
        setActiveTicket({
            ticket_metadata: {
                issue_id: "BUG-2026-404",
                reporter: "User_Feedback_ID_99",
                priority: "P1 - Operational"
            },
            diagnostic_report: {
                symptom: "Agent failing to process user CSV attachments",
                root_cause: "Malformed JSON schema in the CSV parsing module preventing data ingress.",
                telemetry_log: "ERROR 422: Unprocessable Entity at endpoint /v1/ingest."
            },
            proposed_resolution: {
                fix_type: "Code_Patch",
                action: "Updating the CSV parser regex pattern to handle varied delimiters.",
                impact_analysis: "Zero downtime. Updates logic core only."
            },
            ares_certification: {
                status: "Awaiting_Human_Approval",
                safety_toggle: "Active"
            }
        });
    }, []);

    const getSeverityColor = (severity: AresSeverity) => {
        switch (severity) {
            case 'CRITICAL': return 'text-red-600 bg-red-50 border-red-200';
            case 'HIGH': return 'text-orange-600 bg-orange-50 border-orange-200';
            case 'MODERATE': return 'text-amber-600 bg-amber-50 border-amber-200';
            case 'LOW': return 'text-blue-600 bg-blue-50 border-blue-200';
            case 'INFO': return 'text-gray-600 bg-gray-50 border-gray-200';
        }
    };

    const getLogTypeIcon = (type: string) => {
        switch (type) {
            case 'FIXED': return <CheckCircle2 className="text-emerald-500" size={20} />;
            case 'PROPOSAL': return <Zap className="text-indigo-500" size={20} />;
            case 'CLEANUP': return <Trash2 className="text-blue-500" size={20} />;
            case 'OPTIMIZATION': return <TrendingUp className="text-violet-500" size={20} />;
            case 'WARNING': return <AlertTriangle className="text-amber-500" size={20} />;
            default: return <Activity className="text-gray-500" size={20} />;
        }
    };

    const handleApproveLocal = (proposal: AresProposal) => {
        if (proposal.type === 'AGENT_GENERATION') {
            const newAgentName = proposal.title.replace('New Agent: ', '').trim();
            // Minimal Agent Construction for prototype
            agentService.saveAgent({
                id: `ares-gen-${Date.now()}`,
                name: newAgentName,
                role: { en: newAgentName } as any,
                description: { en: proposal.description } as any,
                department: 'Legal & Compliance',
                status: AssociateStatus.AVAILABLE,
                avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=400',
                hourlyRate: 200,
                expertise: { en: ['ARES Generated'] } as any,
                tools: ['Ares Core'],
                scores: [{ subject: 'ARES Reliability', A: 100, fullMark: 100 }],
                voiceEnabled: false,
                languages: ['English'],
                demoVideo: '',
                aresCertification: {
                    status: 'certified',
                    certifiedAt: new Date().toISOString(),
                    score: 100
                }
            } as any);
        } else if (proposal.type === 'UI_OPTIMIZATION') {
            // Apply UI Theme Update
            const targetColor = proposal.ui_changes?.[0]?.proposed_state || proposal.description;
            updateTheme(targetColor, proposal.title);

            // Show toast or feedback? (Optional)
        }

        // Permanent Status Update
        aresService.updateProposalStatus(proposal.id, 'APPROVED', {
            approved_by: 'Super Admin',
            approved_at: new Date().toISOString()
        });

        onApproveProposal(proposal.id);
    };

    const handleRejectLocal = (proposalId: string) => {
        aresService.updateProposalStatus(proposalId, 'REJECTED', {
            rejected_at: new Date().toISOString()
        });
        onRejectProposal(proposalId);
    };

    const handleSubmitDirective = async () => {
        if (!directiveInput.trim()) return;

        setIsProcessingDirective(true);
        setLastDirectiveResult(null);

        try {
            // In a real scenario, this would call the API
            const newProposal = await parseUserDirective(directiveInput);

            // Artificial delay for UX "thinking" feel
            await new Promise(resolve => setTimeout(resolve, 1500));

            setProposals(prev => [newProposal, ...prev]);
            setDirectiveInput('');
            setLastDirectiveResult(`Directive processed: "${newProposal.title}". Review the proposal below.`);
            setActiveTab('proposals'); // Switch to review mode
        } catch (error) {
            console.error("Directive failed:", error);
            setLastDirectiveResult("Failed to process directive. Please try again.");
        } finally {
            setIsProcessingDirective(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-violet-50/20 p-8">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl">
                        <Cpu className="text-white" size={32} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                            ARES Architect
                        </h1>
                        <p className="text-gray-600">Self-Healing Infrastructure Overseer</p>
                    </div>
                </div>

                {/* System Health Score */}
                <div className="mt-6 p-6 bg-white rounded-3xl shadow-lg border border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                System Health
                            </div>
                            <div className="text-5xl font-black text-emerald-600">
                                {systemHealth}%
                            </div>
                        </div>
                        <div className="flex gap-6">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-indigo-600">{proposals.length}</div>
                                <div className="text-xs text-gray-500">Pending Proposals</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-emerald-600">{healthLogs.filter(l => l.log_type === 'FIXED').length}</div>
                                <div className="text-xs text-gray-500">Auto-Fixes</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-amber-600">{alerts.length}</div>
                                <div className="text-xs text-gray-500">Active Alerts</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Active Bug Ticket Notification */}
            {activeTicket && (
                <AresFixItNotification
                    ticket={activeTicket}
                    onApprovePatch={() => {
                        setSystemHealth(prev => Math.min(100, prev + 1.5));
                        setHealthLogs(prev => [{
                            id: `fix-${Date.now()}`,
                            timestamp: new Date().toISOString(),
                            log_type: 'FIXED',
                            severity: 'HIGH',
                            message: `Auto-Patched: ${activeTicket.diagnostic_report.root_cause}`,
                            component: 'Logic Core',
                            details: activeTicket.proposed_resolution.action,
                            metrics: { improvement_percentage: 100 }
                        }, ...prev]);
                        setTimeout(() => setActiveTicket(null), 3000);
                    }}
                    onDismiss={() => setActiveTicket(null)}
                />
            )}

            {/* Tabs */}
            <div className="flex gap-2 mb-6 bg-white p-2 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
                {[
                    { key: 'health' as const, label: 'Health Logs', icon: Activity },
                    { key: 'center' as const, label: 'Command Center', icon: Map },
                    { key: 'directives' as const, label: 'ARES Uplink', icon: Terminal },
                    { key: 'proposals' as const, label: 'Proposals', icon: GitBranch },
                    { key: 'analytics' as const, label: 'Analytics', icon: TrendingUp },
                    { key: 'config' as const, label: 'Configuration', icon: Shield }
                ].map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${activeTab === tab.key
                            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg'
                            : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="space-y-4">
                {/* Health Logs Tab */}
                {activeTab === 'health' && (
                    <div className="space-y-4">
                        {healthLogs.map((log) => (
                            <div key={log.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                                <div className="flex items-start gap-4">
                                    {getLogTypeIcon(log.log_type)}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getSeverityColor(log.severity)}`}>
                                                {log.severity}
                                            </span>
                                            <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">
                                                {log.component}
                                            </span>
                                            <span className="text-xs text-gray-400">{new Date(log.timestamp).toLocaleString()}</span>
                                        </div>
                                        <div className="font-semibold text-gray-900 mb-1">
                                            [{log.log_type}]: {log.message}
                                        </div>
                                        {log.details && (
                                            <div className="text-sm text-gray-600">{log.details}</div>
                                        )}
                                        {log.metrics?.improvement_percentage && (
                                            <div className="mt-2 flex items-center gap-2 text-emerald-600">
                                                <TrendingUp size={16} />
                                                <span className="text-sm font-semibold">+{log.metrics.improvement_percentage}% improvement</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Directives Tab */}
                {activeTab === 'directives' && (
                    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <AresChat onApproveProposal={handleApproveLocal} />

                        <div className="mt-8 grid grid-cols-3 gap-4">
                            <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-help group">
                                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 group-hover:text-indigo-500 transition-colors">Agent Forge</div>
                                <div className="text-sm font-medium text-gray-700">"Build a [Role]"</div>
                            </div>
                            <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-help group">
                                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 group-hover:text-indigo-500 transition-colors">UI Engine</div>
                                <div className="text-sm font-medium text-gray-700">"Change [Component] to..."</div>
                            </div>
                            <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-help group">
                                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 group-hover:text-indigo-500 transition-colors">Scaling</div>
                                <div className="text-sm font-medium text-gray-700">"Optimize [Service]"</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Command Center Tab */}
                {activeTab === 'center' && (
                    <AresCommandCenter />
                )}

                {/* Proposals Tab */}
                {activeTab === 'proposals' && (
                    <div className="space-y-4">
                        {proposals.map((proposal) => (
                            <div key={proposal.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getSeverityColor(proposal.severity)}`}>
                                                {proposal.severity}
                                            </span>
                                            <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">
                                                {proposal.type.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900 mb-2">{proposal.title}</h3>
                                        <p className="text-gray-700 mb-3">{proposal.description}</p>
                                        <div className="text-sm text-gray-600 mb-3">
                                            <strong>Rationale:</strong> {proposal.rationale}
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                            <span className="flex items-center gap-1 text-gray-600">
                                                <Shield size={14} />
                                                Risk: <strong>{proposal.estimated_impact.risk_level}</strong>
                                            </span>
                                            <span className="flex items-center gap-1 text-gray-600">
                                                <Layers size={14} />
                                                {proposal.affected_component}
                                            </span>
                                        </div>
                                    </div>
                                    {proposal.status === 'PENDING' && proposal.approval_required && (
                                        <div className="flex gap-2 ml-4">
                                            <button
                                                onClick={() => handleApproveLocal(proposal)}
                                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold flex items-center gap-2 transition-colors"
                                            >
                                                <Check size={16} />
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => handleRejectLocal(proposal.id)}
                                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold flex items-center gap-2 transition-colors"
                                            >
                                                <X size={16} />
                                                Reject
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Analytics Tab */}
                {activeTab === 'analytics' && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h2 className="text-2xl font-bold mb-4">System Analytics</h2>
                        <p className="text-gray-600">Analytics data will be displayed here including heatmaps, user journey analysis, and performance metrics.</p>
                    </div>
                )}

                {/* Configuration Tab */}
                {activeTab === 'config' && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h2 className="text-2xl font-bold mb-4">DevOps Configuration</h2>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                <div>
                                    <div className="font-semibold">Auto-Fix Enabled</div>
                                    <div className="text-sm text-gray-600">Allow ARES to automatically apply approved fixes</div>
                                </div>
                                <label className="relative inline-block w-14 h-8">
                                    <input
                                        type="checkbox"
                                        checked={config.auto_fix_enabled}
                                        onChange={(e) => onConfigUpdate({ ...config, auto_fix_enabled: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-full h-full bg-gray-300 peer-checked:bg-emerald-600 rounded-full peer transition-colors cursor-pointer"></div>
                                    <div className="absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform peer-checked:translate-x-6"></div>
                                </label>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-red-50 rounded-xl border border-red-200">
                                <div>
                                    <div className="font-semibold text-red-900 flex items-center gap-2">
                                        <ShieldAlert size={18} />
                                        Safety Toggle
                                    </div>
                                    <div className="text-sm text-red-700">Human approval required for all production changes</div>
                                </div>
                                <label className="relative inline-block w-14 h-8">
                                    <input
                                        type="checkbox"
                                        checked={config.safety_toggle}
                                        onChange={(e) => onConfigUpdate({ ...config, safety_toggle: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-full h-full bg-red-300 peer-checked:bg-emerald-600 rounded-full peer transition-colors cursor-pointer"></div>
                                    <div className="absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform peer-checked:translate-x-6"></div>
                                </label>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
