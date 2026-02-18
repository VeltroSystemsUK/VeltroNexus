import React, { useState, useEffect } from 'react';
import {
    Cpu,
    ShieldCheck,
    ShieldAlert,
    AlertCircle,
    CheckCircle2,
    Zap,
    Activity,
    Search,
    Terminal as TerminalIcon,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { AresTrainingManifest, UselessnessReport, AresInterviewState, AresInterviewQuestion, DeploymentReadinessReport } from '../../types';
import {
    trainAgentWithAres,
    runUselessnessDiagnostic,
    aresDirectPatchKnowledgeGaps,
    generateAresInterviewQuestions,
    updateAgentWithInterviewAnswers,
    generateDeploymentReport
} from '../../services/geminiService';
import { AresInterviewChat, AresDeploymentReport } from './index';

interface AresTrainingDashboardProps {
    agentName: string;
    role: string;
    companyDNA: any;
    onComplete: (manifest: AresTrainingManifest, report: UselessnessReport) => void;
}

export const AresTrainingDashboard: React.FC<AresTrainingDashboardProps> = ({
    agentName,
    role,
    companyDNA,
    onComplete
}) => {
    const [phase, setPhase] = useState<'IDLE' | 'DNA_EXTRACTION' | 'DIAGNOSTIC' | 'INTERVIEW' | 'COMPLETE'>('IDLE');
    const [progress, setProgress] = useState(0);
    const [manifest, setManifest] = useState<AresTrainingManifest | null>(null);
    const [report, setReport] = useState<UselessnessReport | null>(null);
    const [deploymentReport, setDeploymentReport] = useState<DeploymentReadinessReport | null>(null);
    const [interviewState, setInterviewState] = useState<AresInterviewState | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [showDetails, setShowDetails] = useState(false);

    const addLog = (msg: string) => {
        setLogs(prev => [...prev.slice(-10), `[ARES] ${new Date().toLocaleTimeString()} - ${msg}`]);
    };

    const startTraining = async () => {
        setPhase('DNA_EXTRACTION');
        setProgress(10);
        addLog(`Initiating DNA Extraction for ${agentName}...`);

        try {
            // Simulated delay for UI feedback
            await new Promise(r => setTimeout(r, 1500));
            setProgress(30);
            addLog("Ecosystem Layer: Mapping software handshake protocols...");

            const trainingManifest = await trainAgentWithAres(agentName, role, companyDNA);
            setManifest(trainingManifest);

            setProgress(60);
            addLog("Linguistic Layer: Branding tone and UVP encoded.");
            addLog("Workflow Layer: Step-by-step procedures deconstructed.");

            // Add longer delay before next API call to prevent rate limiting
            await new Promise(r => setTimeout(r, 8000));

            setPhase('DIAGNOSTIC');
            setProgress(75);
            addLog("Phase 2: Executing Uselessness Logic Diagnostic Suite...");

            const diagnosticReport = await runUselessnessDiagnostic(agentName, trainingManifest);
            setReport(diagnosticReport);

            if (diagnosticReport.status === 'FAIL_KNOWLEDGE_GAP') {
                setProgress(85);
                addLog("⚡ Knowledge gaps detected. Ares is patching autonomously...");
                addLog("Using Master Architect authority to fill logical holes...");

                // Add delay before autonomous patching
                await new Promise(r => setTimeout(r, 8000));

                // ARES DIRECTLY PATCHES THE GAPS - NO INTERVIEW NEEDED
                const patchedManifest = await aresDirectPatchKnowledgeGaps(
                    agentName,
                    role,
                    trainingManifest,
                    diagnosticReport,
                    companyDNA
                );
                setManifest(patchedManifest);

                addLog("✓ Knowledge gaps patched successfully.");
                addLog("Agent logic is now deployment-ready.");
                setProgress(95);

                // Continue to deployment report with patched manifest
                await new Promise(r => setTimeout(r, 3000));

                const finalReport = await generateDeploymentReport(agentName, role, patchedManifest);
                setDeploymentReport(finalReport);
                setProgress(100);
                setPhase('COMPLETE');
                onComplete(patchedManifest, diagnosticReport);
            } else {
                addLog("Ares Training Cycle Complete.");
                addLog("Synthesizing Deployment Readiness Report...");

                // Add longer delay before deployment report generation
                await new Promise(r => setTimeout(r, 10000));

                const finalReport = await generateDeploymentReport(agentName, role, trainingManifest);
                setDeploymentReport(finalReport);
                setProgress(100);
                setPhase('COMPLETE');
                onComplete(trainingManifest, diagnosticReport);
            }
        } catch (error: any) {
            const isRateLimit = error.message?.includes('429') || error.status === 429 || error.code === 429;
            addLog(isRateLimit
                ? "Rate limit reached. Please wait a moment and try again."
                : "Critical System Failure: Logic injection interrupted.");
            setPhase('IDLE');
        }
    };

    useEffect(() => {
        if (phase === 'IDLE') {
            const timer = setTimeout(() => startTraining(), 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleInterviewAnswer = (questionId: string, answer: string) => {
        if (!interviewState) return;

        const updatedQuestions = interviewState.questions.map(q =>
            q.id === questionId ? { ...q, answer, status: 'answered' as const } : q
        );

        const isLast = interviewState.currentQuestionIndex === interviewState.questions.length - 1;
        const newProgress = Math.min(100, interviewState.dnaStrength + (70 / interviewState.questions.length));

        setInterviewState({
            ...interviewState,
            questions: updatedQuestions,
            currentQuestionIndex: isLast ? interviewState.currentQuestionIndex : interviewState.currentQuestionIndex + 1,
            dnaStrength: Math.floor(newProgress),
            status: isLast ? 'completed' : 'in-progress'
        });

        addLog(`Received input for ${questionId}. Updating Logic Core...`);
    };

    const finalizeInterview = async () => {
        if (!manifest || !interviewState) return;

        setPhase('COMPLETE');
        setProgress(100);
        addLog("Finalizing DNA Synthesis...");

        try {
            // Add delay before API call
            await new Promise(r => setTimeout(r, 2000));

            const finalManifest = await updateAgentWithInterviewAnswers(manifest, interviewState);
            setManifest(finalManifest);

            addLog("Synthesizing Deployment Readiness Report...");

            // Add delay before deployment report generation
            await new Promise(r => setTimeout(r, 3000));

            const dReport = await generateDeploymentReport(agentName, role, finalManifest);
            setDeploymentReport(dReport);

            // Generate a final "Passed" report
            const finalReport: UselessnessReport = {
                status: 'PASS',
                score: `${interviewState.dnaStrength}/100`,
                criticalFailures: [],
                recommendation: "Human clarification successful. Agent is now Ares Certified and ready for full-scale deployment."
            };
            setReport(finalReport);
            addLog("Ares Training Cycle Complete. Certification Issued.");

            onComplete(finalManifest, finalReport);
        } catch (error: any) {
            const isRateLimit = error.message?.includes('429') || error.status === 429 || error.code === 429;
            addLog(isRateLimit
                ? "Rate limit reached during synthesis. Please wait and try again."
                : "Synthesis failed. Reverting to previous state.");
        }
    };

    const renderProgressBar = () => (
        <div className="w-full bg-gray-900/10 h-3 rounded-full overflow-hidden border border-gray-100 mb-6">
            <div
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
            >
                <div className="w-full h-full bg-[linear-gradient(45deg,rgba(255,255,255,0.1)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.1)_50%,rgba(255,255,255,0.1)_75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-[loading-bar_1s_linear_infinite]"></div>
            </div>
        </div>
    );

    return (
        <div className="bg-white rounded-[2.5rem] border border-gray-200 overflow-hidden shadow-2xl max-w-2xl mx-auto">
            {/* Header */}
            <div className="bg-gray-900 p-8 text-white relative">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Cpu size={120} />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-indigo-500 p-2 rounded-xl">
                            <ShieldCheck size={20} className="text-white" />
                        </div>
                        <h2 className="text-xl font-bold tracking-tight">ARES MASTER ARCHITECT</h2>
                    </div>
                    <p className="text-indigo-300 font-mono text-xs uppercase tracking-[0.3em]">Operational Logic Injection v2.4</p>
                </div>
            </div>

            <div className="p-8">
                {/* Status Bar */}
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        {phase === 'COMPLETE' ? (
                            <CheckCircle2 className="text-emerald-500" size={18} />
                        ) : (
                            <Activity className="text-indigo-500 animate-pulse" size={18} />
                        )}
                        <span className="text-sm font-bold text-gray-700">
                            {phase === 'DNA_EXTRACTION' && 'Phase 1: Knowledge Encoding...'}
                            {phase === 'DIAGNOSTIC' && 'Phase 2: Stress Testing Logic...'}
                            {phase === 'INTERVIEW' && 'Phase 3: Human Extraction Interview...'}
                            {phase === 'COMPLETE' && 'Cycle Complete: Ares Certified'}
                            {phase === 'IDLE' && 'Initializing Architect...'}
                        </span>
                    </div>
                    <span className="text-xs font-black font-mono text-gray-400">{progress}%</span>
                </div>

                {renderProgressBar()}

                {/* Console Logs */}
                <div className="bg-gray-950 rounded-2xl p-6 font-mono text-[11px] mb-8 border border-gray-800 shadow-inner min-h-[160px]">
                    <div className="flex items-center gap-2 text-indigo-400 mb-4 border-b border-gray-800 pb-2">
                        <TerminalIcon size={12} />
                        <span className="uppercase tracking-widest font-black">Ares System Console</span>
                    </div>
                    <div className="space-y-1.5">
                        {logs.map((log, i) => (
                            <div key={i} className={`${i === logs.length - 1 ? 'text-indigo-300' : 'text-gray-500'}`}>
                                {log}
                            </div>
                        ))}
                        {phase !== 'COMPLETE' && (
                            <div className="flex gap-1 text-indigo-500 animate-pulse">
                                <span>_</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Interview Interface */}
                {phase === 'INTERVIEW' && interviewState && manifest && (
                    <div className="mb-8">
                        <AresInterviewChat
                            agentName={agentName}
                            agentRole={role}
                            interviewState={interviewState}
                            manifest={manifest}
                            companyDNA={companyDNA}
                            onAnswer={handleInterviewAnswer}
                            onComplete={finalizeInterview}
                        />
                    </div>
                )}

                {/* Results Section */}
                {phase === 'COMPLETE' && report && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className={`p-6 rounded-[2rem] border ${report.status === 'PASS' ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className={`text-lg font-black uppercase tracking-tight ${report.status === 'PASS' ? 'text-emerald-700' : 'text-amber-700'}`}>
                                        Uselessness Diagnostic: {report.status}
                                    </h3>
                                    <p className="text-xs font-bold text-gray-500 mt-1 uppercase tracking-widest">Logic Fidelity Score: {report.score}</p>
                                </div>
                                <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] ${report.status === 'PASS' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                                    {report.status === 'PASS' ? 'Ares Certified' : 'Gap Found'}
                                </div>
                            </div>

                            <p className="text-sm text-gray-700 mb-4 leading-relaxed font-medium">
                                {report.recommendation}
                            </p>

                            {report.criticalFailures.length > 0 && (
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Critical Vulnerabilities</p>
                                    {report.criticalFailures.map((failure, i) => (
                                        <div key={i} className="bg-white/60 p-4 rounded-2xl border border-amber-200/50">
                                            <div className="flex items-center gap-2 text-amber-700 mb-1">
                                                <AlertCircle size={14} />
                                                <span className="text-[11px] font-black uppercase tracking-widest">{failure.test}</span>
                                            </div>
                                            <p className="text-xs text-gray-600 mb-2">{failure.result}</p>
                                            <div className="bg-indigo-50 p-2.5 rounded-xl border border-indigo-100 text-[11px] font-bold text-indigo-700">
                                                <span className="text-[9px] uppercase tracking-widest block mb-0.5 opacity-60">Architect's Fix</span>
                                                {failure.fix}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Detailed Manifest Trigger */}
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            className="w-full flex items-center justify-between p-4 rounded-2xl border border-gray-100 hover:bg-gray-50 transition-colors text-sm font-bold text-gray-600"
                        >
                            <div className="flex items-center gap-2">
                                <Search size={16} className="text-indigo-500" />
                                Review Deep DNA Manifest
                            </div>
                            {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {showDetails && manifest && (
                            <div className="space-y-4 p-6 bg-gray-50 rounded-[2rem] border border-gray-100 animate-in fade-in duration-300">
                                <div>
                                    <h4 className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em] mb-3">Ecosystem Layer</h4>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {manifest?.ecosystemLayer?.softwareSystems?.map((s, i) => (
                                            <span key={i} className="bg-white px-3 py-1.5 rounded-lg text-xs font-bold text-gray-900 border border-gray-200">{s}</span>
                                        ))}
                                    </div>
                                    <p className="text-[11px] text-gray-500 leading-relaxed font-medium">{manifest?.ecosystemLayer?.logicFlow}</p>
                                </div>

                                <div className="border-t border-gray-200 pt-4">
                                    <h4 className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em] mb-3">Linguistic Identity</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Tone</p>
                                            <p className="text-xs text-gray-900 font-bold">{manifest?.linguisticLayer?.brandTone}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">UVP Focus</p>
                                            <p className="text-xs text-gray-900 font-bold">{manifest?.linguisticLayer?.uvp}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-gray-200 pt-4">
                                    <h4 className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em] mb-3">Core First Principles</h4>
                                    <div className="space-y-2">
                                        {manifest?.firstPrinciples?.map((fp, i) => (
                                            <div key={i} className="flex gap-2 text-xs font-medium text-gray-700">
                                                <Zap className="text-amber-500 shrink-0" size={12} />
                                                {fp}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Final Deployment Report Overlay */}
            {phase === 'COMPLETE' && deploymentReport && (
                <div className="fixed inset-0 z-[100] bg-gray-900/40 backdrop-blur-xl flex items-center justify-center p-4 md:p-12 overflow-y-auto">
                    <AresDeploymentReport
                        report={deploymentReport}
                        agentName={agentName}
                        onClose={() => {
                            // The modal stays open until they click "Deploy" which triggers onComplete up the chain?
                            // In this case, we just keep it visible or add a button to close.
                        }}
                    />
                </div>
            )}
        </div>
    );
};
