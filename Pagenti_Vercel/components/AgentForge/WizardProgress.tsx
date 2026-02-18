import React from 'react';
import { Check } from 'lucide-react';

interface WizardProgressProps {
    currentStep: number;
    steps: { label: string; description: string }[];
}

export const WizardProgress: React.FC<WizardProgressProps> = ({ currentStep, steps }) => {
    return (
        <div className="flex items-center justify-center gap-2 mb-8">
            {steps.map((step, index) => {
                const stepNumber = index + 1;
                const isCompleted = stepNumber < currentStep;
                const isCurrent = stepNumber === currentStep;

                return (
                    <React.Fragment key={step.label}>
                        <div className="flex flex-col items-center">
                            <div
                                className={`
                                    w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300
                                    ${isCompleted
                                        ? 'bg-green-500 text-white'
                                        : isCurrent
                                            ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                                            : 'bg-gray-200 text-gray-500'
                                    }
                                `}
                            >
                                {isCompleted ? <Check size={18} /> : stepNumber}
                            </div>
                            <span className={`text-xs mt-2 font-medium ${isCurrent ? 'text-indigo-600' : 'text-gray-400'}`}>
                                {step.label}
                            </span>
                        </div>
                        {index < steps.length - 1 && (
                            <div
                                className={`w-16 h-1 rounded-full transition-all duration-300 ${stepNumber < currentStep ? 'bg-green-500' : 'bg-gray-200'
                                    }`}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};
