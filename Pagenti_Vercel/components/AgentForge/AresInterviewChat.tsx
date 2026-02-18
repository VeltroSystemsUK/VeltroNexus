import React, { useState, useEffect, useRef } from 'react';
import {
    Cpu,
    CheckCircle2,
    Zap,
    ArrowRight,
    Loader2,
    ShieldCheck,
    MessageSquare
} from 'lucide-react';
import { AresInterviewState, AresInterviewQuestion, AresTrainingManifest } from '../../types';

interface AresInterviewChatProps {
    agentName: string;
    agentRole: string;
    interviewState: AresInterviewState;
    manifest: AresTrainingManifest;
    companyDNA: any;
    onAnswer: (questionId: string, answer: string) => void;
    onComplete: () => void;
}

export const AresInterviewChat: React.FC<AresInterviewChatProps> = ({
    agentName,
    agentRole,
    interviewState,
    manifest,
    companyDNA,
    onAnswer,
    onComplete
}) => {
    const [isAgentThinking, setIsAgentThinking] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const currentQuestion = interviewState.questions[interviewState.currentQuestionIndex];
    const isLastQuestion = interviewState.currentQuestionIndex === interviewState.questions.length - 1 && currentQuestion?.status === 'answered';

    // Auto-scroll to bottom when new messages appear
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [interviewState.currentQuestionIndex, currentQuestion?.status]);

    // Automatically trigger agent response when a new question appears
    useEffect(() => {
        const autoRespond = async () => {
            if (currentQuestion && currentQuestion.status === 'pending' && !isAgentThinking) {
                setIsAgentThinking(true);

                // Add a delay to show the agent is "thinking"
                await new Promise(r => setTimeout(r, 2000));

                try {
                    // DEPRECATED: Interview mode no longer used - Ares patches autonomously
                    const agentAnswer = "This interview component is deprecated. Ares now patches knowledge gaps autonomously.";

                    // Another small delay before submitting answer
                    await new Promise(r => setTimeout(r, 1500));

                    onAnswer(currentQuestion.id, agentAnswer);
                } catch (error) {
                    console.error("Agent auto-response failed:", error);
                    onAnswer(currentQuestion.id, "I need more time to process my training data for this question.");
                } finally {
                    setIsAgentThinking(false);
                }
            }
        };

        autoRespond();
    }, [currentQuestion?.id, currentQuestion?.status]);

    const getStrengthColor = (strength: number) => {
        if (strength < 40) return 'bg-red-500';
        if (strength < 80) return 'bg-amber-500';
        return 'bg-emerald-500';
    };

    const getStrengthLabel = (strength: number) => {
        if (strength < 40) return 'Useless';
        if (strength < 80) return 'Functional';
        return 'Ares Certified';
    };

    return (
        <div className="flex flex-col h-[500px] bg-gray-950 rounded-[2rem] border border-gray-800 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-500">
            {/* Header / DNA Meter */}
            <div className="bg-gray-900 p-6 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-600 p-2 rounded-xl">
                        <ShieldCheck size={18} className="text-white" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-tight">DNA Strength Meter</h3>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none mt-1">
                            Current Status: <span className={interviewState.dnaStrength >= 80 ? 'text-emerald-400' : interviewState.dnaStrength >= 40 ? 'text-amber-400' : 'text-red-400'}>
                                {getStrengthLabel(interviewState.dnaStrength)}
                            </span>
                        </p>
                    </div>
                </div>
                <div className="w-32">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{interviewState.dnaStrength}%</span>
                    </div>
                    <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-1000 ${getStrengthColor(interviewState.dnaStrength)}`}
                            style={{ width: `${interviewState.dnaStrength}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-grow overflow-y-auto p-6 space-y-6 scrollbar-hide">
                {interviewState.questions.map((q, idx) => {
                    if (idx > interviewState.currentQuestionIndex) return null;

                    return (
                        <div key={q.id} className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                            {/* Ares Question */}
                            <div className="flex items-start gap-3 max-w-[85%]">
                                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0 border border-indigo-400/30">
                                    <Cpu size={14} className="text-white" />
                                </div>
                                <div className="bg-indigo-900/30 border border-indigo-500/20 p-4 rounded-2xl rounded-tl-none">
                                    <p className="text-xs text-indigo-100 leading-relaxed font-medium">
                                        {q.prompt}
                                    </p>
                                </div>
                            </div>

                            {/* Agent Answer */}
                            {q.status === 'answered' && (
                                <div className="flex items-start gap-3 max-w-[85%] ml-auto flex-row-reverse">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0 border border-emerald-400/30">
                                        <MessageSquare size={14} className="text-white" />
                                    </div>
                                    <div className="bg-emerald-900/20 border border-emerald-500/20 p-4 rounded-2xl rounded-tr-none">
                                        <p className="text-xs text-emerald-100 leading-relaxed font-medium">
                                            {q.answer}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
                <div ref={chatEndRef} />
            </div>

            {/* Status Area - Shows Automated Interview Progress */}
            <div className="p-6 bg-gray-900/50 border-t border-gray-800">
                {interviewState.status !== 'completed' ? (
                    <div className="flex items-center justify-center gap-4 py-4">
                        {isAgentThinking ? (
                            <>
                                <Loader2 size={20} className="text-indigo-400 animate-spin" />
                                <div className="text-center">
                                    <p className="text-sm font-bold text-indigo-300">{agentName} is formulating a response...</p>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Analyzing training data</p>
                                </div>
                            </>
                        ) : currentQuestion?.status === 'answered' ? (
                            <>
                                <CheckCircle2 size={20} className="text-emerald-400" />
                                <div className="text-center">
                                    <p className="text-sm font-bold text-emerald-300">Response recorded</p>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Awaiting next question</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <MessageSquare size={20} className="text-gray-400 animate-pulse" />
                                <div className="text-center">
                                    <p className="text-sm font-bold text-gray-300">Automated Interview in Progress</p>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Ares ↔ {agentName}</p>
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <button
                        onClick={onComplete}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg animate-in fade-in"
                    >
                        <Zap size={16} /> Finalize Logic Synthesis
                        <ArrowRight size={16} />
                    </button>
                )}
            </div>
        </div>
    );
};
