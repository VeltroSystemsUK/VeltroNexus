import React, { useState } from 'react';
import {
    ShieldCheck,
    Cpu,
    Zap,
    CheckCircle2,
    Target,
    Clock,
    Wrench,
    FileText,
    Download,
    CreditCard
} from 'lucide-react';
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    ResponsiveContainer
} from 'recharts';
import { DeploymentReadinessReport } from '../../types';

interface AresDeploymentReportProps {
    report: DeploymentReadinessReport;
    agentName: string;
    onClose?: () => void;
    onDeploy?: () => void;
}

export const AresDeploymentReport: React.FC<AresDeploymentReportProps> = ({
    report,
    agentName,
    onClose,
    onDeploy
}) => {
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const chartData = [
        { subject: 'Accuracy', A: report.metrics?.accuracy || 0, fullMark: 100 },
        { subject: 'Tone', A: report.metrics?.tone || 0, fullMark: 100 },
        { subject: 'Speed', A: report.metrics?.speed || 0, fullMark: 100 },
        { subject: 'Tool Use', A: report.metrics?.toolUse || 0, fullMark: 100 },
    ];

    const handleDownloadAssessment = () => {
        setIsDownloading(true);

        // Generate assessment report content
        const assessmentContent = `
═══════════════════════════════════════════════════════════════
          [pAGENTi] ARES DEPLOYMENT READINESS REPORT
═══════════════════════════════════════════════════════════════

Digital Associate: ${agentName}
Certification Status: ARES CERTIFIED
Deployment Date: ${new Date().toLocaleDateString('en-GB')}
Logic Fidelity Score: ${report.metrics?.accuracy || 0}%

───────────────────────────────────────────────────────────────
1. EXECUTIVE SUMMARY
───────────────────────────────────────────────────────────────

${report.executiveSummary}

───────────────────────────────────────────────────────────────
2. MASTERED KNOWLEDGE DOMAINS
───────────────────────────────────────────────────────────────

${report.masteredDomains.map((d, i) => `${i + 1}. ${d.domain}
   ${d.details}`).join('\n\n')}

───────────────────────────────────────────────────────────────
3. GUARDRAIL MANIFESTO
───────────────────────────────────────────────────────────────

${report.guardrailManifesto.map((g, i) => `${i + 1}. ${g.rule}: ${g.constraint}`).join('\n')}

───────────────────────────────────────────────────────────────
4. PERFORMANCE METRICS
───────────────────────────────────────────────────────────────

Accuracy:  ${report.metrics?.accuracy || 0}%
Tone:      ${report.metrics?.tone || 0}%
Speed:     ${report.metrics?.speed || 0}%
Tool Use:  ${report.metrics?.toolUse || 0}%

───────────────────────────────────────────────────────────────
5. VALIDATION CASE STUDY
───────────────────────────────────────────────────────────────

Scenario: ${report.simulationResults.scenario}
Result: ${report.simulationResults.result}
Accuracy: ${report.simulationResults.accuracy}

───────────────────────────────────────────────────────────────
ARCHITECT'S NOTE
───────────────────────────────────────────────────────────────

"${report.architectNote}"

— Ares, Master Architect

═══════════════════════════════════════════════════════════════
          © 2026 Pagenti Platform | ARES Protocol v2.4
═══════════════════════════════════════════════════════════════
        `;

        // Create and download the file
        const blob = new Blob([assessmentContent], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ARES_Assessment_${agentName}_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        setTimeout(() => setIsDownloading(false), 1000);
    };

    const handlePaymentAndDeploy = async () => {
        setIsProcessingPayment(true);

        try {
            // TODO: Integrate with Stripe/Revolut payment gateway
            // For now, we'll simulate the payment flow

            // Option 1: Stripe Integration (recommended)
            // const stripe = await loadStripe(process.env.VITE_STRIPE_PUBLISHABLE_KEY);
            // const response = await fetch('/api/create-checkout-session', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({ agentName, price: 99900 }) // $999 in cents
            // });
            // const session = await response.json();
            // await stripe.redirectToCheckout({ sessionId: session.id });

            // Option 2: Revolut Integration
            // window.location.href = `/api/revolut-checkout?agent=${agentName}`;

            // Temporary: Show alert for payment integration
            alert(`Payment Gateway Integration Required\n\nTo deploy ${agentName}, please integrate:\n\n1. Stripe Checkout Session\n2. Revolut Payment Widget\n\nAgent will be deployed after successful payment.`);

            // After successful payment, call the deploy callback
            if (onDeploy) {
                onDeploy();
            }
        } catch (error) {
            console.error('Payment failed:', error);
            alert('Payment processing failed. Please try again.');
        } finally {
            setIsProcessingPayment(false);
        }
    };

    return (
        <div className="bg-white rounded-[2.5rem] border border-gray-200 overflow-hidden shadow-2xl max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-700">
            {/* Dark Professional Header */}
            <div className="bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900 p-10 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-5">
                    <Cpu size={200} />
                </div>

                {/* Gold/Holographic Seal */}
                <div className="absolute top-8 right-8 z-20">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-200 via-amber-500 to-amber-700 p-0.5 shadow-2xl animate-pulse">
                        <div className="w-full h-full rounded-full bg-indigo-950 flex flex-col items-center justify-center text-center p-1 border border-amber-300/30">
                            <ShieldCheck size={24} className="text-amber-400 mb-0.5" />
                            <span className="text-[8px] font-black text-amber-200 uppercase tracking-tighter leading-none">Ares Certified</span>
                            <span className="text-[10px] font-black text-white uppercase tracking-tight">2026</span>
                        </div>
                    </div>
                </div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-indigo-600 p-2.5 rounded-2xl">
                            <FileText size={24} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black tracking-tight">[pAGENTi] Deployment Readiness Report</h2>
                            <p className="text-indigo-400 font-mono text-xs uppercase tracking-[0.4em] mt-1">Status: Operational Logic Finalized</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-10">
                        <div className="border-l border-white/10 pl-4">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Associate Name</p>
                            <p className="text-lg font-bold text-white">{agentName}</p>
                        </div>
                        <div className="border-l border-white/10 pl-4">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Certification Status</p>
                            <p className="text-lg font-bold text-emerald-400">Certified</p>
                        </div>
                        <div className="border-l border-white/10 pl-4">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Logic Fidelity</p>
                            <p className="text-lg font-bold text-white">{report.metrics?.accuracy || 0}%</p>
                        </div>
                        <div className="border-l border-white/10 pl-4">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Deployment Date</p>
                            <p className="text-lg font-bold text-white">{new Date().toLocaleDateString('en-GB')}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-10 grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* Left Column: Summary & Domains */}
                <div className="lg:col-span-2 space-y-10">
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-black text-indigo-600 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Target size={16} /> 1. Executive Summary
                            </h3>
                            <button
                                onClick={handleDownloadAssessment}
                                disabled={isDownloading}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-wait"
                            >
                                <Download size={14} className={isDownloading ? 'animate-bounce' : ''} />
                                {isDownloading ? 'Generating...' : 'Download Assessment'}
                            </button>
                        </div>
                        <p className="text-gray-600 leading-relaxed font-medium">
                            {report.executiveSummary}
                        </p>
                    </section>

                    <section>
                        <h3 className="text-sm font-black text-indigo-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                            <Cpu size={16} /> 2. Mastered Knowledge Domains
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {report.masteredDomains.map((domain, i) => (
                                <div key={i} className="bg-gray-50 p-5 rounded-2xl border border-gray-100 flex gap-4 items-start">
                                    <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 text-indigo-600">
                                        <Zap size={16} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-gray-900 uppercase tracking-tight mb-1">{domain.domain}</p>
                                        <p className="text-[11px] text-gray-500 leading-normal font-medium">{domain.details}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section>
                        <h3 className="text-sm font-black text-indigo-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                            <ShieldCheck size={16} /> 3. The Guardrail Manifesto
                        </h3>
                        <div className="space-y-3">
                            {report.guardrailManifesto.map((item, i) => (
                                <div key={i} className="flex gap-4 items-center bg-indigo-50/30 p-4 rounded-xl border border-indigo-100/50">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                                    <div>
                                        <span className="text-xs font-black text-indigo-900 uppercase mr-2">{item.rule}:</span>
                                        <span className="text-xs text-gray-600 font-medium">{item.constraint}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Right Column: Visualization & Seal */}
                <div className="space-y-8">
                    <div className="bg-gray-50 p-8 rounded-[2rem] border border-gray-100">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 text-center">Logic Strength Analysis</h3>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                                    <PolarGrid stroke="#e5e7eb" />
                                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 800, fill: '#6b7280' }} />
                                    <Radar
                                        name="Agent"
                                        dataKey="A"
                                        stroke="#4f46e5"
                                        fill="#4f46e5"
                                        fillOpacity={0.6}
                                    />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-indigo-950 p-8 rounded-[2rem] text-white overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Zap size={80} />
                        </div>
                        <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4">Note from the Architect</h3>
                        <p className="text-xs italic leading-relaxed text-indigo-100/80 mb-6 font-medium">
                            "{report.architectNote}"
                        </p>
                        <p className="text-xs font-black uppercase tracking-widest">— Ares</p>
                    </div>

                    <button
                        onClick={handlePaymentAndDeploy}
                        disabled={isProcessingPayment}
                        className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all shadow-2xl hover:shadow-indigo-500/50 hover:scale-105 disabled:opacity-50 disabled:cursor-wait disabled:hover:scale-100 relative overflow-hidden group"
                    >
                        {/* Animated background on hover */}
                        <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />

                        <CreditCard size={20} className={`relative z-10 ${isProcessingPayment ? 'animate-pulse' : 'group-hover:scale-110 transition-transform'}`} />
                        <span className="relative z-10">
                            {isProcessingPayment ? 'Processing Payment...' : 'Initialise & Deploy Associate'}
                        </span>
                    </button>

                    <p className="text-center text-[10px] text-gray-400 mt-3 font-medium">
                        Secure payment via Stripe • One-time fee • Full deployment access
                    </p>
                </div>
            </div>

            {/* Simulation Footer */}
            <div className="bg-gray-50 p-10 border-t border-gray-100">
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
                        <CheckCircle2 size={18} />
                    </div>
                    <h3 className="text-sm font-black text-emerald-900 uppercase tracking-[0.2em]">4. Validation Case Study (Simulation Results)</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-2">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Scenario Analysis</p>
                        <p className="text-sm font-bold text-gray-900 mb-2">{report.simulationResults.scenario}</p>
                        <p className="text-xs text-gray-600 font-medium leading-relaxed">{report.simulationResults.result}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Correlation Accuracy</p>
                        <p className="text-4xl font-black text-emerald-600 font-mono">{report.simulationResults.accuracy}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
