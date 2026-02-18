
import React, { useState } from 'react';
import { User, DollarSign, Clock, Languages, Briefcase, FileText, CheckSquare, Eye, Save, Trash, Upload } from 'lucide-react';
import { agentService } from '../services/agentService';
import { VoiceIdentityGuard } from '../components/VoiceIdentityGuard';

export const AdminAgentBuilderView: React.FC = () => {
    const [formData, setFormData] = useState({
        name: 'Ava',
        role: 'Digital Intake Specialist',
        salary: '$450/mo',
        hours: '24/7/365',
        languages: 'English, Spanish, French',
        avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400',
        description: 'Monitors forms and emails, distinguishing leads from spam in 3 seconds.',
        caseStudyTitle: 'Legal Firm Intake',
        caseStudyOutcome: 'Reduced Time-to-Response from 4h to 45s.',
        onboardingReqs: 'Email Access, CRM, Calendar',
        voiceId: '',
        voiceEnabled: true,
        knowledgeBase: [] as { id: string, name: string, content: string, uploadedAt: string }[]
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
            {/* Sidebar / Editor */}
            <div className="w-full md:w-1/2 p-8 overflow-y-auto bg-white border-r border-gray-200">
                <h2 className="text-2xl font-bold font-heading mb-8 flex items-center gap-2">
                    <User className="text-indigo-600" /> Agent Studio
                </h2>

                <div className="space-y-6">
                    {/* Identity Section */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest border-b pb-2">Identity</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Name</label>
                                <input name="name" value={formData.name} onChange={handleChange} className="w-full bg-gray-50 border rounded-lg px-3 py-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Role Title</label>
                                <input name="role" value={formData.role} onChange={handleChange} className="w-full bg-gray-50 border rounded-lg px-3 py-2 text-sm" />
                            </div>
                        </div>
                    </div>

                    {/* Specs Section */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest border-b pb-2">Specs</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Salary</label>
                                <input name="salary" value={formData.salary} onChange={handleChange} className="w-full bg-gray-50 border rounded-lg px-3 py-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Hours</label>
                                <input name="hours" value={formData.hours} onChange={handleChange} className="w-full bg-gray-50 border rounded-lg px-3 py-2 text-sm" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Languages</label>
                            <input name="languages" value={formData.languages} onChange={handleChange} className="w-full bg-gray-50 border rounded-lg px-3 py-2 text-sm" />
                        </div>
                    </div>

                    {/* Voice Section */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest border-b pb-2">Voice Synthesis</h3>
                        <div className="flex items-center gap-4 mb-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.voiceEnabled}
                                    onChange={(e) => setFormData({ ...formData, voiceEnabled: e.target.checked })}
                                    className="w-4 h-4 text-indigo-600 rounded"
                                />
                                <span className="text-xs font-bold text-gray-500 uppercase">Enable ElevenLabs Voice</span>
                            </label>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">ElevenLabs Voice ID (Secure Sync)</label>
                            <VoiceIdentityGuard
                                value={formData.voiceId}
                                onChange={(id) => setFormData({ ...formData, voiceId: id })}
                                placeholder="Paste ElevenLabs ID"
                            />
                            <p className="text-[10px] text-gray-400 mt-2">
                                Find more voices in your <a href="https://elevenlabs.io/app/voice-library" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">ElevenLabs Voice Library</a>
                            </p>
                        </div>
                    </div>

                    {/* Knowledge Base Section */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest border-b pb-2">Knowledge Base</h3>
                        <div className="space-y-3">
                            {formData.knowledgeBase.map((doc, idx) => (
                                <div key={doc.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-100">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <FileText size={16} className="text-indigo-500 shrink-0" />
                                        <div className="truncate">
                                            <div className="text-xs font-bold text-gray-700 truncate">{doc.name}</div>
                                            <div className="text-[10px] text-gray-400">{doc.uploadedAt}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const newKB = [...formData.knowledgeBase];
                                            newKB.splice(idx, 1);
                                            setFormData({ ...formData, knowledgeBase: newKB });
                                        }}
                                        className="text-gray-400 hover:text-red-500 transition-colors shrink-0"
                                    >
                                        <Trash size={14} />
                                    </button>
                                </div>
                            ))}

                            <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all group">
                                <Upload size={20} className="text-gray-400 group-hover:text-indigo-500 mb-2" />
                                <span className="text-xs font-bold text-gray-500 group-hover:text-indigo-600">Click to Upload Knowledge Document</span>
                                <span className="text-[10px] text-gray-400 mt-1">TXT, MD, CSV (Max 5MB)</span>
                                <input
                                    type="file"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onload = (loadEvent) => {
                                                const content = loadEvent.target?.result as string;
                                                const newDoc = {
                                                    id: Math.random().toString(36).substr(2, 9),
                                                    name: file.name,
                                                    content: content,
                                                    uploadedAt: new Date().toLocaleDateString()
                                                };
                                                setFormData({
                                                    ...formData,
                                                    knowledgeBase: [...formData.knowledgeBase, newDoc]
                                                });
                                            };
                                            reader.readAsText(file);
                                        }
                                    }}
                                />
                            </label>
                        </div>
                    </div>

                    {/* Proof of Work Section */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest border-b pb-2">Proof of Work</h3>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Case Study Title</label>
                            <input name="caseStudyTitle" value={formData.caseStudyTitle} onChange={handleChange} className="w-full bg-gray-50 border rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Case Study Outcome</label>
                            <textarea name="caseStudyOutcome" value={formData.caseStudyOutcome} onChange={handleChange} className="w-full bg-gray-50 border rounded-lg px-3 py-2 text-sm" rows={2} />
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            const agent: any = {
                                id: formData.name.toLowerCase().replace(/\s+/g, '-'),
                                name: formData.name,
                                role: { en: formData.role },
                                department: 'Operations',
                                avatar: formData.avatarUrl,
                                description: { en: formData.description },
                                hourlyRate: 0.62,
                                voiceId: formData.voiceId,
                                voiceEnabled: formData.voiceEnabled,
                                knowledgeBase: formData.knowledgeBase,
                                caseStudy: { title: formData.caseStudyTitle, outcome: formData.caseStudyOutcome }
                            };
                            agentService.saveAgent(agent);
                            alert('Candidate Profile Synced with Forge Cloud');
                        }}
                        className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors"
                    >
                        <Save size={18} /> Save Candidate Profile
                    </button>
                </div>
            </div>

            {/* Preview Area */}
            <div className="w-full md:w-1/2 p-12 bg-gray-100 flex items-center justify-center">
                <div className="bg-white rounded-[2rem] p-8 shadow-2xl max-w-md w-full relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-indigo-600 to-indigo-900"></div>
                    <div className="relative z-10 flex flex-col items-center mt-8">
                        <img src={formData.avatarUrl} alt={formData.name} className="w-24 h-24 rounded-2xl object-cover shadow-lg border-4 border-white" />
                        <h2 className="text-2xl font-bold text-gray-900 mt-4">{formData.name}</h2>
                        <p className="text-sm text-indigo-600 font-bold uppercase tracking-wider">{formData.role}</p>
                    </div>

                    <div className="mt-8 space-y-6">
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div className="bg-gray-50 p-3 rounded-xl">
                                <div className="text-xs text-gray-400 uppercase font-bold">Salary</div>
                                <div className="font-mono font-bold text-gray-900">{formData.salary}</div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-xl">
                                <div className="text-xs text-gray-400 uppercase font-bold">Model</div>
                                <div className="font-mono font-bold text-gray-900">GPT-4o</div>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b pb-1">Capabilities</h4>
                            <p className="text-sm text-gray-600 leading-relaxed">{formData.description}</p>
                        </div>

                        <div>
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b pb-1">Proven Results</h4>
                            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
                                <div className="text-xs font-bold text-emerald-800 mb-1">{formData.caseStudyTitle}</div>
                                <div className="text-xs text-emerald-600">{formData.caseStudyOutcome}</div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
                            <span className="flex items-center gap-1"><Clock size={12} /> {formData.hours}</span>
                            <span className="flex items-center gap-1"><Languages size={12} /> {formData.languages.split(',')[0]} +More</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
