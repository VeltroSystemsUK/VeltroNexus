import React, { useState, useEffect } from 'react';
import {
    AlertCircle,
    ShieldAlert,
    Zap,
    XOctagon,
    CheckCircle2,
    History,
    Map as MapIcon,
    ArrowUpRight,
    TrendingUp,
    Clock,
    UserCheck,
    RefreshCw
} from 'lucide-react';
import { aresService } from '../../services/aresService';
import { AresMissionDeviation } from '../../types';

export const AresCommandCenter: React.FC = () => {
    const [deviations, setDeviations] = useState<AresMissionDeviation[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDeviations = async () => {
            const data = await aresService.getMissionDeviations();
            setDeviations(data);
            setIsLoading(false);
        };
        fetchDeviations();
    }, []);

    const handleAction = async (id: string, action: 'IGNORE' | 'RETRAIN' | 'SUSPEND') => {
        await aresService.resolveDeviation(id, action);
        setDeviations(prev => prev.filter(d => d.id !== id));
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Value-Loop Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                            <TrendingUp size={20} />
                        </div>
                        <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Revenue Saved</h4>
                    </div>
                    <div className="text-3xl font-black text-gray-900">£12,450</div>
                    <div className="text-xs text-emerald-600 font-bold mt-1">+12% from last week</div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <Clock size={20} />
                        </div>
                        <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Human Time Reclaimed</h4>
                    </div>
                    <div className="text-3xl font-black text-gray-900">142.5 hrs</div>
                    <div className="text-xs text-blue-600 font-bold mt-1">Equivalent to 4.2 FTEs</div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            <UserCheck size={20} />
                        </div>
                        <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Active Deployments</h4>
                    </div>
                    <div className="text-3xl font-black text-gray-900">24</div>
                    <div className="text-xs text-indigo-600 font-bold mt-1">98% Certification Integrity</div>
                </div>
            </div>

            {/* Mission Deviation Feed */}
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden">
                <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <ShieldAlert className="text-red-500" size={24} />
                            <div className="absolute inset-0 bg-red-400 rounded-full animate-ping opacity-25"></div>
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-gray-900">ARES Mission Deviation Feed</h3>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Shadow Audit Intelligence</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-red-100 text-red-600 text-[10px] font-black rounded-full uppercase tracking-widest animate-pulse">
                            {deviations.length} Critical Drift Detected
                        </span>
                    </div>
                </div>

                <div className="divide-y divide-gray-100">
                    {deviations.length === 0 ? (
                        <div className="p-20 text-center">
                            <CheckCircle2 className="text-emerald-500 mx-auto mb-4" size={48} />
                            <p className="text-gray-500 font-bold">All Digital Associates are operating within certified DNA parameters.</p>
                        </div>
                    ) : (
                        deviations.map(dev => (
                            <div key={dev.id} className="p-8 hover:bg-red-50/30 transition-colors">
                                <div className="flex flex-col lg:flex-row gap-8">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className="px-3 py-1 bg-red-600 text-white text-[9px] font-black rounded-full uppercase tracking-widest">
                                                {dev.category.replace('_', ' ')}
                                            </span>
                                            <span className="text-xs text-gray-400 font-mono">{new Date(dev.timestamp).toLocaleString()}</span>
                                        </div>
                                        <h4 className="text-lg font-bold text-gray-900 mb-2">
                                            Agent: <span className="text-indigo-600">{dev.agentId}</span> | Client ID: CU-9442
                                        </h4>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                            <div className="p-4 bg-gray-900 rounded-2xl">
                                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2">Input</p>
                                                <p className="text-xs text-gray-300 font-mono">"{dev.evidence.input}"</p>
                                            </div>
                                            <div className="p-4 bg-indigo-900/10 rounded-2xl border border-indigo-100">
                                                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2">Agent Output</p>
                                                <p className="text-xs text-gray-700 font-mono">"{dev.evidence.output}"</p>
                                            </div>
                                        </div>

                                        <div className="mt-4 p-4 bg-red-50 rounded-2xl border border-red-100 flex gap-3">
                                            <AlertCircle size={18} className="text-red-500 shrink-0" />
                                            <div>
                                                <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Ares Assessment</p>
                                                <p className="text-sm text-red-900 font-medium">FAIL. {dev.assessment}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Safety Switch Component */}
                                    <div className="lg:w-64 space-y-3">
                                        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-center">
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">Safety Switch Control</p>
                                            <div className="grid grid-cols-1 gap-2">
                                                <button
                                                    onClick={() => handleAction(dev.id, 'IGNORE')}
                                                    className="w-full py-2 bg-white hover:bg-gray-100 text-gray-600 text-[10px] font-black rounded-xl border border-gray-200 uppercase tracking-widest transition-all"
                                                >
                                                    Ignore drift
                                                </button>
                                                <button
                                                    onClick={() => handleAction(dev.id, 'RETRAIN')}
                                                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black rounded-xl uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2"
                                                >
                                                    <RefreshCw size={12} />
                                                    Re-Train
                                                </button>
                                                <button
                                                    onClick={() => handleAction(dev.id, 'SUSPEND')}
                                                    className="w-full py-2 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black rounded-xl uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2"
                                                >
                                                    <XOctagon size={12} />
                                                    Suspend
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-[9px] font-bold text-gray-400 uppercase tracking-widest px-2">
                                            <Clock size={10} />
                                            Passive Intervention Active
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Strategic Map View (Mock) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-lg border border-gray-100 relative overflow-hidden h-[400px]">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <MapIcon className="text-indigo-600" size={20} />
                            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Deployment Topology</h3>
                        </div>
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Live Sync</span>
                    </div>
                    {/* Mock Map Background */}
                    <div className="absolute inset-0 bg-slate-50 opacity-10 pointer-events-none"></div>
                    <div className="relative h-full flex items-center justify-center">
                        <div className="w-full h-full bg-[url('https://maps.googleapis.com/maps/api/staticmap?center=40,-90&zoom=3&size=600x400&style=feature:all|element:labels|visibility:off&style=feature:all|element:geometry|color:0x242f3e&style=feature:water|element:geometry|color:0x17263c')] bg-cover rounded-3xl opacity-20 filter grayscale invert"></div>

                        {/* Deviations on Map */}
                        <div className="absolute top-[40%] left-[30%]">
                            <div className="relative">
                                <div className="w-3 h-3 bg-red-500 rounded-full shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-pulse"></div>
                                <div className="absolute top-4 left-4 whitespace-nowrap bg-gray-900 text-white text-[8px] font-bold px-2 py-1 rounded-md shadow-xl border border-red-500/50">
                                    CU-9442: Logic Drift
                                </div>
                            </div>
                        </div>
                        <div className="absolute top-[55%] left-[60%]">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                        </div>
                        <div className="absolute top-[30%] left-[80%]">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-lg border border-gray-100 flex items-center justify-between group cursor-pointer hover:border-indigo-200 transition-all">
                        <div>
                            <h4 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Inertia Alert</h4>
                            <p className="text-lg font-bold text-gray-900 underline decoration-indigo-500 decoration-2 underline-offset-4">5 Customer accounts have dropped below utilization threshold.</p>
                        </div>
                        <ArrowUpRight size={24} className="text-indigo-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </div>

                    <div className="bg-gradient-to-br from-indigo-900 to-violet-900 p-8 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                            <Zap size={120} />
                        </div>
                        <div className="relative">
                            <h4 className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] mb-4">Value-Loop Spotlight</h4>
                            <p className="text-xl font-bold mb-6">"Agent Maya has proactively identified £18,000 in pipe value across 4 idle HubSpot leads this morning."</p>
                            <div className="flex gap-4">
                                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10">
                                    <p className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-1">Impact</p>
                                    <p className="text-sm font-bold">12% Task Lift</p>
                                </div>
                                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10">
                                    <p className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-1">Action</p>
                                    <p className="text-sm font-bold">Nudge Sent</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
