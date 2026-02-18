import React from 'react';
import { Building2, Heart, ShoppingCart, Briefcase, Cpu, Home, Scale, Plane, HelpCircle } from 'lucide-react';
import { INDUSTRY_TEMPLATES, IndustryTemplate } from '../../constants/roleTemplates';

// Map industry IDs to icons
const INDUSTRY_ICONS: Record<string, any> = {
    'finance': Building2,
    'healthcare': Heart,
    'retail': ShoppingCart,
    'professional-services': Briefcase,
    'tech': Cpu,
    'real-estate': Home,
    'legal': Scale,
    'hospitality': Plane,
    'other': HelpCircle,
};

interface StepIndustrySelectProps {
    selectedIndustryId: string | null;
    onSelect: (industry: IndustryTemplate) => void;
}

export const StepIndustrySelect: React.FC<StepIndustrySelectProps> = ({ selectedIndustryId, onSelect }) => {
    return (
        <div className="space-y-6">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">What industry are you in?</h2>
                <p className="text-gray-500">This helps us tailor your agent's tone and knowledge.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {INDUSTRY_TEMPLATES.map((industry) => {
                    const Icon = INDUSTRY_ICONS[industry.id] || HelpCircle;
                    const isSelected = selectedIndustryId === industry.id;

                    return (
                        <button
                            key={industry.id}
                            onClick={() => onSelect(industry)}
                            className={`
                                p-6 rounded-2xl border-2 text-left transition-all duration-200
                                hover:shadow-lg hover:scale-[1.02] transform
                                ${isSelected
                                    ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                                    : 'border-gray-200 bg-white hover:border-indigo-300'
                                }
                            `}
                        >
                            <div className={`
                                w-12 h-12 rounded-xl flex items-center justify-center mb-4
                                ${isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}
                            `}>
                                <Icon size={24} />
                            </div>
                            <h3 className="font-bold text-gray-900 mb-1">{industry.title}</h3>
                            <p className="text-sm text-gray-500 leading-relaxed">{industry.description}</p>
                            <div className="mt-3">
                                <span className="text-xs text-gray-400 italic">{industry.toneGuidance}</span>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
