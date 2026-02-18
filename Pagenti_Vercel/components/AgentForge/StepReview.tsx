import React from 'react';
import { Check, Pencil, Bot, Building, Target, Mic, MessageSquare, Send, MessageCircle, Slack, Zap } from 'lucide-react';
import { RoleTemplate, IndustryTemplate } from '../../constants/roleTemplates';
import { AgentFormData } from './StepConfigure';

interface StepReviewProps {
    selectedTemplate: RoleTemplate | null;
    selectedIndustry: IndustryTemplate | null;
    formData: AgentFormData;
    onEditStep: (step: number) => void;
    isEditMode: boolean;
}

export const StepReview: React.FC<StepReviewProps> = ({
    selectedTemplate,
    selectedIndustry,
    formData,
    onEditStep,
    isEditMode
}) => {
    const ReviewSection: React.FC<{
        title: string;
        icon: React.ReactNode;
        step: number;
        children: React.ReactNode;
    }> = ({ title, icon, step, children }) => (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                        {icon}
                    </div>
                    <h3 className="font-bold text-gray-900">{title}</h3>
                </div>
                <button
                    onClick={() => onEditStep(step)}
                    className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                    <Pencil size={14} />
                    Edit
                </button>
            </div>
            {children}
        </div>
    );

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {isEditMode ? 'Review your changes' : 'Ready to create your agent'}
                </h2>
                <p className="text-gray-500">Review the details below before deployment</p>
            </div>

            <div className="space-y-4">
                {/* Role Template */}
                <ReviewSection title="Role Template" icon={<Bot size={20} />} step={1}>
                    {selectedTemplate ? (
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                                {React.createElement(selectedTemplate.icon, { size: 16 })}
                            </div>
                            <div>
                                <p className="font-medium text-gray-900">{selectedTemplate.title}</p>
                                <p className="text-sm text-gray-500">{selectedTemplate.description}</p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-gray-500 italic">No template selected</p>
                    )}
                </ReviewSection>

                {/* Industry */}
                <ReviewSection title="Industry" icon={<Building size={20} />} step={2}>
                    {selectedIndustry ? (
                        <div>
                            <p className="font-medium text-gray-900">{selectedIndustry.title}</p>
                            <p className="text-sm text-gray-500">{selectedIndustry.toneGuidance}</p>
                        </div>
                    ) : (
                        <p className="text-gray-500 italic">No industry selected</p>
                    )}
                </ReviewSection>

                {/* Configuration */}
                <ReviewSection title="Configuration" icon={<Target size={20} />} step={3}>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 rounded-xl overflow-hidden border border-gray-100 shadow-sm bg-gray-50 flex-shrink-0">
                            {formData.avatar ? (
                                <img src={formData.avatar} alt="Agent" className="w-full h-full object-cover" />
                            ) : (
                                <Bot size={32} className="w-full h-full p-4 text-gray-300" />
                            )}
                        </div>
                        <div>
                            <p className="font-bold text-gray-900">{formData.name}</p>
                            <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider">{formData.department}</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {formData.goal && (
                            <div>
                                <span className="text-gray-500 block mb-1">Goal</span>
                                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{formData.goal}</p>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-gray-500">Voice Capabilities</span>
                            <span className="font-medium text-gray-900">
                                {formData.voiceEnabled !== false ? 'Enabled' : 'Disabled'}
                            </span>
                        </div>
                        {formData.voiceEnabled === false ? (
                            <div className="flex justify-between items-center bg-emerald-50 p-2 rounded-lg border border-emerald-100 mt-2">
                                <span className="text-emerald-700 text-xs font-bold uppercase tracking-tight">Text-Only Discount</span>
                                <span className="font-black text-emerald-600 font-mono">£{(formData.rate * 0.75).toFixed(2)}/hr</span>
                            </div>
                        ) : (
                            formData.rate > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Hourly Rate</span>
                                    <span className="font-medium text-gray-900">£{formData.rate.toFixed(2)}</span>
                                </div>
                            )
                        )}
                    </div>
                </ReviewSection>

                {/* Communication */}
                < ReviewSection title="Communication" icon={< MessageSquare size={20} />} step={4} >
                    <div className="space-y-4">
                        {formData.communicationConfig?.channels.some(c => c.connected) ? (
                            <>
                                <div className="flex flex-wrap gap-2">
                                    {formData.communicationConfig.channels.filter(c => c.connected).map(channel => (
                                        <div key={channel.type} className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-sm font-bold border border-indigo-100 uppercase tracking-tighter">
                                            {channel.type === 'whatsapp' && <MessageCircle size={14} />}
                                            {channel.type === 'telegram' && <Send size={14} />}
                                            {channel.type === 'slack' && <Slack size={14} />}
                                            {channel.type}
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Frequency</p>
                                        <p className="text-sm font-bold text-gray-900 capitalize">{formData.communicationConfig.preferences.frequency.replace('-', ' ')}</p>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Priority</p>
                                        <p className="text-sm font-bold text-gray-900">
                                            {formData.communicationConfig.preferences.urgentOnly ? 'Urgent Only' : 'All Updates'}
                                        </p>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <p className="text-gray-500 italic text-sm">No external channels connected</p>
                        )}
                    </div>
                </ReviewSection >
            </div >

            {/* Agent Preview Card */}
            < div className="mt-8" >
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 text-center">
                    Preview
                </h3>
                <div className="bg-gradient-to-br from-indigo-950 to-indigo-900 rounded-[3rem] p-10 text-center relative overflow-hidden shadow-2xl">
                    <div className="absolute inset-0 bg-indigo-500/10 animate-pulse pointer-events-none"></div>
                    <div className="relative z-10">
                        <div className="w-24 h-24 mx-auto rounded-full overflow-hidden border-4 border-indigo-400 shadow-lg mb-6 ring-4 ring-indigo-500/20">
                            {formData.avatar ? (
                                <img src={formData.avatar} alt="Agent Preview" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-indigo-500 flex items-center justify-center">
                                    <Bot size={48} className="text-white" />
                                </div>
                            )}
                        </div>
                        <h4 className="text-2xl font-black text-white mb-2">{formData.name}</h4>
                        <span className="inline-block bg-indigo-500/30 backdrop-blur-md border border-indigo-400/30 text-indigo-100 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-6">
                            {formData.department}
                        </span>
                        {formData.goal && (
                            <p className="text-indigo-200/90 text-sm max-w-sm mx-auto leading-relaxed font-medium">
                                "{formData.goal.length > 120 ? formData.goal.slice(0, 120) + '...' : formData.goal}"
                            </p>
                        )}
                        {formData.voiceEnabled !== false && (
                            <div className="mt-6 flex items-center justify-center gap-2 text-indigo-400 bg-indigo-900/40 py-2 px-4 rounded-xl border border-indigo-500/20 w-fit mx-auto">
                                <Mic size={14} />
                                <span className="text-xs font-black uppercase tracking-widest">Active Voice Interface</span>
                            </div>
                        )}
                        {formData.communicationConfig?.channels.some(c => c.connected) && (
                            <div className="mt-4 flex items-center justify-center gap-4">
                                {formData.communicationConfig.channels.filter(c => c.connected).map(channel => (
                                    <div key={channel.type} className="w-8 h-8 bg-white/10 backdrop-blur-md rounded-lg flex items-center justify-center text-white border border-white/20 shadow-xl" title={`${channel.type} connected`}>
                                        {channel.type === 'whatsapp' && <MessageCircle size={16} />}
                                        {channel.type === 'telegram' && <Send size={16} />}
                                        {channel.type === 'slack' && <Slack size={16} />}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div >
        </div >
    );
};
