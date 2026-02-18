import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation } from "wouter";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Check, ArrowRight, Loader2, TrendingUp, ShieldCheck, Banknote } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function RefinanceLanding() {
    const [, setLocation] = useLocation();
    const [step, setStep] = useState<"calculator" | "capture" | "results">("calculator");
    const [calcData, setCalcData] = useState({
        currentDebt: 100000,
        monthlyPayment: 3500,
        estimatedRate: 15
    });
    const [leadResult, setLeadResult] = useState<any>(null);
    const { toast } = useToast();

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();

    // Simple local calculation for the "teaser"
    const estimatedSavings = Math.max(0, calcData.monthlyPayment - (calcData.currentDebt * 0.021)); // Rough 8.5% over 5 years approx monthly factor

    const onSubmit = async (data: any) => {
        try {
            const payload = {
                ...data,
                currentDebt: calcData.currentDebt,
                monthlyPayment: calcData.monthlyPayment,
                estimatedRate: calcData.estimatedRate
            };

            const res = await fetch("/api/inbound/refinance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error("Submission failed");

            const result = await res.json();

            // Save analysis data for the next page
            localStorage.setItem("refinanceAnalysis", JSON.stringify({
                ...payload,
                analysis: result.analysis,
                leadId: result.leadId
            }));

            // Redirect to Analysis Page
            setLocation("/refinance/analysis");

            toast({
                title: "Analysis Complete",
                description: "Redirecting to your full report..."
            });

        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to process request. Please try again.",
                variant: "destructive"
            });
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
            {/* Hero Section */}
            <header className="bg-slate-900 text-white pt-20 pb-32 px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <Badge className="mb-6 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-1 text-sm font-medium rounded-full">
                        2026 Refinancing Initiative
                    </Badge>
                    <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
                        Eliminate Expensive Debts. <br />
                        <span className="text-indigo-400">Set Your Business Free...</span>
                    </h1>
                    <p className="text-xl md:text-2xl text-slate-300 max-w-2xl mx-auto mb-10">
                        Stop suffering in silence. Let us help you transition your high-interest, short-term debts to a stable 5 year term loan. Recover your cashflow and create a brighter future.
                    </p>
                </div>
            </header>

            {/* Main interactive area */}
            <main className="max-w-5xl mx-auto px-6 -mt-24 relative z-10 pb-20">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">

                    {/* Left Column: Context/Benefits */}
                    <div className="md:col-span-5 space-y-6 pt-10">
                        <Card className="bg-white/95 backdrop-blur shadow-xl border-slate-200">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <ShieldCheck className="h-5 w-5 text-indigo-600" />
                                    Why Refinance Now?
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex gap-3">
                                    <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-sm">Escaping the Business Debt Trap</h4>
                                        <p className="text-xs text-slate-500 mt-1">Get the "Pay Day" Business Loans OUT of your business.</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                        <Banknote className="h-4 w-4 text-blue-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-sm">Cash Flow Recovery</h4>
                                        <p className="text-xs text-slate-500 mt-1">Lower monthly payments immediately by extending term to 60 months.</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="bg-indigo-900 rounded-xl p-6 text-white shadow-lg">
                            <div className="text-sm font-medium text-indigo-200 uppercase tracking-wider mb-1">Live Market Data</div>
                            <div className="text-3xl font-bold">3.75%</div>
                            <div className="text-sm text-indigo-100 mt-1">Current BoE Base Rate (Feb 2026)</div>
                            <div className="mt-4 pt-4 border-t border-indigo-800 text-xs text-indigo-300">
                                Refinancing window is open for profitable UK SMEs with at least 2 years trading history.
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Calculator / Form */}
                    <div className="md:col-span-7">
                        <AnimatePresence mode="wait">
                            {step === "calculator" && (
                                <motion.div
                                    key="calculator"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                >
                                    <Card className="shadow-2xl border-indigo-100 overflow-hidden">
                                        <div className="h-2 bg-gradient-to-r from-indigo-500 to-purple-600 w-full" />
                                        <CardHeader>
                                            <CardTitle>Interactive Debt Audit</CardTitle>
                                            <CardDescription>Estimate your monthly savings instantly.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-8">

                                            {/* Q1: Debt Amount */}
                                            <div className="space-y-4">
                                                <div className="flex justify-between">
                                                    <Label>Total Outstanding Short-Term Debt</Label>
                                                    <span className="font-bold text-indigo-700">£{calcData.currentDebt.toLocaleString()}</span>
                                                </div>
                                                <Slider
                                                    value={[calcData.currentDebt]}
                                                    min={10000}
                                                    max={500000}
                                                    step={5000}
                                                    onValueChange={(val) => setCalcData({ ...calcData, currentDebt: val[0] })}
                                                    className="py-2"
                                                />
                                            </div>

                                            {/* Q2: Monthly Payment */}
                                            <div className="space-y-4">
                                                <div className="flex justify-between">
                                                    <Label>Current Combined Monthly Payment</Label>
                                                    <span className="font-bold text-red-600">£{calcData.monthlyPayment.toLocaleString()}/mo</span>
                                                </div>
                                                <Slider
                                                    value={[calcData.monthlyPayment]}
                                                    min={1000}
                                                    max={50000}
                                                    step={500}
                                                    onValueChange={(val) => setCalcData({ ...calcData, monthlyPayment: val[0] })}
                                                    className="py-2"
                                                />
                                                <p className="text-xs text-slate-400">Includes loan repayments, MCAs, bridging costs.</p>
                                            </div>

                                            {/* Q3: Teaser Result */}
                                            <div className="bg-slate-50 rounded-lg p-6 border border-slate-100 text-center">
                                                <div className="text-sm text-slate-500 font-medium uppercase tracking-wide">Potential Monthly Recovery</div>
                                                <div className="text-4xl font-extrabold text-emerald-600 mt-2">
                                                    ~£{Math.round(estimatedSavings).toLocaleString()}
                                                    <span className="text-lg text-emerald-600/60 font-medium">/mo</span>
                                                </div>
                                                <p className="text-xs text-slate-400 mt-2">*Based on typical 5-year secured facility rates.</p>
                                            </div>

                                        </CardContent>
                                        <CardFooter>
                                            <Button
                                                className="w-full h-12 text-lg bg-indigo-600 hover:bg-indigo-700"
                                                onClick={() => setStep("capture")}
                                            >
                                                Get My Official Report <ArrowRight className="ml-2 h-4 w-4" />
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                </motion.div>
                            )}

                            {step === "capture" && (
                                <motion.div
                                    key="capture"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                >
                                    <Card className="shadow-2xl border-indigo-100">
                                        <CardHeader>
                                            <CardTitle>Unlock Your Cash Flow Report</CardTitle>
                                            <CardDescription>We'll generate a full breakdown of your refinancing options.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="companyName">Company Name</Label>
                                                    <Input id="companyName" {...register("companyName", { required: true })} placeholder="e.g. Acme Trading Ltd" />
                                                    {errors.companyName && <span className="text-red-500 text-xs">Required</span>}
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor="contactName">Your Name</Label>
                                                    <Input id="contactName" {...register("contactName", { required: true })} placeholder="e.g. John Smith" />
                                                    {errors.contactName && <span className="text-red-500 text-xs">Required</span>}
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor="email">Work Email</Label>
                                                    <Input id="email" type="email" {...register("email", { required: true })} placeholder="e.g. john@acme.com" />
                                                    {errors.email && <span className="text-red-500 text-xs">Required</span>}
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor="phone">Phone (Optional)</Label>
                                                    <Input id="phone" type="tel" {...register("phone")} placeholder="07700 900000" />
                                                </div>

                                                <Button type="submit" className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 h-10" disabled={isSubmitting}>
                                                    {isSubmitting ? (
                                                        <>
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...
                                                        </>
                                                    ) : (
                                                        "View My Savings Analysis"
                                                    )}
                                                </Button>
                                            </form>
                                        </CardContent>
                                        <CardFooter className="justify-center text-xs text-slate-400 text-center">
                                            Data processed securely. No credit check required for initial report.
                                        </CardFooter>
                                    </Card>
                                </motion.div>
                            )}

                            {step === "results" && leadResult && (
                                <motion.div
                                    key="results"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                >
                                    <Card className="shadow-2xl border-emerald-100 bg-white">
                                        <div className="h-2 bg-emerald-500 w-full" />
                                        <CardHeader className="text-center pb-2">
                                            <div className="mx-auto h-12 w-12 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                                                <Check className="h-6 w-6 text-emerald-600" />
                                            </div>
                                            <CardTitle className="text-2xl text-emerald-800">Analysis Complete</CardTitle>
                                            <CardDescription>Here is what we found for {leadResult.analysis && "your business"}.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-6 pt-6">

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                                    <div className="text-xs font-semibold text-slate-500 uppercase">Monthly Savings</div>
                                                    <div className="text-2xl font-bold text-emerald-600">
                                                        £{Math.round(leadResult.analysis.monthlySavings).toLocaleString()}
                                                    </div>
                                                </div>
                                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                                    <div className="text-xs font-semibold text-slate-500 uppercase">5-Year Capital Gain</div>
                                                    <div className="text-2xl font-bold text-indigo-600">
                                                        £{Math.round(leadResult.analysis.fiveYearSavings).toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                                                <div className="flex justify-between items-center mb-2">
                                                    <div className="font-semibold text-indigo-900">Valuation Impact</div>
                                                    <Badge variant="secondary" className="bg-white text-indigo-600">Hidden Benefit</Badge>
                                                </div>
                                                <p className="text-sm text-indigo-700 mb-2">
                                                    Improving your DSCR by this amount could increase your business valuation by approximately:
                                                </p>
                                                <div className="text-3xl font-extrabold text-indigo-700 text-center py-2">
                                                    +£{Math.round(leadResult.analysis.valuationBoost).toLocaleString()}
                                                </div>
                                            </div>

                                            <p className="text-sm text-center text-slate-500 max-w-sm mx-auto">
                                                Our Capital Strategist has been notified and will prepare a full proposal.
                                                Check your email ({leadResult.email}) shortly.
                                            </p>

                                        </CardContent>
                                        <CardFooter>
                                            <Button variant="outline" className="w-full" asChild>
                                                <Link href="/">Return to Veltro Home</Link>
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="bg-slate-900 text-slate-400 py-12 text-center text-sm">
                <div className="max-w-4xl mx-auto px-6">
                    <p>&copy; 2026 Veltro Capital. All rights reserved.</p>
                    <p className="mt-2">Authorised and regulated by the Financial Conduct Authority.</p>
                </div>
            </footer>
        </div>
    );
}
