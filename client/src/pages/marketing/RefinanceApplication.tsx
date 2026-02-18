import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation } from "wouter";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, Building2, User, PoundSterling } from "lucide-react";

export default function RefinanceApplication() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const [isSubmitted, setIsSubmitted] = useState(false);

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();

    const onSubmit = async (data: any) => {
        try {
            // Retrieve leadId from localStorage to link the application
            const stored = localStorage.getItem("refinanceAnalysis");
            const leadId = stored ? JSON.parse(stored).leadId : null;

            const res = await fetch("/api/inbound/application", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...data,
                    turnover: Number(data.turnover),
                    profit: Number(data.profit),
                    loanAmount: Number(data.loanAmount),
                    leadId: leadId ? Number(leadId) : undefined
                }),
            });

            if (!res.ok) throw new Error("Submission failed");

            setIsSubmitted(true);
            toast({
                title: "Application Received",
                description: "Your priority application has been forwarded to underwriting."
            });
        } catch (error) {
            toast({
                title: "Submission Error",
                description: "There was a problem submitting your application. Please try again.",
                variant: "destructive"
            });
        }
    };

    if (isSubmitted) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <Card className="max-w-md w-full shadow-2xl border-emerald-100">
                    <CardHeader className="text-center">
                        <div className="mx-auto h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                        </div>
                        <CardTitle className="text-2xl text-emerald-800">Application Submitted</CardTitle>
                        <CardDescription>
                            Reference: #REF-2026-{Math.floor(Math.random() * 10000)}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center text-slate-600">
                        <p className="mb-4">
                            Thank you for providing your details. Our underwriting team is reviewing your case.
                        </p>
                        <p>
                            We will contact you within <strong>2 business hours</strong> to finalize your term sheet.
                        </p>
                    </CardContent>
                    <CardFooter>
                        <Button asChild className="w-full bg-slate-900 text-white hover:bg-slate-800">
                            <Link href="/">Return to Home</Link>
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-6 font-sans">
            <div className="max-w-3xl mx-auto">

                <div className="mb-8">
                    <Link href="/" className="text-sm text-indigo-600 hover:underline mb-4 block">&larr; Back to Home</Link>
                    <h1 className="text-3xl font-bold text-slate-900">Priority Refinance Application</h1>
                    <p className="text-slate-500 mt-2">Complete this form to secure your 2026 rate.</p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)}>

                    {/* Company Info */}
                    <Card className="mb-6 shadow-md border-slate-200">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Building2 className="w-5 h-5 text-indigo-500" /> Company Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="companyName">Company Name</Label>
                                <Input id="companyName" {...register("companyName", { required: true })} placeholder="Legal Entity Name" />
                                {errors.companyName && <span className="text-red-500 text-xs">Required</span>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="companyNumber">Company Number</Label>
                                <Input id="companyNumber" {...register("companyNumber")} placeholder="8 digits (e.g. 12345678)" />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="address">Registered Address</Label>
                                <Input id="address" {...register("address")} placeholder="Full Postcode" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Director Info */}
                    <Card className="mb-6 shadow-md border-slate-200">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <User className="w-5 h-5 text-indigo-500" /> Director Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="directorName">Director Name</Label>
                                <Input id="directorName" {...register("directorName", { required: true })} placeholder="Full Legal Name" />
                                {errors.directorName && <span className="text-red-500 text-xs">Required</span>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="dob">Date of Birth</Label>
                                <Input id="dob" type="date" {...register("dob")} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <Input id="email" type="email" {...register("email", { required: true })} />
                                {errors.email && <span className="text-red-500 text-xs">Required</span>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Mobile Number</Label>
                                <Input id="phone" type="tel" {...register("phone", { required: true })} />
                                {errors.phone && <span className="text-red-500 text-xs">Required</span>}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Financials */}
                    <Card className="mb-8 shadow-md border-slate-200">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <PoundSterling className="w-5 h-5 text-indigo-500" /> Financial Overview
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="turnover">Annual Turnover (Last Year)</Label>
                                <Input id="turnover" type="number" {...register("turnover", { required: true })} placeholder="£" />
                                {errors.turnover && <span className="text-red-500 text-xs">Required</span>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="profit">Net Profit (Last Year)</Label>
                                <Input id="profit" type="number" {...register("profit")} placeholder="£" />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="loanAmount">Requested Loan Amount</Label>
                                <Input id="loanAmount" type="number" {...register("loanAmount", { required: true })} placeholder="£" />
                                {errors.loanAmount && <span className="text-red-500 text-xs">Required</span>}
                            </div>
                        </CardContent>
                    </Card>

                    <Button type="submit" size="lg" className="w-full bg-indigo-600 hover:bg-indigo-700 h-14 text-lg font-bold shadow-lg shadow-indigo-200" disabled={isSubmitting}>
                        {isSubmitting ? (
                            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Submitting Application...</>
                        ) : (
                            "Submit Priority Application"
                        )}
                    </Button>
                    <p className="text-center text-xs text-slate-400 mt-4">
                        By submitting this form, you agree to our Terms of Service and Privacy Policy. we may authorize a soft credit search.
                    </p>

                </form>
            </div>
        </div>
    );
}
