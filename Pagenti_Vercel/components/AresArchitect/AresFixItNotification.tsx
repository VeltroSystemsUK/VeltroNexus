import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Code, Cpu, Terminal, X, ChevronDown, ChevronUp } from 'lucide-react';
import { AresBugTicket } from '../../types';

interface AresFixItNotificationProps {
    ticket: AresBugTicket;
    onApprovePatch: () => void;
    onDismiss: () => void;
}

export const AresFixItNotification: React.FC<AresFixItNotificationProps> = ({ ticket, onApprovePatch, onDismiss }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isPatching, setIsPatching] = useState(false);
    const [patched, setPatched] = useState(false);

    const handlePatch = async () => {
        setIsPatching(true);
        // Simulate patch delay for effect
        await new Promise(resolve => setTimeout(resolve, 2000));
        setIsPatching(false);
        setPatched(true);
        onApprovePatch();
    };

    const priorityColor = ticket.ticket_metadata.priority.includes('P0') ? 'red' : ticket.ticket_metadata.priority.includes('P1') ? 'amber' : 'blue';
    const bgGradient = ticket.ticket_metadata.priority.includes('P0') ? 'from-red-50 to-orange-50' : 'from-indigo-50 to-violet-50';

    if (patched) {
        return (
            <div className={`w-full max-w-2xl mx-auto mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500`}>
                <div className="bg-emerald-100 p-3 rounded-xl border border-emerald-200">
                    <CheckCircle className="text-emerald-600" size={24} />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-emerald-900">Auto-Patch Deployed Successfully</h3>
                    <p className="text-emerald-700">ARES has rewritten the logic core. Issue resolved.</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`w-full max-w-2xl mx-auto mb-6 rounded-2xl shadow-lg border border-gray-200 bg-gradient-to-br ${bgGradient} overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500`}>
            {/* Header */}
            <div className="p-6 border-b border-gray-200/50 relative">
                <button onClick={onDismiss} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
                    <X size={20} />
                </button>
                <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl border border-${priorityColor}-200 bg-white/50 backdrop-blur-sm shadow-sm`}>
                        <AlertTriangle className={`text-${priorityColor}-600`} size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold border border-${priorityColor}-200 bg-${priorityColor}-100 text-${priorityColor}-700 uppercase tracking-wide`}>
                                {ticket.ticket_metadata.priority}
                            </span>
                            <span className="text-xs text-gray-500 font-mono">{ticket.ticket_metadata.issue_id}</span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 leading-tight">
                            ARES has detected a bottleneck in the workflow
                        </h3>
                        <p className="text-gray-600 mt-1">{ticket.diagnostic_report.symptom}</p>
                    </div>
                </div>
            </div>

            {/* Content Actions */}
            <div className="p-6 bg-white/60 backdrop-blur-sm">
                <div className="flex gap-4">
                    <button
                        onClick={handlePatch}
                        disabled={isPatching}
                        className="flex-1 bg-gray-900 hover:bg-black text-white px-6 py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all hover:shadow-lg disabled:opacity-70 disabled:cursor-wait group relative overflow-hidden"
                    >
                        {isPatching ? (
                            <>
                                <Cpu className="animate-spin" size={18} />
                                Rewriting Logic...
                            </>
                        ) : (
                            <>
                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-10 transition-opacity" />
                                <Code size={18} />
                                Approve Auto-Patch
                            </>
                        )}
                    </button>

                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="px-6 py-3.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium flex items-center gap-2 transition-colors"
                    >
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        {isExpanded ? 'Hide' : 'View'} Technical Log
                    </button>
                </div>

                {/* Expanded Technical Log */}
                {isExpanded && (
                    <div className="mt-6 animate-in slide-in-from-top-2 duration-300">
                        <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-700 shadow-inner">
                            <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
                                <div className="flex items-center gap-2 text-slate-400 text-xs font-mono">
                                    <Terminal size={12} />
                                    ARES_DIAGNOSTIC_LOG.json
                                </div>
                                <div className="text-xs text-slate-500">Read-Only</div>
                            </div>
                            <pre className="p-4 text-xs font-mono text-emerald-400 overflow-x-auto">
                                {JSON.stringify(ticket, null, 2)}
                            </pre>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                                <div className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1">Root Cause</div>
                                <p className="text-sm text-blue-900">{ticket.diagnostic_report.root_cause}</p>
                            </div>
                            <div className="p-4 rounded-xl bg-purple-50 border border-purple-100">
                                <div className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-1">Proposed Resolution</div>
                                <p className="text-sm text-purple-900">{ticket.proposed_resolution.action}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-2">
                    <ShieldIcon status={ticket.ares_certification.safety_toggle} />
                    <span>Safety Toggle: <strong className="text-gray-700">{ticket.ares_certification.safety_toggle}</strong></span>
                </div>
                <div className="font-mono">ID: {ticket.ticket_metadata.issue_id}</div>
            </div>
        </div>
    );
};

const ShieldIcon = ({ status }: { status: string }) => {
    return status === 'Active' ? (
        <div className="flex items-center gap-1 text-emerald-600">
            <CheckCircle size={12} />
        </div>
    ) : (
        <div className="flex items-center gap-1 text-red-600">
            <AlertTriangle size={12} />
        </div>
    );
};
