import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Send, CheckCircle, Loader2, Building2, Workflow, Users, Puzzle, Shield, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import logoChrome from "@assets/logo-chrome.png";

// Form sections with icons
const formSections = [
    {
        id: "company_context",
        title: "Company",
        fullTitle: "Company & Project Context",
        icon: Building2,
        fields: [
            { id: "entity_name", type: "text", label: "Legal Entity Name", required: true },
            { id: "sponsor", type: "text", label: "Project Sponsor (Name & Role)", required: true },
            { id: "go_live_date", type: "date", label: "Target Go-Live Date", required: true },
            {
                id: "objective",
                type: "radio",
                label: "Primary Business Objective",
                options: ["Automate existing manual processes", "Launch a new lending product", "Replace a legacy system", "Other"]
            }
        ]
    },
    {
        id: "workflow",
        title: "Workflow",
        fullTitle: "Loan Products & Workflow",
        icon: Workflow,
        fields: [
            { id: "loan_types", type: "textarea", label: "Loan Types to be supported", placeholder: "e.g., Bridging, Development, Term Loans..." },
            { id: "stages", type: "textarea", label: "Application Stages", placeholder: "Describe the lifecycle: Lead -> KYC -> Credit -> Offer -> Completion..." }
        ]
    },
    {
        id: "users",
        title: "Users",
        fullTitle: "User Roles & Access",
        icon: Users,
        fields: [
            {
                id: "internal_roles",
                type: "checkbox_group",
                label: "Internal Users",
                options: ["Administrators", "Underwriters", "Read-Only / Auditors"]
            },
            {
                id: "external_roles",
                type: "checkbox_group",
                label: "External Users",
                options: ["Brokers/Intermediaries", "Borrowers (Direct Portal)"]
            },
            { id: "user_count", type: "number", label: "Approximate User Count" }
        ]
    },
    {
        id: "modules",
        title: "Modules",
        fullTitle: "Functional Modules",
        icon: Puzzle,
        fields: [
            {
                id: "credit_integration",
                type: "select",
                label: "Credit Bureau Integration",
                options: ["No, manual upload", "Yes (Equifax)", "Yes (Experian)", "Yes (TransUnion)"]
            },
            {
                id: "open_banking",
                type: "boolean",
                label: "Require Open Banking for Income Verification?"
            },
            {
                id: "decisioning",
                type: "radio",
                label: "Decisioning Logic",
                options: ["Fully Manual", "Hybrid (System suggests)", "Fully Automated"]
            },
            {
                id: "documents",
                type: "checkbox_group",
                label: "Auto-Generated Documents",
                options: ["Heads of Terms / DIP", "Offer Letters", "Loan Agreements"]
            }
        ]
    },
    {
        id: "compliance",
        title: "Compliance",
        fullTitle: "Data & Compliance",
        icon: Shield,
        fields: [
            {
                id: "data_subjects",
                type: "checkbox_group",
                label: "Primary Data Subjects",
                options: ["Individuals (Consumers)", "Corporate Entities"]
            },
            {
                id: "data_residency",
                type: "radio",
                label: "Data Residency Requirement",
                options: ["Standard UK/EEA Hosting", "Specific Requirement (Please Specify)"],
                conditionalField: {
                    showWhen: "Specific Requirement (Please Specify)",
                    id: "data_residency_details",
                    type: "textarea",
                    label: "Please specify your data residency requirements",
                    placeholder: "e.g., Must be hosted in specific region, specific compliance requirements..."
                }
            }
        ]
    },
    {
        id: "contact",
        title: "Contact",
        fullTitle: "Contact Information",
        icon: UserCircle,
        fields: [
            { id: "contact_name", type: "text", label: "Your Name", required: true },
            { id: "contact_email", type: "email", label: "Email Address", required: true },
            { id: "contact_phone", type: "tel", label: "Phone Number", placeholder: "+44 (0) XXX XXX XXXX" },
            { id: "additional_notes", type: "textarea", label: "Additional Requirements or Questions", placeholder: "Any specific requirements, questions, or timeline constraints..." }
        ]
    }
];

interface FormData {
    [key: string]: string | string[] | boolean | number;
}

