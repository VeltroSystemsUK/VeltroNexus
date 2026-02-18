import React from 'react';
import { Sparkles, Mic, Globe, Search, Database } from 'lucide-react';
import { VoiceIdentityGuard } from '../VoiceIdentityGuard';

import { CommunicationConfig } from '../../types';

export interface AgentFormData {
    name: string;
    goal: string;
    department: string;
    voiceId: string;
    rate: number;
    avatar?: string;
    communicationConfig?: CommunicationConfig;
    voiceEnabled: boolean;
    companyUrl?: string;
    companyContext?: string;
}

interface StepConfigureProps {
    formData: AgentFormData;
    onChange: (data: Partial<AgentFormData>) => void;
    selectedTemplateName?: string;
    architectMode?: boolean;
    onResearch?: (url: string) => Promise<void>;
}

export const StepConfigure: React.FC<StepConfigureProps> = ({
    formData,
    onChange,
    selectedTemplateName,
    architectMode,
    onResearch
}) => {
    const [isResearching, setIsResearching] = React.useState(false);
    const [localAvatars, setLocalAvatars] = React.useState<string[]>([]);
    const [avatarTab, setAvatarTab] = React.useState<'library' | 'upload' | 'generate'>('library');

    React.useEffect(() => {
        fetch('/avatars/manifest.json')
            .then(res => res.json())
            .then(data => setLocalAvatars(data))
            .catch(err => console.error('Failed to load avatar manifest:', err));
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        onChange({
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
        });
    };

    const handleToggle = (field: keyof AgentFormData) => {
        onChange({ [field]: !formData[field] });
    };

    const isVoiceEnabled = formData.voiceEnabled !== false; // Default to true if undefined

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                onChange({ avatar: reader.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    const generateAIAvatar = () => {
        const avatars = [
            'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400',
            'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=400',
            'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=400',
            'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=400',
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400',
            'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=400',
            'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=400',
            'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=400'
        ];
        const randomAvatar = avatars[Math.floor(Math.random() * avatars.length)];
        onChange({ avatar: randomAvatar });
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Configure your agent</h2>
                <p className="text-gray-500">
                    {architectMode
                        ? 'Review and refine the blueprint synthesized by Ares'
                        : selectedTemplateName
                            ? `Customize your ${selectedTemplateName} settings`
                            : 'Fine-tune the details to match your needs'}
                </p>
            </div>

            {architectMode && (
                <div className="bg-black rounded-[2rem] p-8 border border-[#00FF41]/20 shadow-[0_0_30px_rgba(0,255,65,0.05)] mb-8 animate-slide-up">
                    <div className="flex items-center gap-3 mb-4">
                        <Sparkles size={20} className="text-[#00FF41]" />
                        <h3 className="text-sm font-black text-white uppercase tracking-widest">Ares Architectural Note</h3>
                    </div>
                    <p className="text-[#00FF41]/80 text-xs font-mono mb-6 leading-relaxed bg-[#00FF41]/5 p-4 rounded-xl border border-[#00FF41]/10">
                        [SYSTEM]: I have synthesized this identity based on the client brief. The logic loops are optimized for high-velocity output. Please verify the "Core Logic" matches the required KPIs.
                    </p>

                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#00FF41]/40 ml-1">Command Ares: Request Modification</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Tell Ares what to change (e.g. 'Make the tone more aggressive')"
                                className="flex-1 bg-[#00FF41]/5 border border-[#00FF41]/20 rounded-xl px-4 py-3 text-xs text-white placeholder:text-[#00FF41]/20 focus:outline-none focus:ring-1 focus:ring-[#00FF41]/40"
                            />
                            <button className="bg-[#00FF41] text-black px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all">
                                Send
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-8 bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Avatar
                    </label>
                    <div className="flex gap-4 items-start">
                        <div className="w-24 h-24 rounded-2xl bg-gray-100 overflow-hidden border-2 border-dashed border-gray-300 flex items-center justify-center shrink-0 shadow-sm relative group">
                            {formData.avatar ? (
                                <>
                                    <img src={formData.avatar} alt="Avatar" className="w-full h-full object-cover" />
                                    <button
                                        onClick={() => onChange({ avatar: '' })}
                                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <span className="text-white text-xs font-bold">REMOVE</span>
                                    </button>
                                </>
                            ) : (
                                <Mic className="text-gray-400" />
                            )}
                        </div>

                        <div className="flex-1">
                            <div className="flex border-b border-gray-200 mb-4">
                                <button
                                    onClick={() => setAvatarTab('library')}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${avatarTab === 'library' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    Library
                                </button>
                                <button
                                    onClick={() => setAvatarTab('upload')}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${avatarTab === 'upload' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    Upload
                                </button>
                                {architectMode && (
                                    <button
                                        onClick={() => setAvatarTab('generate')}
                                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${avatarTab === 'generate' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        Generate
                                    </button>
                                )}
                            </div>

                            {avatarTab === 'library' && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between px-1">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                                            <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                                                {localAvatars.length} Professional Avatars
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-gray-400 font-medium">Select to apply</span>
                                    </div>
                                    <div className="flex gap-4 overflow-x-auto p-4 bg-gradient-to-br from-gray-50 to-indigo-50/30 rounded-2xl border border-gray-200/80 shadow-inner snap-x snap-mandatory hide-scrollbar">
                                        {localAvatars.map((file, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => onChange({ avatar: `/avatars/${file}` })}
                                                className={`relative group rounded-2xl overflow-hidden border-3 transition-all duration-300 shadow-lg hover:shadow-2xl hover:scale-[1.02] shrink-0 w-32 snap-center ${formData.avatar === `/avatars/${file}`
                                                    ? 'border-indigo-600 ring-4 ring-indigo-200'
                                                    : 'border-white hover:border-indigo-300'
                                                    }`}
                                            >
                                                <div className="aspect-[3/4] bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
                                                    <img
                                                        src={`/avatars/${file}`}
                                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                        loading="lazy"
                                                        alt={`Avatar ${idx + 1}`}
                                                    />
                                                    {/* Gradient overlay on hover */}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                                    {/* Selected indicator */}
                                                    {formData.avatar === `/avatars/${file}` && (
                                                        <div className="absolute top-2 right-2 bg-indigo-600 text-white rounded-full p-1 shadow-lg">
                                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    {localAvatars.length === 0 && (
                                        <div className="text-center py-12 text-gray-400">
                                            <p className="text-sm font-medium">No avatars available</p>
                                            <p className="text-xs mt-1">Try uploading or generating one</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {avatarTab === 'upload' && (
                                <div className="flex gap-2">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    onChange({ avatar: reader.result as string });
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                    />
                                </div>
                            )}

                            {avatarTab === 'generate' && (
                                <div className="flex gap-2">
                                    <button
                                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                        onClick={() => {
                                            // Calibrated Generation: Select random from High-Fi Library
                                            if (localAvatars.length > 0) {
                                                const randomAvatar = localAvatars[Math.floor(Math.random() * localAvatars.length)];
                                                onChange({ avatar: `/avatars/${randomAvatar}` });
                                            }
                                        }}
                                    >
                                        <Sparkles size={16} />
                                        Generate AI Avatar
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Agent Name */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Agent Name
                    </label>
                    <div className="relative">
                        <input
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="e.g., Alex, Support Bot, Sarah"
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all pr-10"
                        />
                        <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 transition-colors"
                            title="Generate AI name suggestion"
                        >
                            <Sparkles size={18} />
                        </button>
                    </div>
                </div>

                {/* Main Goal */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Main Goal
                    </label>
                    <textarea
                        name="goal"
                        value={formData.goal}
                        onChange={handleChange}
                        placeholder="Describe what you want your agent to accomplish..."
                        rows={4}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">Be specific about tasks, tone, and any constraints</p>
                </div>

                {/* Department */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Department
                    </label>
                    <select
                        name="department"
                        value={formData.department}
                        onChange={handleChange}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    >
                        <option>Operations</option>
                        <option>Sales</option>
                        <option>Finance</option>
                        <option>Legal & Compliance</option>
                        <option>Creative</option>
                        <option>Technology</option>
                        <option>Customer Support</option>
                        <option>Human Resources</option>
                    </select>
                </div>

                <div className="h-px bg-gray-50 my-2" />

                {/* Company Intelligence Section */}
                <div className="space-y-6 pt-4 border-t border-gray-50">
                    <div className="flex items-center gap-2 mb-2">
                        <Database size={18} className="text-indigo-600" />
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Company Intelligence</h3>
                    </div>

                    <div className="bg-indigo-50/30 rounded-2xl p-6 border border-indigo-100/50 space-y-4">
                        <p className="text-xs text-indigo-700/70 font-medium leading-relaxed">
                            Connect your agent to your live business data. Ares will crawl these sources to synthesize a highly accurate logic core.
                        </p>

                        <div>
                            <label className="block text-[10px] font-black text-indigo-900 uppercase tracking-widest mb-2">Company Website (URL)</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" size={14} />
                                    <input
                                        name="companyUrl"
                                        value={formData.companyUrl || ''}
                                        onChange={handleChange}
                                        placeholder="https://yourcompany.com"
                                        className="w-full bg-white border border-indigo-100 rounded-xl px-4 py-3 pl-10 text-xs font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (formData.companyUrl && onResearch) {
                                            setIsResearching(true);
                                            try {
                                                await onResearch(formData.companyUrl);
                                            } finally {
                                                setIsResearching(false);
                                            }
                                        }
                                    }}
                                    disabled={!formData.companyUrl || isResearching}
                                    className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${isResearching ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                        }`}
                                >
                                    {isResearching ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <Search size={14} />
                                    )}
                                    {isResearching ? 'Analyzing...' : 'Research'}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-indigo-900 uppercase tracking-widest mb-2">Business Context / Special Instructions</label>
                            <textarea
                                name="companyContext"
                                value={formData.companyContext || ''}
                                onChange={handleChange}
                                placeholder="Paste specific project details, pricing structures, or internal workflows here..."
                                rows={4}
                                className="w-full bg-white border border-indigo-100 rounded-xl px-4 py-3 text-xs font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Hourly Rate */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-semibold text-gray-700">
                            Hourly Rate (£)
                        </label>
                        {!isVoiceEnabled && (
                            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider">
                                25% Text-Only Discount Applied
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1">
                            <input
                                name="rate"
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.rate}
                                onChange={handleChange}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            />
                        </div>
                        {!isVoiceEnabled && (
                            <div className="text-right">
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.1em] line-through">£{(formData.rate).toFixed(2)}</p>
                                <p className="text-xl font-black text-emerald-600">£{(formData.rate * 0.75).toFixed(2)}<span className="text-xs font-normal">/hr</span></p>
                            </div>
                        )}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                        Base rate for this role. {isVoiceEnabled ? 'Voice capabilities included.' : 'Save 25% by opting for text-only communication.'}
                    </p>
                </div>

                <div className="h-px bg-gray-50 my-2" />

                {/* Voice Capabilities Master Toggle */}
                <div className="flex items-center justify-between p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100/50 group hover:border-indigo-200 transition-all">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${isVoiceEnabled ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-gray-200 text-gray-400'}`}>
                            <Mic size={24} />
                        </div>
                        <div>
                            <span className="text-sm font-bold text-gray-900 block">Voice Capabilities</span>
                            <p className="text-xs text-gray-500 font-medium leading-relaxed max-w-[200px]">Enable high-fidelity speech synthesis for calls and memos</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => onChange({ voiceEnabled: !isVoiceEnabled })}
                        className={`
                            w-14 h-7 rounded-full transition-all relative
                            ${isVoiceEnabled ? 'bg-indigo-600' : 'bg-gray-300'}
                        `}
                    >
                        <span
                            className={`
                                absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-md
                                ${isVoiceEnabled ? 'left-8' : 'left-1'}
                            `}
                        />
                    </button>
                </div>

                {
                    isVoiceEnabled && (
                        <div className="space-y-6 animate-fade-in pt-4 border-t border-gray-50">
                            {/* Voice Identity */}
                            <label className="block text-sm font-semibold text-gray-700 mb-2 flex justify-between">
                                Voice Identity
                                <a href="https://elevenlabs.io/app/voice-library" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline lowercase font-normal italic">ElevenLabs Library</a>
                            </label>
                            <VoiceIdentityGuard
                                value={formData.voiceId}
                                onChange={(id) => onChange({ voiceId: id })}
                                placeholder="Paste ElevenLabs Voice ID"
                            />
                            <div className="flex justify-between items-center mt-2">
                                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                                    Powered by ElevenLabs
                                </p>
                            </div>
                        </div>
                    )
                }
            </div >
        </div >
    );
};
