import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Terminal, Send, Zap, Shield, Database, Cpu, ArrowRight, Loader2, Bot, Layout, CheckCircle2 } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface LogEntry {
    type: 'system' | 'success' | 'warning' | 'error';
    message: string;
    timestamp: string;
}

export const AresTerminalView: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([
        { type: 'system', message: 'ARES System v4.2 Initialize...', timestamp: new Date().toLocaleTimeString() },
        { type: 'system', message: 'Lead Architect: Online.', timestamp: new Date().toLocaleTimeString() },
        { type: 'success', message: 'Forge Connection Link: Established.', timestamp: new Date().toLocaleTimeString() }
    ]);
    const [blueprint, setBlueprint] = useState<any | null>(null);
    const logEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const addLog = (message: string, type: LogEntry['type'] = 'system') => {
        setLogs(prev => [...prev, { message, type, timestamp: new Date().toLocaleTimeString() }]);
    };

    const handleInitiateProtocol = async () => {
        if (!input.trim() || isProcessing) return;

        setIsProcessing(true);
        setBlueprint(null);
        addLog(`Analyzing Brief: "${input.slice(0, 30)}..."`, 'system');

        // Simulate Molecular Synthesis steps
        setTimeout(() => addLog('DNA Synthesis: Extraction Phase...', 'system'), 1000);
        setTimeout(() => addLog('Role Mapping: Identified 3 potential DNA strands.', 'system'), 2000);
        setTimeout(() => addLog('Chain-of-Thought Reasoning initiated...', 'system'), 3000);
        setTimeout(() => addLog('[SUCCESS]: Mapping Lead-to-Deal Logic Flow.', 'success'), 4000);
        setTimeout(() => addLog('Applying Constellation Constraints...', 'system'), 5000);

        setTimeout(() => {
            const mockBlueprint = {
                IdentityMatrix: {
                    Name: "Aetherius",
                    Department: "Executive Operations",
                    Function: "Strategic Growth Orchestrator"
                },
                CoreLogic: {
                    SystemPrompt: "You are Aetherius. Your goal is to optimize revenue operations for Pagenti. Analyze lead quality using CoT logic...",
                    Capabilities: "Gmail_API, HubSpot_Sync, internal_analytics",
                    Rate: "0.85"
                },
                ValidationData: {
                    CaseStudy: "Optimization of SaaS lead pipelines resulting in 40% efficiency gains.",
                    OutcomeMetrics: "Lead-to-Meeting Conversion Rate, Pipeline Velocity"
                }
            };
            setBlueprint(mockBlueprint);
            addLog('Deployment Blueprint Synthesized.', 'success');
            setIsProcessing(false);
            showToast('Architect Protocol Complete', 'success');
        }, 6500);
    };

    return (
        <div className="min-h-screen bg-[#050505] text-[#00FF41] font-mono p-4 lg:p-8 flex flex-col lg:flex-row gap-6">
            {/* Sidebar / Logs */}
            <div className="lg:w-1/3 flex flex-col border border-[#00FF41]/20 rounded-2xl bg-black/40 overflow-hidden shadow-[0_0_30px_rgba(0,255,65,0.05)]">
                <div className="bg-[#00FF41]/10 px-6 py-4 border-b border-[#00FF41]/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Terminal size={18} />
                        <span className="text-xs font-black uppercase tracking-widest">ARES_LIVE_LOG</span>
                    </div>
                    <div className="flex gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-red-500/50"></div>
                        <div className="w-2 h-2 rounded-full bg-amber-500/50"></div>
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-3 text-[11px] leading-relaxed">
                    {logs.map((log, i) => (
                        <div key={i} className="flex gap-3 animate-fade-in opacity-80 hover:opacity-100 transition-opacity">
                            <span className="opacity-30 flex-shrink-0">[{log.timestamp}]</span>
                            <span className={
                                log.type === 'success' ? 'text-green-400' :
                                    log.type === 'error' ? 'text-red-400' :
                                        log.type === 'warning' ? 'text-amber-400' :
                                            'text-indigo-400'
                            }>
                                {log.type === 'system' ? '[SYS] ' : log.type === 'success' ? '[OK ] ' : '[INFO] '}
                                {log.message}
                            </span>
                        </div>
                    ))}
                    <div ref={logEndRef} />
                </div>
            </div>

            {/* Main Command Input */}
            <div className="flex-1 flex flex-col gap-6">
                <div className="flex-1 flex flex-col border border-[#00FF41]/20 rounded-[2.5rem] bg-black/40 p-10 overflow-hidden relative shadow-[0_0_50px_rgba(0,255,65,0.032)]">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,255,65,0.02),transparent_70%)] pointer-events-none"></div>

                    <div className="relative z-10 flex flex-col h-full">
                        <div className="mb-10 text-center">
                            <div className="w-20 h-20 bg-[#00FF41]/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#00FF41]/30">
                                <Zap size={40} className="text-[#00FF41] animate-pulse" />
                            </div>
                            <h2 className="text-4xl font-black tracking-tighter text-white mb-2">ARES: THE ARCHITECT</h2>
                            <p className="text-[#00FF41]/60 text-sm max-w-md mx-auto">Input client requirements to synthesize a high-performance Digital Associate blueprint.</p>
                        </div>

                        <div className="flex-1 flex flex-col">
                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[#00FF41]/40 mb-3 ml-2">Master Intake Protocol</label>
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Paste user brief here..."
                                className="flex-1 bg-black/60 border border-[#00FF41]/20 rounded-[2rem] p-8 text-white focus:outline-none focus:ring-2 focus:ring-[#00FF41]/20 transition-all font-mono resize-none leading-relaxed text-sm placeholder:text-[#00FF41]/20"
                            />
                        </div>

                        <div className="mt-8 flex justify-center">
                            <button
                                onClick={handleInitiateProtocol}
                                disabled={!input.trim() || isProcessing}
                                className={`
                                    group relative overflow-hidden px-12 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all
                                    ${isProcessing ? 'bg-[#00FF41]/20 text-[#00FF41] cursor-not-allowed' : 'bg-[#00FF41] text-black hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(0,255,65,0.3)] hover:shadow-[0_0_50px_rgba(0,255,65,0.5)]'}
                                `}
                            >
                                <span className="relative z-10 flex items-center gap-3">
                                    {isProcessing ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Synthesizing DNA...
                                        </>
                                    ) : (
                                        <>
                                            <Shield size={16} />
                                            Initiate Architect Protocol
                                        </>
                                    )}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Blueprint Result */}
                {blueprint && (
                    <div className="animate-slide-up border border-[#00FF41]/20 rounded-[2.5rem] bg-[#00FF41]/5 p-8 relative overflow-hidden backdrop-blur-md">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <Cpu size={24} className="text-[#00FF41]" />
                                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Blueprint synthesized</h3>
                            </div>
                            <div className="bg-[#00FF41]/20 text-[#00FF41] px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-[#00FF41]/30">
                                High StabilityDNA_4.0
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="bg-black/60 p-6 rounded-3xl border border-[#00FF41]/10">
                                <p className="text-[10px] font-black text-[#00FF41]/40 uppercase tracking-widest mb-2">Designation</p>
                                <p className="text-lg font-black text-white">{blueprint.IdentityMatrix.Name}</p>
                                <p className="text-xs text-[#00FF41]/60">{blueprint.IdentityMatrix.Function}</p>
                            </div>
                            <div className="bg-black/60 p-6 rounded-3xl border border-[#00FF41]/10">
                                <p className="text-[10px] font-black text-[#00FF41]/40 uppercase tracking-widest mb-2">Capabilities</p>
                                <div className="flex flex-wrap gap-2">
                                    {blueprint.CoreLogic.Capabilities.split(',').map((cap: string, i: number) => (
                                        <span key={i} className="text-[10px] text-white bg-[#00FF41]/10 px-2.5 py-1 rounded-md border border-[#00FF41]/20">{cap.trim()}</span>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-black/60 p-6 rounded-3xl border border-[#00FF41]/10">
                                <p className="text-[10px] font-black text-[#00FF41]/40 uppercase tracking-widest mb-2">Effective Rate</p>
                                <p className="text-2xl font-black text-[#00FF41]">£{blueprint.CoreLogic.Rate}<span className="text-xs font-normal">/hr</span></p>
                            </div>
                        </div>

                        <div className="flex flex-row-reverse gap-4">
                            <button
                                onClick={() => navigate(`/forge?architectMode=true&blueprint=${btoa(JSON.stringify(blueprint))}`)}
                                className="bg-white text-black px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl flex items-center gap-3"
                            >
                                Initialize Forge <ArrowRight size={16} />
                            </button>
                            <button className="text-[#00FF41] border border-[#00FF41]/30 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#00FF41]/10 transition-all flex items-center gap-3">
                                <Shield size={16} /> Open DNA Audit
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
