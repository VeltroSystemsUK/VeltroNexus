import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Send, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import logoChrome from "@assets/logo-chrome.png";

// Form specification based on lender_form_spec.json
const formSpec = {
    formTitle: "Veltro System Requirements Enquiry",
    version: "1.0",
    description: "Consultative enquiry form to gather technical requirements for a commercial lending platform quotation.",
    sections: [
        {
            id: "company_context",
            title: "1. Company & Project Context",
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
            title: "2. Loan Products & Workflow",
            fields: [
                { id: "loan_types", type: "textarea", label: "Loan Types to be supported", placeholder: "e.g., Bridging, Development..." },
                { id: "stages", type: "textarea", label: "Application Stages", placeholder: "Describe the lifecycle: Lead -> KYC -> Credit -> Offer..." }
            ]
        },
        {
            id: "users",
            title: "3. User Roles & Access",
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
            title: "4. Functional Modules",
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
            title: "5. Data & Compliance",
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
                    options: ["Standard UK/EEA Hosting", "Specific Requirement (Please Specify)"]
                }
            ]
        }
    ]
};

interface FormData {
    [key: string]: string | string[] | boolean | number;
}

export default function LenderEnquiry() {
    const [, navigate] = useLocation();
    const [formData, setFormData] = useState<FormData>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // Submit to backend
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
        switch (field.type) {
            case "text":
                return (
                    <div key={field.id} className="space-y-2">
                        <Label htmlFor={field.id} className="text-sm font-medium">
                            {field.label} {field.required && <span className="text-destructive">*</span>}
                        </Label>
                        <Input
                            id={field.id}
                            type="text"
                            required={field.required}
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
                            className="bg-background"
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
                            className="bg-background max-w-[200px]"
                        />
                    </div>
                );

            case "textarea":
                return (
                    <div key={field.id} className="space-y-2">
                        <Label htmlFor={field.id} className="text-sm font-medium">
                            {field.label}
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
                    <div key={field.id} className="flex items-center justify-between max-w-[400px]">
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
        <div className="min-h-screen bg-background">
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
            <main className="container mx-auto px-4 py-8 md:py-12 max-w-3xl">
                <div className="text-center mb-10">
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
                        {formSpec.formTitle}
                    </h1>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                        {formSpec.description}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {formSpec.sections.map((section) => (
                        <Card key={section.id} className="overflow-hidden">
                            <CardHeader className="bg-muted/50 pb-4">
                                <CardTitle className="text-lg">{section.title}</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
                                {section.fields.map(renderField)}
                            </CardContent>
                        </Card>
                    ))}

                    {/* Contact Info Section */}
                    <Card>
                        <CardHeader className="bg-muted/50 pb-4">
                            <CardTitle className="text-lg">6. Contact Information</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="contact_name" className="text-sm font-medium">
                                        Your Name <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="contact_name"
                                        type="text"
                                        required
                                        value={(formData.contact_name as string) || ""}
                                        onChange={(e) => handleChange("contact_name", e.target.value)}
                                        className="bg-background"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="contact_email" className="text-sm font-medium">
                                        Email Address <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="contact_email"
                                        type="email"
                                        required
                                        value={(formData.contact_email as string) || ""}
                                        onChange={(e) => handleChange("contact_email", e.target.value)}
                                        className="bg-background"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contact_phone" className="text-sm font-medium">
                                    Phone Number
                                </Label>
                                <Input
                                    id="contact_phone"
                                    type="tel"
                                    value={(formData.contact_phone as string) || ""}
                                    onChange={(e) => handleChange("contact_phone", e.target.value)}
                                    className="bg-background max-w-[300px]"
                                    placeholder="+44 (0) XXX XXX XXXX"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="additional_notes" className="text-sm font-medium">
                                    Additional Requirements or Questions
                                </Label>
                                <Textarea
                                    id="additional_notes"
                                    value={(formData.additional_notes as string) || ""}
                                    onChange={(e) => handleChange("additional_notes", e.target.value)}
                                    className="bg-background min-h-[100px]"
                                    placeholder="Any specific requirements, questions, or timeline constraints..."
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Submit */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-end pt-4">
                        <Link href="/pricing">
                            <Button type="button" variant="outline" className="w-full sm:w-auto">
                                Cancel
                            </Button>
                        </Link>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90"
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
                    </div>
                </form>
            </main>

            {/* Footer */}
            <footer className="border-t border-border mt-16 py-8 text-center text-sm text-muted-foreground">
                <p>© {new Date().getFullYear()} Veltro. All rights reserved.</p>
            </footer>
        </div>
    );
}
