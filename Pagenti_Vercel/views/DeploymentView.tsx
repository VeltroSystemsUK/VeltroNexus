import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Shield, Zap, Mail, Database, Share2, Globe, Server, Lock, AlertCircle, Rocket, MessageSquare, AppWindow, Key, Cloud, DollarSign, Github, Trello, Twitter, Plus, X } from 'lucide-react';
import { agentService } from '../services/agentService';
import { integrationService, IntegrationConfig, DeploymentStatus, IntegrationProvider } from '../services/integrationService';
import { DigitalAssociate } from '../types';

// Icon mapping helper
const getIcon = (iconName: string) => {
    switch (iconName) {
        case 'Mail': return Mail;
        case 'AppWindow': return AppWindow;
        case 'MessageSquare': return MessageSquare;
        case 'Database': return Database;
        case 'Cloud': return Cloud;
        case 'DollarSign': return DollarSign;
        case 'Github': return Github;
        case 'Trello': return Trello;
        case 'Server': return Server;
        case 'Linkedin': return Share2; // Lucide doesn't have detailed LinkedIn, using Share2 as fallback or custom if available
        case 'Twitter': return Twitter;
        default: return Globe;
    }
};

export const DeploymentView: React.FC = () => {
    const { agentId } = useParams<{ agentId: string }>();
    const navigate = useNavigate();

    const [agent, setAgent] = useState<DigitalAssociate | null>(null);
    const [providers, setProviders] = useState<IntegrationProvider[]>([]);
    const [integrations, setIntegrations] = useState<IntegrationConfig[]>([]);
    const [status, setStatus] = useState<DeploymentStatus | null>(null);
    const [isDeploying, setIsDeploying] = useState(false);

    // State for expanding rows to show credential inputs
    const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
    const [credentials, setCredentials] = useState({ username: '', password: '' });

    // State for Custom Provider Modal
    const [showCustomModal, setShowCustomModal] = useState(false);
    const [newProviderName, setNewProviderName] = useState('');
    const [newProviderCategory, setNewProviderCategory] = useState<IntegrationProvider['category']>('CRM');

    useEffect(() => {
        if (agentId) {
            const foundAgent = agentService.getAgents().find(a => a.id === agentId);
            if (foundAgent) {
                setAgent(foundAgent);
                refreshData(agentId);
            }
        }
    }, [agentId]);

    const refreshData = (id: string) => {
        setProviders(integrationService.getAllProviders());
        setIntegrations(integrationService.getIntegrations(id));
        setStatus(integrationService.getDeploymentStatus(id));
    };

    const handleConnectClick = (providerId: string) => {
        const existing = integrations.find(i => i.providerId === providerId);

        if (existing?.status === 'connected') {
            if (confirm('Disconnect this integration?')) {
                integrationService.toggleIntegration(agentId!, providerId);
                refreshData(agentId!);
            }
        } else {
            setExpandedProvider(expandedProvider === providerId ? null : providerId);
            setCredentials({ username: '', password: '' });
        }
    };

    const handleSaveCredentials = (providerId: string) => {
        if (!agentId) return;
        integrationService.toggleIntegration(agentId, providerId, credentials);
        refreshData(agentId);
        setExpandedProvider(null);
    };

    const handleDeploy = () => {
        if (!agentId) return;
        setIsDeploying(true);
        setTimeout(() => {
            integrationService.deployAgent(agentId);
            refreshData(agentId);
            setIsDeploying(false);
        }, 2000);
    };

    const handleAddCustom = () => {
        if (newProviderName) {
            integrationService.addCustomProvider(newProviderName, newProviderCategory);
            refreshData(agentId!);
            setShowCustomModal(false);
            setNewProviderName('');
        }
    };

    const getIntegration = (providerId: string) => integrations.find(i => i.providerId === providerId);

    // Group providers by category
    const categories: IntegrationProvider['category'][] = ['Communication', 'CRM', 'Development', 'Marketing'];

    if (!agent) return <div className="p-8 text-white">Loading...</div>;

    const isLive = status?.status === 'active';

    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-indigo-500/30 pb-24">
            {/* Header */}
            <div className="bg-slate-900/50 border-b border-white/5 backdrop-blur-sm sticky top-0 z-30">
                <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                            <ArrowLeft className="text-gray-400" />
                        </button>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-xl font-bold text-white">Deployment Console</h1>
                                <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                    V1.3 (Enterprise)
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-400 mt-0.5">
                                <Server size={12} />
                                <span>Managing: <strong className="text-white">{agent.name}</strong></span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${isLive ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
                            <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                            <span className="text-xs font-bold uppercase tracking-wide">{isLive ? 'Live in Production' : 'Draft Protocol'}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-8 space-y-12">

                {/* Security Setup */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Shield className="text-indigo-400" size={20} />
                        <h2 className="text-lg font-bold">Security & Permissions</h2>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-300">Encryption</span>
                                <Lock size={14} className="text-emerald-400" />
                            </div>
                            <div className="text-2xl font-bold text-white mb-1">AES-256</div>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-300">Auth Standard</span>
                                <Globe size={14} className="text-indigo-400" />
                            </div>
                            <div className="text-2xl font-bold text-white mb-1">OAuth 2.0</div>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-300">Audit Trail</span>
                                <AlertCircle size={14} className="text-amber-400" />
                            </div>
                            <div className="text-2xl font-bold text-white mb-1">Active</div>
                        </div>
                    </div>
                </section>

                {/* Integrations List grouped by Category */}
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <Zap className="text-amber-400" size={20} />
                            <h2 className="text-lg font-bold">Integration Ecosystem</h2>
                        </div>
                        <button
                            onClick={() => setShowCustomModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition-colors"
                        >
                            <Plus size={16} /> Add Custom Integration
                        </button>
                    </div>

                    <div className="space-y-8">
                        {categories.map(category => {
                            const categoryProviders = providers.filter(p => p.category === category);
                            if (categoryProviders.length === 0) return null;

                            return (
                                <div key={category} className="space-y-3">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 pl-2">{category} Stack</h3>
                                    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
                                        <div className="divide-y divide-white/5">
                                            {categoryProviders.map(p => {
                                                const integration = getIntegration(p.id);
                                                const isConnected = integration?.status === 'connected';
                                                const isExpanded = expandedProvider === p.id;
                                                const Icon = getIcon(p.iconName);

                                                return (
                                                    <div key={p.id} className="transition-colors hover:bg-white/[0.02]">
                                                        <div className="p-5 flex items-center justify-between gap-4">
                                                            {/* Left: Icon & Info */}
                                                            <div className="flex items-center gap-4 flex-1">
                                                                <div className={`p-3 rounded-xl ${p.bg} ${p.color}`}>
                                                                    <Icon size={20} />
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <h3 className="text-base font-bold text-white">{p.name}</h3>
                                                                        {p.isCustom && <span className="px-1.5 py-0.5 rounded text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 uppercase font-bold">Custom</span>}
                                                                    </div>
                                                                    <p className="text-xs text-gray-400">{p.description}</p>
                                                                </div>
                                                            </div>

                                                            {/* Status */}
                                                            <div className="hidden md:block">
                                                                {isConnected ? (
                                                                    <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold uppercase tracking-wide">
                                                                        <CheckCircle2 size={12} /> Connected
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-gray-600 text-xs font-bold uppercase tracking-wide">Disconnected</div>
                                                                )}
                                                            </div>

                                                            {/* Action */}
                                                            <div>
                                                                <button
                                                                    onClick={() => handleConnectClick(p.id)}
                                                                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${isConnected
                                                                            ? 'bg-transparent border-white/20 text-gray-300 hover:bg-red-500/10 hover:text-red-400'
                                                                            : 'bg-indigo-600 border-transparent text-white hover:bg-indigo-700'
                                                                        }`}
                                                                >
                                                                    {isConnected ? 'Disconnect' : 'Connect'}
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Credentials Form */}
                                                        {isExpanded && (
                                                            <div className="px-5 pb-6 pt-0 animate-in slide-in-from-top-2 duration-200">
                                                                <div className="bg-black/20 rounded-xl p-5 border border-white/5 ml-[60px]">
                                                                    <h4 className="text-sm font-bold text-indigo-300 mb-4 flex items-center gap-2">
                                                                        <Key size={14} /> Enter Credentials
                                                                    </h4>

                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                                        <div className="space-y-1">
                                                                            <label className="text-xs font-medium text-gray-400">Username / Email / API User</label>
                                                                            <input
                                                                                type="text"
                                                                                value={credentials.username}
                                                                                onChange={e => setCredentials({ ...credentials, username: e.target.value })}
                                                                                className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:border-indigo-500 outline-none transition-colors"
                                                                                placeholder="Access ID"
                                                                            />
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            <label className="text-xs font-medium text-gray-400">Password / API Key / Secret</label>
                                                                            <input
                                                                                type="password"
                                                                                value={credentials.password}
                                                                                onChange={e => setCredentials({ ...credentials, password: e.target.value })}
                                                                                className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:border-indigo-500 outline-none transition-colors"
                                                                                placeholder="Secret Key"
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex justify-end gap-3">
                                                                        <button
                                                                            onClick={() => setExpandedProvider(null)}
                                                                            className="px-4 py-2 rounded-lg text-xs font-bold text-gray-400 hover:text-white transition-colors"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleSaveCredentials(p.id)}
                                                                            disabled={!credentials.username || !credentials.password}
                                                                            className="px-6 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold uppercase hover:bg-emerald-500 transition-colors disabled:opacity-50"
                                                                        >
                                                                            Save & Connect
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer Action */}
                <section className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="text-gray-400 text-sm max-w-lg">
                        <p>Deploying <strong>{agent.name}</strong> will grant access to all "Connected" systems above.</p>
                    </div>

                    <button
                        onClick={handleDeploy}
                        disabled={isDeploying || isLive}
                        className={`group relative px-8 py-4 rounded-xl font-bold text-lg flex items-center gap-3 transition-all ${isLive
                                ? 'bg-emerald-900/50 text-emerald-400 cursor-default border border-emerald-500/30'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-500/20 hover:scale-105 active:scale-95'
                            }`}
                    >
                        {isDeploying ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Deploying...
                            </>
                        ) : isLive ? (
                            <>
                                <Rocket size={20} /> Agent Active
                            </>
                        ) : (
                            <>
                                <Rocket size={20} className="group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
                                GO LIVE
                            </>
                        )}
                    </button>
                </section>
            </div>

            {/* Custom Integration Modal */}
            {showCustomModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-white">Add Custom Integration</h3>
                            <button onClick={() => setShowCustomModal(false)} className="text-gray-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Integration Name</label>
                                <input
                                    type="text"
                                    value={newProviderName}
                                    onChange={e => setNewProviderName(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none"
                                    placeholder="e.g. Asana, Zoom, Oracle DB..."
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Category</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {categories.map(c => (
                                        <button
                                            key={c}
                                            onClick={() => setNewProviderCategory(c)}
                                            className={`px-3 py-2 rounded-lg text-xs font-bold text-left transition-colors ${newProviderCategory === c ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                                        >
                                            {c}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowCustomModal(false)}
                                    className="px-4 py-2 rounded-lg font-bold text-gray-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddCustom}
                                    disabled={!newProviderName}
                                    className="px-6 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-500 disabled:opacity-50"
                                >
                                    Add Integration
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
