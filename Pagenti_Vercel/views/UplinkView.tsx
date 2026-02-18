import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { agentService } from '../services/agentService';
import { LiveTerminal } from '../components/LiveTerminal';
import { ShieldCheck, Cpu } from 'lucide-react';

export const UplinkView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const candidate = useMemo(() => id ? agentService.getAgentById(id) : undefined, [id]);

    if (!candidate) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-900 text-white p-8 text-center">
                <ShieldCheck size={40} className="text-red-500 mb-4" />
                <h1 className="text-xl font-bold mb-2">Unauthorized Uplink</h1>
                <p className="text-gray-400">The requested agent proxy does not exist or access has been revoked.</p>
            </div>
        );
    }

    return (
        <div className="h-screen w-full bg-black flex flex-col overflow-hidden">
            {/* Minimal Header for standalone view */}
            <div className="px-6 py-3 bg-gray-900 border-b border-gray-800 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                    <Cpu size={16} className="text-indigo-400" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Pagenti Secure Uplink // Port 443</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Active Link</span>
                </div>
            </div>

            <div className="flex-1 min-h-0">
                <LiveTerminal
                    candidate={candidate}
                    colorClass="bg-black"
                    hidePopOut={true}
                />
            </div>
        </div>
    );
};
