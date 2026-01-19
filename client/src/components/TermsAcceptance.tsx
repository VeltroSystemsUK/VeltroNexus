import React, { useState } from 'react';
import { Check, AlertTriangle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TermsAcceptanceProps {
    onAccept: (acceptanceData: TermsAcceptanceData) => void;
    userEmail?: string;
    userName?: string;
}

export interface TermsAcceptanceData {
    fullName: string;
    jobTitle: string;
    companyName: string;
    email: string;
    acceptedAt: string;
    termsVersion: string;
    termsAccepted: boolean;
    dpaAccepted: boolean;
}

export default function TermsAcceptance({ onAccept, userEmail = '', userName = '' }: TermsAcceptanceProps) {
    const [checkboxes, setCheckboxes] = useState({
        terms: false,
        binding: false,
        authority: false,
        dpa: false
    });

    const [formData, setFormData] = useState({
        fullName: userName,
        jobTitle: '',
        companyName: '',
        email: userEmail
    });

    const [errors, setErrors] = useState<Record<string, boolean>>({});
    const [shakeCheckbox, setShakeCheckbox] = useState<string | null>(null);

    const allCheckboxesChecked = Object.values(checkboxes).every(Boolean);

    const toggleCheckbox = (key: keyof typeof checkboxes) => {
        setCheckboxes(prev => ({ ...prev, [key]: !prev[key] }));
        setErrors(prev => ({ ...prev, [key]: false }));
    };

    const handleInputChange = (field: keyof typeof formData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setErrors(prev => ({ ...prev, [field]: false }));
    };

    const validateAndSubmit = () => {
        const newErrors: Record<string, boolean> = {};

        // Check all checkboxes
        Object.entries(checkboxes).forEach(([key, checked]) => {
            if (!checked) {
                newErrors[key] = true;
                if (!shakeCheckbox) setShakeCheckbox(key);
            }
        });

        // Check form fields
        if (!formData.fullName.trim()) newErrors.fullName = true;
        if (!formData.jobTitle.trim()) newErrors.jobTitle = true;
        if (!formData.companyName.trim()) newErrors.companyName = true;
        if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = true;
        }

        setErrors(newErrors);

        if (shakeCheckbox) {
            setTimeout(() => setShakeCheckbox(null), 400);
        }

        if (Object.keys(newErrors).length > 0) return;

        // Submit acceptance
        const acceptanceData: TermsAcceptanceData = {
            fullName: formData.fullName.trim(),
            jobTitle: formData.jobTitle.trim(),
            companyName: formData.companyName.trim(),
            email: formData.email.trim(),
            acceptedAt: new Date().toISOString(),
            termsVersion: '2.0',
            termsAccepted: true,
            dpaAccepted: true
        };

        onAccept(acceptanceData);
    };

    const CheckboxItem = ({
        id,
        checked,
        label
    }: {
        id: keyof typeof checkboxes;
        checked: boolean;
        label: React.ReactNode;
    }) => (
        <div
            onClick={() => toggleCheckbox(id)}
            className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
                ${checked ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
                ${errors[id] ? 'border-destructive bg-destructive/5' : ''}
                ${shakeCheckbox === id ? 'animate-[shake_0.3s]' : ''}`}
        >
            <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all
                ${checked ? 'bg-primary border-primary' : 'border-muted-foreground/50 bg-white'}`}>
                {checked && <Check className="w-4 h-4 text-white" />}
            </div>
            <div className="text-sm leading-relaxed">{label}</div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center pb-4 border-b border-border">
                <h3 className="text-lg font-bold mb-1">Terms & Conditions</h3>
                <p className="text-sm text-muted-foreground">Please review and accept to continue</p>
            </div>

            {/* Important Notice */}
            <div className="bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-500 p-4 rounded-r-lg">
                <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                        <strong>IMPORTANT:</strong> By accepting, you are entering into a legally binding agreement.
                    </p>
                </div>
            </div>

            {/* Scrollable Terms Summary */}
            <div className="max-h-48 overflow-y-auto bg-muted/30 rounded-lg p-4 border border-border text-sm space-y-3">
                <h4 className="font-semibold text-foreground">Key Terms Summary:</h4>
                <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Monthly/annual subscription with <strong className="text-foreground">auto-renewal</strong></span>
                    </li>
                    <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>99.5% uptime commitment with service credits</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>You <strong className="text-foreground">own your data</strong>; we process it under UK GDPR</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Bank-grade security with AES-256 encryption</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span><strong className="text-foreground">Cancel anytime</strong> (no refund for current period)</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>30-day data export window after cancellation</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Liability capped at 12 months' fees</span>
                    </li>
                </ul>
                <a
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline mt-2"
                    onClick={(e) => e.stopPropagation()}
                >
                    View full Terms & Conditions <ExternalLink className="w-3 h-3" />
                </a>
            </div>

            {/* Acceptance Checkboxes */}
            <div className="space-y-3">
                <CheckboxItem
                    id="terms"
                    checked={checkboxes.terms}
                    label={
                        <span>
                            I have read and agree to the{' '}
                            <a href="/terms" target="_blank" rel="noopener noreferrer"
                                className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                                Veltro Terms & Conditions
                            </a>
                        </span>
                    }
                />
                <CheckboxItem
                    id="binding"
                    checked={checkboxes.binding}
                    label={
                        <span>
                            I acknowledge that by subscribing, I am entering into a <strong>legally binding agreement</strong>
                        </span>
                    }
                />
                <CheckboxItem
                    id="authority"
                    checked={checkboxes.authority}
                    label={
                        <span>
                            I confirm that I have <strong>authority to bind</strong> the company/entity I represent to these Terms
                        </span>
                    }
                />
                <CheckboxItem
                    id="dpa"
                    checked={checkboxes.dpa}
                    label={
                        <span>
                            I agree to the{' '}
                            <a href="https://veltro.co.uk/dpa" target="_blank" rel="noopener noreferrer"
                                className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                                Data Processing Agreement
                            </a>{' '}
                            and understand how my data will be processed under UK GDPR
                        </span>
                    }
                />
            </div>

            {/* Signature Fields */}
            <div className="pt-4 border-t border-border space-y-4">
                <h4 className="font-semibold text-sm">Acceptance Signature</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Full Name *</label>
                        <Input
                            value={formData.fullName}
                            onChange={(e) => handleInputChange('fullName', e.target.value)}
                            placeholder="John Smith"
                            className={errors.fullName ? 'border-destructive' : ''}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Job Title *</label>
                        <Input
                            value={formData.jobTitle}
                            onChange={(e) => handleInputChange('jobTitle', e.target.value)}
                            placeholder="CEO, Director, etc."
                            className={errors.jobTitle ? 'border-destructive' : ''}
                        />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Company Name *</label>
                        <Input
                            value={formData.companyName}
                            onChange={(e) => handleInputChange('companyName', e.target.value)}
                            placeholder="Acme Ltd"
                            className={errors.companyName ? 'border-destructive' : ''}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email Address *</label>
                        <Input
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            placeholder="john@example.com"
                            className={errors.email ? 'border-destructive' : ''}
                        />
                    </div>
                </div>
            </div>

            {/* Accept Button */}
            <Button
                type="button"
                onClick={validateAndSubmit}
                disabled={!allCheckboxesChecked}
                className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90"
            >
                <Check className="mr-2 h-4 w-4" />
                I Accept - Continue to Payment
            </Button>
        </div>
    );
}
