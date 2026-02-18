import React from 'react';
import { ROLE_TEMPLATES, RoleTemplate } from '../../constants/roleTemplates';

interface StepRoleSelectProps {
    selectedTemplateId: string | null;
    onSelect: (template: RoleTemplate) => void;
}

export const StepRoleSelect: React.FC<StepRoleSelectProps> = ({ selectedTemplateId, onSelect }) => {
    return (
        <div className="space-y-6">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">What will your agent help with?</h2>
                <p className="text-gray-500">Choose a role template to get started quickly, or build from scratch.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ROLE_TEMPLATES.map((template) => {
                    const Icon = template.icon;
                    const isSelected = selectedTemplateId === template.id;

                    return (
                        <button
                            key={template.id}
                            onClick={() => onSelect(template)}
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
                            <h3 className="font-bold text-gray-900 mb-1">{template.title}</h3>
                            <p className="text-sm text-gray-500 leading-relaxed">{template.description}</p>
                            {template.id !== 'custom' && (
                                <div className="mt-4 flex items-center gap-2">
                                    <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                                        £{template.hourlyRate.toFixed(2)}/hr
                                    </span>
                                    <span className="text-xs text-gray-400">{template.department}</span>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