export default function LenderEnquiry() {
    const [currentStep, setCurrentStep] = useState(0);
    const [formData, setFormData] = useState<FormData>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const currentSection = formSections[currentStep];
    const isFirstStep = currentStep === 0;
    const isLastStep = currentStep === formSections.length - 1;

    const handleChange = (id: string, value: string | string[] | boolean | number) => {
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleCheckboxGroupChange = (id: string, option: string, checked: boolean) => {
        const current = (formData[id] as string[]) || [];
        if (checked) {
            handleChange(id, [...current, option]);
        } else {
            handleChange(id, current.filter(item => item !== option));
        }
    };

    const validateCurrentStep = (): boolean => {
        const requiredFields = currentSection.fields.filter(f => 'required' in f && f.required === true);
        for (const field of requiredFields) {
            const value = formData[field.id];
            if (!value || (typeof value === "string" && value.trim() === "")) {
                toast.error(`Please fill in "${field.label}"`);
                return false;
            }
        }
        return true;
    };

    const handleNext = () => {
        if (validateCurrentStep()) {
            setCurrentStep(prev => Math.min(prev + 1, formSections.length - 1));
        }
    };

    const handlePrev = () => {
        setCurrentStep(prev => Math.max(prev - 1, 0));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateCurrentStep()) return;

        setIsSubmitting(true);

        try {
            const response = await fetch("/api/lender-enquiry", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                throw new Error("Failed to submit enquiry");
            }

            setIsSubmitted(true);
            toast.success("Your enquiry has been submitted successfully!");
        } catch (error) {
            console.error("Submission error:", error);
            toast.error("Failed to submit enquiry. Please try again or email us directly.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderField = (field: any) => {
        const baseElement = (() => {
            switch (field.type) {
                case "text":
                case "email":
                case "tel":
                    return (
                        <div key={field.id} className="space-y-2">
                            <Label htmlFor={field.id} className="text-sm font-medium">
                                {field.label} {field.required && <span className="text-destructive">*</span>}
                            </Label>
                            <Input
                                id={field.id}
                                type={field.type}
                                required={field.required}
                                placeholder={field.placeholder}
                                value={(formData[field.id] as string) || ""}
                                onChange={(e) => handleChange(field.id, e.target.value)}
                                className="bg-background"
                            />
                        </div>
                    );

                case "date":
                    return (
                        <div key={field.id} className="space-y-2">
                            <Label htmlFor={field.id} className="text-sm font-medium">
                                {field.label} {field.required && <span className="text-destructive">*</span>}
                            </Label>
                            <Input
                                id={field.id}
                                type="date"
                                required={field.required}
                                value={(formData[field.id] as string) || ""}
                                onChange={(e) => handleChange(field.id, e.target.value)}
                                className="bg-background max-w-[200px]"
                            />
                        </div>
                    );

                case "number":
                    return (
                        <div key={field.id} className="space-y-2">
                            <Label htmlFor={field.id} className="text-sm font-medium">
                                {field.label}
                            </Label>
                            <Input
                                id={field.id}
                                type="number"
                                min={0}
                                value={(formData[field.id] as number) || ""}
                                onChange={(e) => handleChange(field.id, parseInt(e.target.value) || 0)}
                                className="bg-background max-w-[150px]"
                            />
                        </div>
                    );

                case "textarea":
                    return (
                        <div key={field.id} className="space-y-2">
                            <Label htmlFor={field.id} className="text-sm font-medium">
                                {field.label} {field.required && <span className="text-destructive">*</span>}
                            </Label>
                            <Textarea
                                id={field.id}
                                placeholder={field.placeholder}
                                value={(formData[field.id] as string) || ""}
                                onChange={(e) => handleChange(field.id, e.target.value)}
                                className="bg-background min-h-[100px]"
                            />
                        </div>
                    );

                case "radio":
                    return (
                        <div key={field.id} className="space-y-3">
                            <Label className="text-sm font-medium">{field.label}</Label>
                            <RadioGroup
                                value={(formData[field.id] as string) || ""}
                                onValueChange={(value) => handleChange(field.id, value)}
                                className="space-y-2"
                            >
                                {field.options.map((option: string) => (
                                    <div key={option} className="flex items-center space-x-2">
                                        <RadioGroupItem value={option} id={`${field.id}-${option}`} />
                                        <Label htmlFor={`${field.id}-${option}`} className="font-normal cursor-pointer">
                                            {option}
                                        </Label>
                                    </div>
                                ))}
                            </RadioGroup>
                            {/* Conditional field for data residency */}
                            {field.conditionalField && formData[field.id] === field.conditionalField.showWhen && (
                                <div className="mt-4 pl-6 border-l-2 border-primary/30">
                                    <Label htmlFor={field.conditionalField.id} className="text-sm font-medium">
                                        {field.conditionalField.label}
                                    </Label>
                                    <Textarea
                                        id={field.conditionalField.id}
                                        placeholder={field.conditionalField.placeholder}
                                        value={(formData[field.conditionalField.id] as string) || ""}
                                        onChange={(e) => handleChange(field.conditionalField.id, e.target.value)}
                                        className="bg-background min-h-[80px] mt-2"
                                    />
                                </div>
                            )}
                        </div>
                    );

                case "checkbox_group":
                    return (
                        <div key={field.id} className="space-y-3">
                            <Label className="text-sm font-medium">{field.label}</Label>
                            <div className="space-y-2">
                                {field.options.map((option: string) => (
                                    <div key={option} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`${field.id}-${option}`}
                                            checked={((formData[field.id] as string[]) || []).includes(option)}
                                            onCheckedChange={(checked) =>
                                                handleCheckboxGroupChange(field.id, option, checked as boolean)
                                            }
                                        />
                                        <Label htmlFor={`${field.id}-${option}`} className="font-normal cursor-pointer">
                                            {option}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );

                case "select":
                    return (
                        <div key={field.id} className="space-y-2">
                            <Label htmlFor={field.id} className="text-sm font-medium">{field.label}</Label>
                            <Select
                                value={(formData[field.id] as string) || ""}
                                onValueChange={(value) => handleChange(field.id, value)}
                            >
                                <SelectTrigger className="bg-background max-w-[300px]">
                                    <SelectValue placeholder="Select an option" />
                                </SelectTrigger>
                                <SelectContent>
                                    {field.options.map((option: string) => (
                                        <SelectItem key={option} value={option}>
                                            {option}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    );

                case "boolean":
                    return (
                        <div key={field.id} className="flex items-center justify-between max-w-[400px] p-3 bg-muted/30 rounded-lg">
                            <Label htmlFor={field.id} className="text-sm font-medium">{field.label}</Label>
                            <Switch
                                id={field.id}
                                checked={(formData[field.id] as boolean) || false}
                                onCheckedChange={(checked) => handleChange(field.id, checked)}
                            />
                        </div>
                    );

                default:
                    return null;
            }
        })();

        return baseElement;
    };

    if (isSubmitted) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-6">
                <Card className="max-w-md w-full text-center">
                    <CardContent className="pt-8 pb-6">
                        <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
                        <h2 className="text-2xl font-bold mb-2">Enquiry Submitted</h2>
                        <p className="text-muted-foreground mb-6">
                            Thank you for your interest in Veltro. Our team will review your requirements and be in touch within 2 business days.
                        </p>
                        <div className="flex flex-col gap-2">
                            <Link href="/pricing">
                                <Button variant="outline" className="w-full">
                                    Back to Pricing
                                </Button>
                            </Link>
                            <Link href="/">
                                <Button variant="ghost" className="w-full">
                                    Back to Home
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#0f172a] border-b border-white/10">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <Link href="/">
                        <img
                            src={logoChrome}
                            alt="Veltro"
                            className="h-8 md:h-10 object-contain cursor-pointer"
                        />
                    </Link>
                    <Link href="/pricing">
                        <Button variant="ghost" className="text-gray-300 hover:text-white gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Pricing
                        </Button>
                    </Link>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 container mx-auto px-4 py-8 md:py-12 max-w-4xl">
                <div className="text-center mb-8">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
                        Veltro System Requirements Enquiry
                    </h1>
                    <p className="text-muted-foreground">
                        Complete the sections below to help us understand your requirements.
                    </p>
                </div>

                {/* Tab Navigation */}
                <div className="mb-8">
                    <div className="flex flex-wrap justify-center gap-2 md:gap-1">
                        {formSections.map((section, index) => {
                            const Icon = section.icon;
                            const isActive = index === currentStep;
                            const isCompleted = index < currentStep;

                            return (
                                <button
                                    key={section.id}
                                    type="button"
                                    onClick={() => {
                                        // Allow clicking on completed or current steps
                                        if (index <= currentStep) {
                                            setCurrentStep(index);
                                        }
                                    }}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                                        isActive && "bg-primary text-primary-foreground shadow-md",
                                        isCompleted && "bg-primary/20 text-primary cursor-pointer hover:bg-primary/30",
                                        !isActive && !isCompleted && "bg-muted/50 text-muted-foreground cursor-not-allowed"
                                    )}
                                    disabled={index > currentStep}
                                >
                                    <Icon className="h-4 w-4" />
                                    <span className="hidden sm:inline">{section.title}</span>
                                    <span className="sm:hidden">{index + 1}</span>
                                </button>
                            );
                        })}
                    </div>
                    <div className="mt-4 h-1 bg-muted rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${((currentStep + 1) / formSections.length) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Form Section */}
                <form onSubmit={handleSubmit}>
                    <Card className="mb-8">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b">
                                {(() => {
                                    const Icon = currentSection.icon;
                                    return <Icon className="h-6 w-6 text-primary" />;
                                })()}
                                <div>
                                    <h2 className="text-xl font-semibold">{currentSection.fullTitle}</h2>
                                    <p className="text-sm text-muted-foreground">
                                        Step {currentStep + 1} of {formSections.length}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {currentSection.fields.map(renderField)}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Navigation Buttons */}
                    <div className="flex items-center justify-between">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handlePrev}
                            disabled={isFirstStep}
                            className="gap-2"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Previous
                        </Button>

                        {isLastStep ? (
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="gap-2 bg-primary hover:bg-primary/90"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <Send className="h-4 w-4" />
                                        Submit Enquiry
                                    </>
                                )}
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                onClick={handleNext}
                                className="gap-2"
                            >
                                Next
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </form>
            </main>

            {/* Footer */}
            <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
                <p>© {new Date().getFullYear()} Veltro. All rights reserved.</p>
            </footer>
        </div>
    );
}
