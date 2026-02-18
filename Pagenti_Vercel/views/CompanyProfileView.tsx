import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Building2, Target, MessageSquare, Package, Globe, FileText } from 'lucide-react';
import { saveCompanyProfile, getCompanyProfile, CompanyProfile } from '../services/companyService';

export const CompanyProfileView: React.FC = () => {
    const navigate = useNavigate();
    const [profile, setProfile] = useState<CompanyProfile>({
        name: '',
        industry: '',
        products: '',
        targetAudience: '',
        tone: 'Professional, Confident, and Forward-Thinking',
        website: '',
        knowledgeBase: ''
    });
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        try {
            const existing = getCompanyProfile();
            if (existing) {
                // Merge with defaults to ensure new fields (website, knowledgeBase) are present
                setProfile(prev => ({ ...prev, ...existing }));
            }
        } catch (err) {
            console.error("Error loading profile", err);
        }
    }, []);

    const handleSave = () => {
        saveCompanyProfile(profile);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-8 font-sans">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="text-gray-400" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                            Company Knowledge Base
                        </h1>
                        <p className="text-gray-400 mt-1">Train your agents on your business DNA.</p>
                    </div>
                </div>

                {/* Form */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6 shadow-2xl backdrop-blur-sm">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                                <Building2 size={16} className="text-indigo-400" /> Company Name
                            </label>
                            <input
                                type="text"
                                value={profile.name}
                                onChange={e => setProfile({ ...profile, name: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="e.g. Acme Corp"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                                <Building2 size={16} className="text-indigo-400" /> Industry / Sector
                            </label>
                            <input
                                type="text"
                                value={profile.industry}
                                onChange={e => setProfile({ ...profile, industry: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="e.g. FinTech / SaaS"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                            <Globe size={16} className="text-blue-400" /> Website URL
                        </label>
                        <input
                            type="text"
                            value={profile.website || ''}
                            onChange={e => setProfile({ ...profile, website: e.target.value })}
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                            placeholder="https://example.com"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                            <Package size={16} className="text-emerald-400" /> Core Products & Services
                        </label>
                        <textarea
                            value={profile.products}
                            onChange={e => setProfile({ ...profile, products: e.target.value })}
                            rows={4}
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all resize-none"
                            placeholder="Describe what you sell. e.g. We provide AI-driven recruitment tools for enterprise HR teams..."
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                            <Target size={16} className="text-rose-400" /> Target Audience
                        </label>
                        <textarea
                            value={profile.targetAudience}
                            onChange={e => setProfile({ ...profile, targetAudience: e.target.value })}
                            rows={3}
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all resize-none"
                            placeholder="Who are your ideal customers? e.g. CTOs at Series B startups..."
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                            <FileText size={16} className="text-purple-400" /> Brochure / Knowledge Base
                        </label>
                        <p className="text-xs text-gray-500 italic">Paste text from brochures, whitepapers, or websites to train the agent on specifics.</p>
                        <textarea
                            value={profile.knowledgeBase || ''}
                            onChange={e => setProfile({ ...profile, knowledgeBase: e.target.value })}
                            rows={8}
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all resize-none font-mono text-xs leading-relaxed"
                            placeholder="Paste your brochure text, company values, distinct methodology, or key project details here..."
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                            <MessageSquare size={16} className="text-amber-400" /> Brand Tone
                        </label>
                        <input
                            type="text"
                            value={profile.tone}
                            onChange={e => setProfile({ ...profile, tone: e.target.value })}
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                            placeholder="e.g. Professional, Witty, authoritative..."
                        />
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button
                            onClick={handleSave}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${saved
                                ? 'bg-green-500 text-white shadow-lg shadow-green-500/20'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95'
                                }`}
                        >
                            <Save size={18} />
                            {saved ? 'Saved!' : 'Save Knowledge Base'}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};
