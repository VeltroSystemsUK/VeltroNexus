import { useState } from "react";
import { Link } from "wouter";
import { Check } from "lucide-react";

export default function Pricing() {
    const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
    const isAnnual = billingInterval === "annual";

    return (
        <div className="min-h-screen bg-background text-foreground font-sans">
            {/* Navigation - keeping it simple/implied or matching app shell */}

            {/* Hero Section */}
            <section className="relative overflow-hidden pt-20 pb-16 px-6 text-center">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[radial-gradient(ellipse_at_center,hsl(35,92%,50%,0.08)_0%,transparent_70%)] pointer-events-none" />

                <div className="relative z-10 max-w-[700px] mx-auto">
                    <h1 className="text-5xl font-extrabold tracking-tight mb-4 bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">
                        Simple, Transparent Pricing
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-[560px] mx-auto">
                        Start managing your commercial lending pipeline with Veltro. Select the plan that fits your needs.
                    </p>

                    <div className="flex items-center justify-center gap-3 mt-8">
                        <span className={`text-sm font-medium transition-colors ${!isAnnual ? "text-foreground" : "text-muted-foreground"}`}>
                            Monthly
                        </span>
                        <button
                            onClick={() => setBillingInterval(isAnnual ? "monthly" : "annual")}
                            className={`w-12 h-[26px] bg-muted rounded-full relative transition-colors border border-border cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 ${isAnnual ? "after:translate-x-[22px]" : "after:translate-x-[2px]"}`}
                        >
                            <span className="absolute top-[2px] left-0 w-5 h-5 bg-primary rounded-full shadow-sm transition-transform duration-200" />
                        </button>
                        <span className={`text-sm font-medium transition-colors ${isAnnual ? "text-foreground" : "text-muted-foreground"}`}>
                            Annual
                        </span>
                        <span className="bg-success/15 text-success px-2.5 py-1 rounded-full text-xs font-semibold border border-success/30">
                            Save 20%
                        </span>
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section className="px-6 pb-20 max-w-[1280px] mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-start">

                    {/* Broker */}
                    <div className="bg-card border border-card-border rounded-lg p-7 relative transition-all duration-200 hover:border-muted-foreground hover:-translate-y-0.5 hover:shadow-lg">
                        <div className="text-[11px] font-semibold uppercase tracking-widest text-primary mb-1">Starter</div>
                        <div className="text-2xl font-bold tracking-tight mb-1.5">Broker</div>
                        <div className="text-[13px] text-muted-foreground mb-5 leading-normal">
                            Perfect for independent brokers building their pipeline
                        </div>

                        <div className="mb-5">
                            <div className="flex items-baseline gap-0.5">
                                <span className="text-xl font-semibold text-foreground">£</span>
                                <span className="text-[2.75rem] font-extrabold tracking-tight leading-none text-foreground">
                                    {isAnnual ? "119" : "149"}
                                </span>
                                <span className="text-sm text-muted-foreground ml-1">/month</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1.5">
                                50 prospects included • £5 per additional
                            </div>
                        </div>

                        <div className="w-full mb-5">
                            <button className="w-full py-3 px-5 rounded-md font-semibold text-sm bg-transparent text-foreground border border-border hover:bg-white/5 hover:border-muted-foreground transition-all">
                                Start 14-Day Free Trial
                            </button>
                        </div>
                        <p className="text-center text-[11px] text-muted-foreground -mt-3 mb-4">
                            No credit card required
                        </p>

                        <ul className="space-y-2 border-t border-border pt-4">
                            {[
                                { text: "50 prospects included", highlight: "50 prospects" },
                                { text: "Companies House integration" },
                                { text: "Full due diligence suite" },
                                { text: "Contact management" },
                                { text: "Activity tracking & CRM" },
                                { text: "PDF report generation" },
                                { text: "Email support" },
                            ].map((item, i) => (
                                <li key={i} className="flex items-start gap-2.5 text-[13px] text-foreground">
                                    <span className="w-[18px] h-[18px] bg-success/15 rounded-full flex items-center justify-center shrink-0 mt-px">
                                        <Check className="w-2.5 h-2.5 text-success stroke-[3]" />
                                    </span>
                                    <span>
                                        {item.highlight ? (
                                            <>
                                                <span className="font-semibold text-primary">{item.highlight}</span>{" "}
                                                {item.text.replace(item.highlight, "").trim()}
                                            </>
                                        ) : (
                                            item.text
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Team */}
                    <div className="bg-card border border-primary rounded-lg p-7 relative transition-all duration-200 hover:border-primary hover:-translate-y-0.5 shadow-[0_0_0_1px_hsl(35,92%,50%),0_14px_40px_rgba(0,0,0,0.5)]">
                        <div className="absolute -top-[11px] left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">
                            Most Popular
                        </div>
                        <div className="text-[11px] font-semibold uppercase tracking-widest text-primary mb-1">Professional</div>
                        <div className="text-2xl font-bold tracking-tight mb-1.5">Team</div>
                        <div className="text-[13px] text-muted-foreground mb-5 leading-normal">
                            For growing sales teams and brokerages
                        </div>

                        <div className="mb-5">
                            <div className="flex items-baseline gap-0.5">
                                <span className="text-xl font-semibold text-foreground">£</span>
                                <span className="text-[2.75rem] font-extrabold tracking-tight leading-none text-foreground">
                                    {isAnnual ? "439" : "549"}
                                </span>
                                <span className="text-sm text-muted-foreground ml-1">/month</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1.5">
                                5 seats • 250 prospects • £3 per additional
                            </div>
                        </div>

                        <div className="w-full mb-5">
                            <button className="w-full py-3 px-5 rounded-md font-semibold text-sm bg-primary text-primary-foreground hover:brightness-110 hover:-translate-y-px transition-all shadow-sm">
                                Start 14-Day Team Pilot
                            </button>
                        </div>

                        <ul className="space-y-2 pt-4">
                            {[
                                { text: "5 team seats included", highlight: "5 team seats" },
                                { text: "250 prospects monthly", highlight: "250 prospects" },
                                { text: "Everything in Broker" },
                                { text: "Role-based access control" },
                                { text: "Internal underwriting workflow" },
                                { text: "Team activity dashboard" },
                                { text: "Priority email & chat support" },
                                { text: "Onboarding assistance" },
                            ].map((item, i) => (
                                <li key={i} className="flex items-start gap-2.5 text-[13px] text-foreground">
                                    <span className="w-[18px] h-[18px] bg-success/15 rounded-full flex items-center justify-center shrink-0 mt-px">
                                        <Check className="w-2.5 h-2.5 text-success stroke-[3]" />
                                    </span>
                                    <span>
                                        {item.highlight ? (
                                            <>
                                                <span className="font-semibold text-primary">{item.highlight}</span>{" "}
                                                {item.text.replace(item.highlight, "").trim()}
                                            </>
                                        ) : (
                                            item.text
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Lender */}
                    <div className="bg-card border border-card-border rounded-lg p-7 relative transition-all duration-200 hover:border-muted-foreground hover:-translate-y-0.5 hover:shadow-lg">
                        <div className="text-[11px] font-semibold uppercase tracking-widest text-primary mb-1">Business</div>
                        <div className="text-2xl font-bold tracking-tight mb-1.5">Lender</div>
                        <div className="text-[13px] text-muted-foreground mb-5 leading-normal">
                            For credit teams and lending operations
                        </div>

                        <div className="mb-5">
                            <div className="flex items-baseline gap-0.5">
                                <span className="text-xl font-semibold text-foreground">£</span>
                                <span className="text-[2.75rem] font-extrabold tracking-tight leading-none text-foreground">
                                    {isAnnual ? "1,999" : "2,499"}
                                </span>
                                <span className="text-sm text-muted-foreground ml-1">/month</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1.5">
                                15 seats • Unlimited prospects
                            </div>
                        </div>

                        <div className="w-full mb-5">
                            <button className="w-full py-3 px-5 rounded-md font-semibold text-sm bg-transparent text-foreground border border-border hover:bg-white/5 hover:border-muted-foreground transition-all">
                                Book a Demo
                            </button>
                        </div>

                        <ul className="space-y-2 border-t border-border pt-4">
                            {[
                                { text: "Unlimited prospects", highlight: "Unlimited prospects" },
                                { text: "15 team seats included", highlight: "15 team seats" },
                                { text: "Everything in Team" },
                                { text: "AI Credit Underwriting module" },
                                { text: "Credit committee reports" },
                                { text: "Custom scoring models" },
                                { text: "API access" },
                                { text: "Dedicated account manager" },
                                { text: "99.5% SLA with credits" },
                            ].map((item, i) => (
                                <li key={i} className="flex items-start gap-2.5 text-[13px] text-foreground">
                                    <span className="w-[18px] h-[18px] bg-success/15 rounded-full flex items-center justify-center shrink-0 mt-px">
                                        <Check className="w-2.5 h-2.5 text-success stroke-[3]" />
                                    </span>
                                    <span>
                                        {item.highlight ? (
                                            <>
                                                <span className="font-semibold text-primary">{item.highlight}</span>{" "}
                                                {item.text.replace(item.highlight, "").trim()}
                                            </>
                                        ) : (
                                            item.text
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Enterprise */}
                    <div className="bg-card border border-card-border rounded-lg p-7 relative transition-all duration-200 hover:border-muted-foreground hover:-translate-y-0.5 hover:shadow-lg">
                        <div className="text-[11px] font-semibold uppercase tracking-widest text-primary mb-1">Enterprise</div>
                        <div className="text-2xl font-bold tracking-tight mb-1.5">Institution</div>
                        <div className="text-[13px] text-muted-foreground mb-5 leading-normal">
                            For banks, CDFIs, and large lending operations
                        </div>

                        <div className="mb-5">
                            <div className="flex items-baseline gap-0.5 h-[58px]">
                                <span className="text-[2rem] font-bold text-foreground self-center">
                                    Custom
                                </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1.5">
                                Tailored to your requirements
                            </div>
                        </div>

                        <div className="w-full mb-5">
                            <button className="w-full py-3 px-5 rounded-md font-semibold text-sm bg-transparent text-foreground border border-border hover:bg-white/5 hover:border-muted-foreground transition-all">
                                Request Access
                            </button>
                        </div>

                        <ul className="space-y-2 border-t border-border pt-4">
                            {[
                                { text: "Everything in Lender", highlight: "Everything in Lender" },
                                { text: "Unlimited seats" },
                                { text: "White-label branding" },
                                { text: "Custom integrations" },
                                { text: "Dedicated infrastructure" },
                                { text: "99.9% SLA guarantee" },
                                { text: "Compliance & audit support" },
                                { text: "Bespoke development" },
                                { text: "On-premise available" },
                            ].map((item, i) => (
                                <li key={i} className="flex items-start gap-2.5 text-[13px] text-foreground">
                                    <span className="w-[18px] h-[18px] bg-success/15 rounded-full flex items-center justify-center shrink-0 mt-px">
                                        <Check className="w-2.5 h-2.5 text-success stroke-[3]" />
                                    </span>
                                    <span>
                                        {item.highlight ? (
                                            <>
                                                <span className="font-semibold text-primary">{item.highlight}</span>{" "}
                                                {item.text.replace(item.highlight, "").trim()}
                                            </>
                                        ) : (
                                            item.text
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>

                </div>

                {/* Value Callout */}
                <div className="bg-card border border-border rounded-lg p-6 mt-8 text-center flex items-center justify-center gap-3">
                    <span className="text-xl">💡</span>
                    <p className="text-sm text-muted-foreground m-0">
                        <strong className="text-primary">One completed deal covers your annual subscription.</strong>{" "}
                        A broker placing just £250k earns enough commission to pay for Veltro for the entire year.
                    </p>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-16 px-6 bg-card border-t border-border">
                <div className="max-w-[1120px] mx-auto text-center">
                    <h2 className="text-[1.75rem] font-bold tracking-tight mb-2">
                        Why Leading Lenders Choose Veltro
                    </h2>
                    <p className="text-muted-foreground mb-10">
                        Built by lending professionals who understand the commercial finance market.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                        {/* Feature 1 */}
                        <div className="p-6 bg-background border border-border rounded-lg">
                            <div className="w-10 h-10 bg-primary/10 rounded-[10px] flex items-center justify-center mb-4">
                                <svg viewBox="0 0 24 24" className="w-5 h-5 stroke-primary stroke-2 fill-none">
                                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                                </svg>
                            </div>
                            <h3 className="text-[15px] font-semibold mb-2">ROI in Days, Not Months</h3>
                            <p className="text-[13px] text-muted-foreground leading-relaxed">
                                Most users see payback within their first completed deal. The efficiency gains compound from there.
                            </p>
                        </div>

                        {/* Feature 2 */}
                        <div className="p-6 bg-background border border-border rounded-lg">
                            <div className="w-10 h-10 bg-primary/10 rounded-[10px] flex items-center justify-center mb-4">
                                <svg viewBox="0 0 24 24" className="w-5 h-5 stroke-primary stroke-2 fill-none">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                </svg>
                            </div>
                            <h3 className="text-[15px] font-semibold mb-2">Enterprise-Grade Security</h3>
                            <p className="text-[13px] text-muted-foreground leading-relaxed">
                                UK-hosted infrastructure, GDPR compliant, with encryption at rest and in transit. Your data stays sovereign.
                            </p>
                        </div>

                        {/* Feature 3 */}
                        <div className="p-6 bg-background border border-border rounded-lg">
                            <div className="w-10 h-10 bg-primary/10 rounded-[10px] flex items-center justify-center mb-4">
                                <svg viewBox="0 0 24 24" className="w-5 h-5 stroke-primary stroke-2 fill-none">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="9" cy="7" r="4"></circle>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                </svg>
                            </div>
                            <h3 className="text-[15px] font-semibold mb-2">Built for UK Lending</h3>
                            <p className="text-[13px] text-muted-foreground leading-relaxed">
                                Companies House integration, FCA-aware workflows, and credit assessment tools designed for the UK market.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="p-6 text-center border-t border-border">
                <p className="text-[13px] text-muted-foreground">
                    Questions?{" "}
                    <a href="mailto:sales@veltro.io" className="text-primary hover:underline">
                        sales@veltro.io
                    </a>{" "}
                    • All prices exclude VAT • <a href="#" className="hover:underline">View full feature comparison</a>
                </p>
            </footer>
        </div>
    );
}
