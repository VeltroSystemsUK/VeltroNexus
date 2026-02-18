import React, { useState, useRef, useEffect } from 'react';
import { Send, Cpu, User, Loader2, FileText, CheckCircle2 } from 'lucide-react';
import { ChatMessage, chatWithAres } from '../../services/aresChatService';
import { AresProposal } from '../../types';

interface AresChatProps {
    onApproveProposal: (proposal: AresProposal) => void;
}

export const AresChat: React.FC<AresChatProps> = ({ onApproveProposal }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 'init',
            role: 'ares',
            content: "ARES Uplink established. I am online and listening. How can I assist with the infrastructure today?",
            timestamp: new Date().toISOString()
        }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        try {
            // Call ARES Service
            const response = await chatWithAres(messages, userMsg.content);

            const aresMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'ares',
                content: response.text,
                timestamp: new Date().toISOString(),
                proposal: response.proposal
            };

            setMessages(prev => [...prev, aresMsg]);
        } catch (e) {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'ares',
                content: "Signal lost. Please try again.",
                timestamp: new Date().toISOString()
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-[600px] bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
            {/* Header */}
            <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center gap-3">
                <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <Cpu className="text-white" size={20} />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950 animate-pulse"></div>
                </div>
                <div>
                    <h3 className="font-bold text-white text-sm">ARES ARCHITECT</h3>
                    <p className="text-xs text-indigo-300 font-mono tracking-wider">SECURE UPLINK // V2.4</p>
                </div>
            </div>

            {/* Chat Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-6 bg-gradient-to-b from-slate-900 to-slate-950"
            >
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${msg.role === 'ares' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-gray-700 text-gray-300'}`}>
                            {msg.role === 'ares' ? <Cpu size={14} /> : <User size={14} />}
                        </div>

                        {/* Bubble */}
                        <div className={`max-w-[70%] space-y-2`}>
                            <div className={`px-5 py-3.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${msg.role === 'ares'
                                ? 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                                : 'bg-indigo-600 text-white rounded-tr-none'
                                }`}>
                                {msg.content}
                            </div>

                            {/* Proposal Attachment */}
                            {msg.proposal && (
                                <div className="mt-2 bg-slate-800 rounded-xl border border-indigo-500/30 overflow-hidden shadow-lg animate-in fade-in slide-in-from-top-2">
                                    <div className="bg-indigo-950/30 p-3 border-b border-indigo-500/20 flex items-center gap-2">
                                        <FileText size={14} className="text-indigo-400" />
                                        <span className="text-xs font-bold text-indigo-200 uppercase tracking-wider">Proposal Generated</span>
                                    </div>
                                    <div className="p-4">
                                        <h4 className="font-bold text-white text-sm mb-1">{msg.proposal.title}</h4>
                                        <p className="text-xs text-slate-400 mb-4">{msg.proposal.description}</p>

                                        {msg.proposal.status === 'APPROVED' ? (
                                            <div className="w-full py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs font-bold flex items-center justify-center gap-2">
                                                <CheckCircle2 size={14} /> APPROVED
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    if (msg.proposal && msg.proposal.status !== 'APPROVED') {
                                                        onApproveProposal(msg.proposal);
                                                        // Update local state properly
                                                        setMessages(current => current.map(m =>
                                                            m.id === msg.id && m.proposal
                                                                ? { ...m, proposal: { ...m.proposal, status: 'APPROVED' } }
                                                                : m
                                                        ));
                                                    }
                                                }}
                                                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                                            >
                                                Review & Approve Action
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className={`text-[10px] opacity-40 px-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                ))}

                {isTyping && (
                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                            <Cpu size={14} />
                        </div>
                        <div className="px-5 py-4 rounded-2xl rounded-tl-none bg-slate-800 border border-slate-700 w-16 flex items-center justify-center">
                            <div className="flex gap-1">
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-75"></div>
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-150"></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-slate-950 border-t border-slate-800">
                <div className="relative flex items-center">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isTyping}
                        placeholder="Message ARES..."
                        className="w-full bg-slate-900 text-white placeholder-slate-500 border border-slate-800 rounded-xl pl-4 pr-12 py-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isTyping}
                        className="absolute right-2 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg transition-colors"
                    >
                        <Send size={16} strokeWidth={2.5} />
                    </button>
                </div>
                <div className="text-center mt-2">
                    <span className="text-[9px] text-slate-600 font-mono tracking-widest uppercase">
                        ARES Neural Core v2.4 • Authorized Personnel Only
                    </span>
                </div>
            </div>
        </div>
    );
};
