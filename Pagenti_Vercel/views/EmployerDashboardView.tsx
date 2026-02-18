import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../I18nContext';
import { enquiryService, Enquiry } from '../services/enquiryService';
import { agentService } from '../services/agentService';
import { DigitalAssociate } from '../types';
import { Users, Activity, Clock, ShieldCheck, Zap, Briefcase, FileText, ArrowUpRight, Pencil, Save, X, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

import { LiveTerminal } from '../components/LiveTerminal';
import { VoiceIdentityGuard } from '../components/VoiceIdentityGuard';

// Premium ElevenLabs voice options removed - now using custom IDs.

export const EmployerDashboardView: React.FC = () => {
    const { user } = useAuth();
    const { t } = useI18n();
    const [agents, setAgents] = useState<DigitalAssociate[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<DigitalAssociate | null>(null);
    const [editingAgent, setEditingAgent] = useState<DigitalAssociate | null>(null);
    const [editForm, setEditForm] = useState<{
        name?: string;
        role?: string;
        department?: string;
        voiceEnabled?: boolean;
        voiceId?: string;
    }>({});

    useEffect(() => {
        const fetchAgents = async () => {
            const data = await agentService.getAllAgents();
            setAgents(data);
        };
        fetchAgents();
    }, []);

    const handleEditClick = (agent: DigitalAssociate, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingAgent(agent);
        setEditForm({
            name: agent.name,
            role: agent.role.en,
            department: agent.department,
            voiceEnabled: agent.voiceEnabled || false,
            voiceId: agent.voiceId
        });
    };

    const handleSaveAgent = () => {
        if (!editingAgent) return;

        const updatedAgent: DigitalAssociate = {
            ...editingAgent,
            name: editForm.name || editingAgent.name,
            department: editForm.department || editingAgent.department,
            role: {
                ...editingAgent.role,
                en: editForm.role || editingAgent.role.en
            },
            voiceEnabled: editForm.voiceEnabled ?? editingAgent.voiceEnabled,
            voiceId: editForm.voiceId || editingAgent.voiceId
        };

        agentService.saveAgent(updatedAgent);

        // Refresh list
        setAgents(agentService.getAgents());
        setEditingAgent(null);
    };

    // State for Dynamic Pricing Simulation
    const [contractHours, setContractHours] = useState(720);

    // Dynamic Rate Multiplier (Inverse Volume Discount)
    const rateMultiplier = useMemo(() => {
        if (contractHours < 40) return 10.0;
        if (contractHours <= 80) return 8.0;
        if (contractHours <= 160) return 6.0;
        if (contractHours <= 240) return 5.0;
        if (contractHours <= 360) return 4.0;
        if (contractHours <= 480) return 3.0;
        if (contractHours <= 620) return 2.0;
        if (contractHours < 720) return 1.5;
        return 1.0; // Base rate at 24/7 capacity (720h)
    }, [contractHours]);

    const activeAgents = agents.length;

    // Financial Calculations
    const baseHourlyTotal = agents.reduce((sum, agent) => sum + (agent.hourlyRate || 0), 0);
    const effectiveHourlyTotal = baseHourlyTotal * rateMultiplier;
    const totalMonthlyCost = effectiveHourlyTotal * contractHours;

    // Benchmark: Traditional human role cost (e.g., $8,500/mo fixed salary regardless of 120-160h output)
    const fteCount = contractHours / 160;
    const humanBenchmarkMonthly = activeAgents * (Math.max(1, fteCount) * 8500);
    const estimatedSavings = activeAgents > 0 ? (humanBenchmarkMonthly - totalMonthlyCost) : 0;

    const efficiency = 98.5;

    return (
        <div className="min-h-screen bg-slate-50 relative">
            {/* Simple Header for Client */}
            <div className="bg-white border-b border-gray-200 sticky top-20 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Client Portal</h1>
                            <p className="text-sm text-gray-500">Welcome back, {user?.name}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></div>
                                System Operational
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                <Users size={20} />
                            </div>
                            <span className="text-xs font-bold text-gray-400 uppercase">Active Agents</span>
                        </div>
                        <div className="text-3xl font-bold text-gray-900 mb-1">{activeAgents}</div>
                        <div className="text-xs text-green-600 font-medium flex items-center gap-1">
                            <ArrowUpRight size={12} /> Live Deployed
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                                <Clock size={20} />
                            </div>
                            <span className="text-xs font-bold text-gray-400 uppercase">Uptime (This Month)</span>
                        </div>
                        <div className="text-3xl font-bold text-gray-900 mb-1">99.9%</div>
                        <div className="text-xs text-gray-500 font-medium">
                            Zero downtime recorded
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                                <Zap size={20} />
                            </div>
                            <span className="text-xs font-bold text-gray-400 uppercase">Efficiency Rate</span>
                        </div>
                        <div className="text-3xl font-bold text-gray-900 mb-1">{efficiency}%</div>
                        <div className="text-xs text-green-600 font-medium flex items-center gap-1">
                            <ArrowUpRight size={12} /> +2.4% vs Human Benchmark
                        </div>
                    </div>

                    {/* Financial Controller Section */}
                    <div className="col-span-1 md:col-span-3 bg-white p-8 rounded-2xl shadow-sm border border-gray-100 mb-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <FileText size={18} className="text-gray-400" /> Financial Impact Simulator
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">Adjust monthly hours to see dynamic rate scaling (lower volume = higher rate premium).</p>
                            </div>
                            <div className="w-full md:w-1/3">
                                <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                                    <span>10h</span>
                                    <span>Current: {contractHours}h/mo</span>
                                    <span>720h (24/7)</span>
                                </div>
                                <input
                                    type="range"
                                    min="10"
                                    max="720"
                                    step="10"
                                    value={contractHours}
                                    onChange={(e) => setContractHours(Number(e.target.value))}
                                    className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                />
                                <div className="text-right mt-1 text-xs font-medium text-indigo-600">
                                    {rateMultiplier > 1.0 ? ('+' + Math.round((rateMultiplier - 1) * 100) + '% Low Volume Premium') : 'Standard Volume Rate'}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                                <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">Est. Monthly Cost</div>
                                <div className="text-2xl font-bold text-gray-900">${totalMonthlyCost.toLocaleString()}</div>
                                <div className="text-xs text-gray-500 mt-1">
                                    @ {contractHours}h / month
                                </div>
                            </div>

                            <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-100">
                                <div className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">Effective Hourly Rate</div>
                                <div className="text-2xl font-bold text-gray-900">${(effectiveHourlyTotal / (activeAgents || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })} / hr</div>
                                <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                    Avg per agent {rateMultiplier > 1.0 && <span className="text-amber-600 font-bold">({rateMultiplier}x multiplier)</span>}
                                </div>
                            </div>

                            <div className="p-4 bg-green-50/50 rounded-xl border border-green-100">
                                <div className="text-xs font-bold text-green-600 uppercase tracking-wider mb-2">Projected Annual Savings</div>
                                <div className={'text-2xl font-bold ' + (estimatedSavings >= 0 ? 'text-gray-900' : 'text-red-600')}>
                                    ${(estimatedSavings * 12).toLocaleString()}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    vs. $102k/yr Traditional Hire
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Agents List */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-8 border-b border-gray-100 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Briefcase size={18} className="text-gray-400" /> My Digital Workforce
                        </h2>
                        <Link to="/custom-build" className="text-sm font-bold text-indigo-600 hover:text-indigo-700">
                            + Request Expansion
                        </Link>
                    </div>

                    {agents.length > 0 ? (
                        <div className="divide-y divide-gray-100">
                            {agents.map(agent => (
                                <div
                                    key={agent.id}
                                    onClick={() => setSelectedAgent(agent)}
                                    className="p-6 hover:bg-gray-50 transition-colors flex items-center justify-between group cursor-pointer"
                                >
                                    <div className="flex items-center gap-4">
                                        <img src={agent.avatar} alt={agent.name} className="w-12 h-12 rounded-full object-cover shadow-sm" />
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{agent.name}</h3>
                                            <p className="text-xs text-gray-500 font-medium">{typeof agent.role === 'string' ? agent.role : agent.role.en}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-8">
                                        <div className="text-right">
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Status</div>
                                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-bold uppercase tracking-wide border border-green-200">
                                                Active
                                            </span>
                                        </div>
                                        <div className="text-right hidden sm:block">
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Tasks</div>
                                            <div className="text-sm font-bold text-gray-900">Running</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Actions</div>
                                            <div className="flex items-center gap-2 justify-end">
                                                <button
                                                    onClick={(e) => handleEditClick(agent, e)}
                                                    className="text-gray-400 hover:text-indigo-600 p-2 rounded-full hover:bg-gray-100 transition-colors"
                                                    title="Edit Configuration"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedAgent(agent);
                                                    }}
                                                    className="text-indigo-600 font-bold text-xs hover:text-indigo-500 flex items-center gap-1 pl-2 border-l border-gray-200"
                                                >
                                                    <MessageSquare size={14} /> Open Uplink
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-12 text-center">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                                <Users size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">No Active Agents</h3>
                            <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
                                You haven't hired any digital associates yet. Start your talent audit to build your workforce.
                            </p>
                            <Link to="/audit" className="bg-indigo-600 text-white px-6 py-3 rounded-full font-bold text-sm hover:bg-indigo-700 transition-colors">
                                Start Hiring Process
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            {/* Chat Modal Overlay */}
            {selectedAgent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                    <div
                        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
                        onClick={() => setSelectedAgent(null)}
                    ></div>
                    <div className="relative w-full max-w-4xl h-[80vh] bg-black rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Close Button */}
                        <button
                            onClick={() => setSelectedAgent(null)}
                            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                        >
                            <X size={18} />
                        </button>

                        <div className="flex-1 h-full">
                            <LiveTerminal candidate={selectedAgent} colorClass="bg-black" />
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Agent Modal */}
            {editingAgent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                    <div
                        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
                        onClick={() => setEditingAgent(null)}
                    ></div>
                    <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-indigo-50/50">
                            <h3 className="font-bold text-lg text-gray-900">Edit Agent Protocol</h3>
                            <button
                                onClick={() => setEditingAgent(null)}
                                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Designation (Name)</label>
                                <input
                                    type="text"
                                    value={editForm.name || ''}
                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all font-medium text-gray-900"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Role Function</label>
                                <input
                                    type="text"
                                    value={editForm.role as string || ''}
                                    onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all font-medium text-gray-900"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Department</label>
                                    <select
                                        value={editForm.department || ''}
                                        onChange={e => setEditForm({ ...editForm, department: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all font-medium text-gray-900"
                                    >
                                        <option value="Legal">Legal</option>
                                        <option value="Sales">Sales</option>
                                        <option value="Engineering">Engineering</option>
                                        <option value="Finance">Finance</option>
                                        <option value="HR">HR</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex justify-between">
                                        Voice Identity
                                        <a href="https://elevenlabs.io/app/voice-library" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline lowercase font-normal italic">Library</a>
                                    </label>
                                    <VoiceIdentityGuard
                                        value={editForm.voiceId || ''}
                                        onChange={(id) => setEditForm({ ...editForm, voiceId: id })}
                                        placeholder="Paste ElevenLabs Voice ID"
                                        className="mb-4"
                                    />
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Communication</label>
                                    <div
                                        onClick={() => setEditForm({ ...editForm, voiceEnabled: !editForm.voiceEnabled })}
                                        className={`w-full px-3 py-3 border rounded-xl flex items-center justify-between cursor-pointer transition-all ${editForm.voiceEnabled ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200'}`}
                                    >
                                        <span className={`text-sm font-bold ${editForm.voiceEnabled ? 'text-indigo-700' : 'text-gray-500'}`}>Voice Intelligence</span>
                                        <div className={`w-10 h-6 rounded-full p-1 transition-colors ${editForm.voiceEnabled ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${editForm.voiceEnabled ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    onClick={() => setEditingAgent(null)}
                                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveAgent}
                                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-200 transition-all flex items-center gap-2"
                                >
                                    <Save size={16} /> Save Changes
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
};
