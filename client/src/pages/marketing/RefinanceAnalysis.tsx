import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Check, TrendingUp, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function RefinanceAnalysis() {
    const [, setLocation] = useLocation();
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        // Retrieve data from storage (passed from Landing Page)
        const stored = localStorage.getItem("refinanceAnalysis");
        if (stored) {
            setData(JSON.parse(stored));
        } else {
            // Redirect back if no data found
            setLocation("/refinance");
        }
    }, [setLocation]);

    if (!data) return null;

    const { analysis, companyName } = data;

    // 12-Month Projection Data
    const currentMonthly = (analysis.monthlySavings / 0.6) + analysis.newMonthlyPayment; // Reverse engineer roughly or use passed inputs if available. 
    // Actually, let's use the savings to derive. Savings = Current - New.
    // We don't have exact inputs here unless we passed them. 
    // Let's assume passed data includes inputs.
    // If not, we can infer:
    const monthlySavings = analysis.monthlySavings;
    const newPayment = analysis.newMonthlyPayment;
    const currentPayment = newPayment + monthlySavings;

    const chartData = [
        { name: "Current Situation", amount: currentPayment * 12, color: "#ef4444" }, // Red
        { name: "2026 Refinance", amount: newPayment * 12, color: "#10b981" }, // Emerald
    ];

    const yearlySavings = monthlySavings * 12;

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 py-12 px-6">
            <div className="max-w-5xl mx-auto">

                {/* Header */}
                <div className="text-center mb-12">
                    <Badge className="mb-4 bg-emerald-100 text-emerald-800 hover:bg-emerald-200">
                        <Check className="w-3 h-3 mr-1" /> Pre-Qualified Analysis
                    </Badge>
                    <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-4">
                        Your Cash Flow Forecast
                    </h1>
                    <p className="text-xl text-slate-500">
                        Based on the data provided for <span className="font-semibold text-emerald-600">{companyName}</span>.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">

                    {/* Main Chart Card */}
                    <div className="md:col-span-8">
                        <Card className="shadow-xl border-slate-200 h-full">
                            <CardHeader>
                                <CardTitle>12-Month Cash Flow Impact</CardTitle>
                                <CardDescription>Total debt service costs over the next year.</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[400px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} layout="vertical" margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12, fontWeight: 600 }} />
                                        <Tooltip formatter={(value) => `£${Number(value).toLocaleString()}`} cursor={{ fill: 'transparent' }} />
                                        <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={60}>
                                            {chartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                            <CardFooter className="bg-slate-50 border-t border-slate-100 p-6">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-emerald-100 text-emerald-700 rounded-lg">
                                        <TrendingUp className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-emerald-700">£{yearlySavings.toLocaleString()} Year 1 Benefit</h4>
                                        <p className="text-sm text-slate-600 mt-1">
                                            By switching to a stable repayment structure, you release significant working capital back into the business immediately.
                                        </p>
                                    </div>
                                </div>
                            </CardFooter>
                        </Card>
                    </div>

                    {/* Sidebar Stats & CTA */}
                    <div className="md:col-span-4 space-y-6">

                        {/* Critical Alert */}
                        <Card className="shadow-lg border-red-200 bg-red-50">
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-2 text-red-700 font-bold mb-2">
                                    <AlertTriangle className="w-5 h-5" /> Current Trajectory
                                </div>
                                <p className="text-sm text-red-600/90 mb-4">
                                    Continuing with high-rate short-term debt significantly impacts your EBITDA and valuation.
                                </p>
                                <div className="text-2xl font-bold text-red-700">
                                    -£{currentPayment.toLocaleString()}/mo
                                </div>
                                <div className="text-xs text-red-500 font-medium uppercase mt-1">Cash Burn</div>
                            </CardContent>
                        </Card>

                        {/* The Solution */}
                        <Card className="shadow-xl border-emerald-200 bg-white relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
                            <CardHeader>
                                <CardTitle className="text-emerald-900">2026 Refinancing Plan</CardTitle>
                                <CardDescription>Secure, long-term stability.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between items-center py-2 border-b border-emerald-50">
                                    <span className="text-slate-500 text-sm">New Payment</span>
                                    <span className="font-bold text-emerald-700">£{Math.round(newPayment).toLocaleString()}/mo</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-emerald-50">
                                    <span className="text-slate-500 text-sm">Term</span>
                                    <span className="font-bold text-emerald-700">60 Months</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-emerald-50">
                                    <span className="text-slate-500 text-sm">Rate (Est.)</span>
                                    <span className="font-bold text-emerald-700">~8.5%</span>
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-lg shadow-lg shadow-emerald-200" asChild>
                                    <Link href="/refinance/apply">
                                        Start Application <ArrowRight className="ml-2 w-4 h-4" />
                                    </Link>
                                </Button>
                            </CardFooter>
                        </Card>

                        <p className="text-center text-xs text-slate-400">
                            No credit check required to start application.
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
}
