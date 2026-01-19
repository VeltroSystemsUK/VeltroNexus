import React from 'react';
import { Link } from 'wouter';
import { ArrowLeft, FileText, Shield, Scale, Clock, CreditCard, Database, Lock, Users, Globe, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoChrome from "@assets/logo-chrome.png";

export default function Terms() {
    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#0f172a] border-b border-white/10">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <Link href="/">
                        <img src={logoChrome} alt="Veltro" className="h-8 md:h-10 object-contain cursor-pointer" />
                    </Link>
                    <Link href="/subscribe">
                        <Button variant="outline" size="sm" className="gap-2">
                            <ArrowLeft className="w-4 h-4" /> Back to Subscribe
                        </Button>
                    </Link>
                </div>
            </header>

            {/* Hero Section */}
            <section className="bg-gradient-to-b from-[#0f172a] to-background py-16 px-4">
                <div className="container max-w-4xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
                        <FileText className="w-4 h-4" />
                        Legal Agreement
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
                        Terms & Conditions
                    </h1>
                    <p className="text-lg text-slate-400 mb-2">Software as a Service Agreement</p>
                    <p className="text-sm text-slate-500">
                        Effective Date: January 20, 2026 • Version 2.0
                    </p>
                </div>
            </section>

            {/* Quick Links */}
            <nav className="sticky top-16 z-40 bg-card border-b border-border py-3 px-4 shadow-sm">
                <div className="container max-w-4xl mx-auto">
                    <div className="flex gap-4 overflow-x-auto text-sm">
                        <a href="#definitions" className="text-muted-foreground hover:text-primary whitespace-nowrap transition-colors">Definitions</a>
                        <a href="#service" className="text-muted-foreground hover:text-primary whitespace-nowrap transition-colors">Service</a>
                        <a href="#payment" className="text-muted-foreground hover:text-primary whitespace-nowrap transition-colors">Payment</a>
                        <a href="#data" className="text-muted-foreground hover:text-primary whitespace-nowrap transition-colors">Data & Privacy</a>
                        <a href="#acceptable-use" className="text-muted-foreground hover:text-primary whitespace-nowrap transition-colors">Acceptable Use</a>
                        <a href="#liability" className="text-muted-foreground hover:text-primary whitespace-nowrap transition-colors">Liability</a>
                        <a href="#termination" className="text-muted-foreground hover:text-primary whitespace-nowrap transition-colors">Termination</a>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="container max-w-4xl mx-auto px-4 py-12">
                {/* Important Notice */}
                <div className="bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-500 p-6 rounded-r-lg mb-12">
                    <h2 className="font-bold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
                        <Scale className="w-5 h-5" /> IMPORTANT NOTICE
                    </h2>
                    <p className="text-amber-700 dark:text-amber-300 text-sm leading-relaxed">
                        PLEASE READ THESE TERMS CAREFULLY BEFORE SUBSCRIBING TO VELTRO. By clicking "I Agree" or "Subscribe," accessing the Veltro platform, or using any Veltro services, you ("Customer," "you," or "your") agree to be legally bound by these Terms & Conditions (these "Terms").
                    </p>
                    <p className="text-amber-700 dark:text-amber-300 text-sm leading-relaxed mt-3">
                        If you are entering into these Terms on behalf of a company or other legal entity, you represent that you have the authority to bind such entity to these Terms. If you do not have such authority, or if you do not agree with these Terms, you must not accept these Terms and may not use the Services.
                    </p>
                </div>

                <div className="prose prose-slate dark:prose-invert max-w-none">

                    {/* Section 1: Definitions */}
                    <section id="definitions" className="scroll-mt-32 mb-16">
                        <h2 className="text-2xl font-bold border-b border-border pb-3 mb-6 flex items-center gap-3">
                            <span className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                            DEFINITIONS
                        </h2>
                        <dl className="space-y-4">
                            <div className="bg-muted/30 p-4 rounded-lg">
                                <dt className="font-semibold text-foreground">"Authorized Users"</dt>
                                <dd className="text-muted-foreground text-sm mt-1">means your employees, contractors, or agents who are authorized by you to use the Services under your Account.</dd>
                            </div>
                            <div className="bg-muted/30 p-4 rounded-lg">
                                <dt className="font-semibold text-foreground">"Customer Data"</dt>
                                <dd className="text-muted-foreground text-sm mt-1">means all data, information, documents, and content uploaded, submitted, or generated through your use of the Services, including loan applications, borrower information, and business data.</dd>
                            </div>
                            <div className="bg-muted/30 p-4 rounded-lg">
                                <dt className="font-semibold text-foreground">"Documentation"</dt>
                                <dd className="text-muted-foreground text-sm mt-1">means Veltro's user guides, help documentation, and other materials made available through the Services or at docs.veltro.com.</dd>
                            </div>
                            <div className="bg-muted/30 p-4 rounded-lg">
                                <dt className="font-semibold text-foreground">"Intellectual Property Rights"</dt>
                                <dd className="text-muted-foreground text-sm mt-1">means all patents, copyrights, trademarks, trade secrets, and other intellectual property rights worldwide.</dd>
                            </div>
                            <div className="bg-muted/30 p-4 rounded-lg">
                                <dt className="font-semibold text-foreground">"Services"</dt>
                                <dd className="text-muted-foreground text-sm mt-1">means Veltro's commercial lending workflow platform, including the web application, APIs, integrations, and all related services provided by Veltro under your Subscription Plan.</dd>
                            </div>
                            <div className="bg-muted/30 p-4 rounded-lg">
                                <dt className="font-semibold text-foreground">"Subscription Plan"</dt>
                                <dd className="text-muted-foreground text-sm mt-1">means the specific tier of service you have selected (Broker, Growth Partner, or Enterprise), as described on our pricing page.</dd>
                            </div>
                            <div className="bg-muted/30 p-4 rounded-lg">
                                <dt className="font-semibold text-foreground">"Veltro," "we," "us," or "our"</dt>
                                <dd className="text-muted-foreground text-sm mt-1">means Veltro Ltd, a company registered in England and Wales, with registered office in London, United Kingdom.</dd>
                            </div>
                        </dl>
                    </section>

                    {/* Section 2: Service Provision */}
                    <section id="service" className="scroll-mt-32 mb-16">
                        <h2 className="text-2xl font-bold border-b border-border pb-3 mb-6 flex items-center gap-3">
                            <span className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                            SERVICE PROVISION
                        </h2>

                        <h3 className="text-lg font-semibold mt-6 mb-3">2.1 License Grant</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            Subject to your compliance with these Terms and payment of applicable fees, Veltro grants you a non-exclusive, non-transferable, worldwide license to access and use the Services during the Subscription Term solely for your internal business operations.
                        </p>

                        <h3 className="text-lg font-semibold mt-6 mb-3">2.2 Account Registration</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed mb-3">To use the Services, you must:</p>
                        <ul className="list-disc list-inside text-muted-foreground text-sm space-y-2">
                            <li>Create an account by providing accurate, current, and complete information</li>
                            <li>Maintain the security of your account credentials</li>
                            <li>Promptly notify us of any unauthorized access or security breach</li>
                            <li>Be at least 18 years old and legally capable of entering into binding contracts</li>
                        </ul>
                        <p className="text-muted-foreground text-sm leading-relaxed mt-3">
                            You are responsible for all activities that occur under your account, whether or not authorized by you.
                        </p>

                        <h3 className="text-lg font-semibold mt-6 mb-3">2.3 Authorized Users</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed mb-3">You may provision access to Authorized Users based on your Subscription Plan's user limit. You are responsible for:</p>
                        <ul className="list-disc list-inside text-muted-foreground text-sm space-y-2">
                            <li>Ensuring Authorized Users comply with these Terms</li>
                            <li>All actions taken by Authorized Users under your account</li>
                            <li>Maintaining accurate records of Authorized Users</li>
                            <li>Promptly removing access when users are no longer authorized</li>
                        </ul>

                        <h3 className="text-lg font-semibold mt-6 mb-3">2.4 Service Availability</h3>
                        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
                            <p className="text-green-800 dark:text-green-200 text-sm font-medium flex items-center gap-2">
                                <Clock className="w-4 h-4" /> Uptime Commitment: 99.5% monthly uptime
                            </p>
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed mb-3">Excluding:</p>
                        <ul className="list-disc list-inside text-muted-foreground text-sm space-y-2">
                            <li>Scheduled maintenance (maximum 4 hours per month, with 48 hours' notice)</li>
                            <li>Force majeure events</li>
                            <li>Third-party service outages (AWS, credit bureaus, etc.)</li>
                            <li>Issues caused by Customer actions or configurations</li>
                        </ul>

                        <h3 className="text-lg font-semibold mt-6 mb-3">2.5 Service Modifications</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed mb-3">Veltro reserves the right to:</p>
                        <ul className="list-disc list-inside text-muted-foreground text-sm space-y-2">
                            <li>Modify, update, or enhance the Services at any time</li>
                            <li>Add or remove features (provided core functionality is maintained)</li>
                            <li>Change APIs or integrations with reasonable notice</li>
                            <li>Discontinue features that are underutilized or technically obsolete</li>
                        </ul>
                        <p className="text-muted-foreground text-sm leading-relaxed mt-3">
                            Material adverse changes will be communicated with at least 30 days' notice.
                        </p>
                    </section>

                    {/* Section 3: Subscription & Payment */}
                    <section id="payment" className="scroll-mt-32 mb-16">
                        <h2 className="text-2xl font-bold border-b border-border pb-3 mb-6 flex items-center gap-3">
                            <span className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                            SUBSCRIPTION & PAYMENT
                        </h2>

                        <h3 className="text-lg font-semibold mt-6 mb-3">3.1 Subscription Plans</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            Veltro offers multiple Subscription Plans with different features, usage limits, and pricing. Current plans are available at <Link href="/pricing" className="text-primary hover:underline">veltro.com/pricing</Link>.
                        </p>

                        <h3 className="text-lg font-semibold mt-6 mb-3">3.2 Subscription Term</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            Your subscription begins on the date you complete the signup process and continues on a monthly or annual basis (as selected) until terminated.
                        </p>
                        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-3">
                            <p className="text-blue-800 dark:text-blue-200 text-sm font-medium">
                                <strong>Auto-Renewal:</strong> Subscriptions automatically renew for successive periods of the same duration unless you cancel before the renewal date.
                            </p>
                        </div>

                        <h3 className="text-lg font-semibold mt-6 mb-3">3.3 Fees & Payment</h3>
                        <div className="grid md:grid-cols-2 gap-4 mt-4">
                            <div className="bg-muted/30 p-4 rounded-lg">
                                <div className="flex items-center gap-2 font-semibold text-foreground mb-2">
                                    <CreditCard className="w-4 h-4 text-primary" /> Payment Method
                                </div>
                                <p className="text-muted-foreground text-sm">Valid credit card, debit card, or approved alternative required. You authorize recurring charges.</p>
                            </div>
                            <div className="bg-muted/30 p-4 rounded-lg">
                                <div className="flex items-center gap-2 font-semibold text-foreground mb-2">
                                    <Globe className="w-4 h-4 text-primary" /> Currency
                                </div>
                                <p className="text-muted-foreground text-sm">All fees in British Pounds Sterling (GBP). VAT at 20% applies to UK customers.</p>
                            </div>
                        </div>

                        <h3 className="text-lg font-semibold mt-6 mb-3">3.4 Price Changes</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            Veltro may change subscription prices with 30 days' written notice. Price changes will take effect on your next renewal date. Existing customers will be grandfathered at their current price for a minimum of 6 months after a price increase is announced.
                        </p>

                        <h3 className="text-lg font-semibold mt-6 mb-3">3.5 Late Payment</h3>
                        <ul className="list-disc list-inside text-muted-foreground text-sm space-y-2">
                            <li>Veltro will attempt to charge your payment method up to 3 times over 7 days</li>
                            <li>Your account may be suspended after 7 days of non-payment</li>
                            <li>Late payments incur interest at 8% per annum above the Bank of England base rate</li>
                            <li>Veltro may terminate your subscription after 30 days of non-payment</li>
                        </ul>

                        <h3 className="text-lg font-semibold mt-6 mb-3">3.6 No Refunds</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            Subscription fees are non-refundable except as expressly stated in Section 10.5 (Service Failures) or as required by law. If you cancel mid-billing cycle, you will retain access until the end of your paid period, but no pro-rata refund will be issued.
                        </p>
                    </section>

                    {/* Section 4: Customer Data & Privacy */}
                    <section id="data" className="scroll-mt-32 mb-16">
                        <h2 className="text-2xl font-bold border-b border-border pb-3 mb-6 flex items-center gap-3">
                            <span className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">4</span>
                            CUSTOMER DATA & PRIVACY
                        </h2>

                        <h3 className="text-lg font-semibold mt-6 mb-3">4.1 Customer Data Ownership</h3>
                        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
                            <p className="text-green-800 dark:text-green-200 text-sm font-medium flex items-center gap-2">
                                <Shield className="w-4 h-4" /> You own your Customer Data. Veltro claims no ownership rights.
                            </p>
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed mt-3">
                            You grant Veltro a limited license to host, store, process, and display Customer Data solely to provide the Services.
                        </p>

                        <h3 className="text-lg font-semibold mt-6 mb-3">4.2 Data Processing Agreement</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed mb-3">Veltro processes personal data in accordance with:</p>
                        <ul className="list-disc list-inside text-muted-foreground text-sm space-y-2">
                            <li>UK General Data Protection Regulation (UK GDPR)</li>
                            <li>EU General Data Protection Regulation (EU GDPR)</li>
                            <li>Data Protection Act 2018</li>
                            <li>Other applicable data protection laws</li>
                        </ul>

                        <h3 className="text-lg font-semibold mt-6 mb-3">4.3 Data Security</h3>
                        <div className="grid md:grid-cols-2 gap-4 mt-4">
                            <div className="bg-muted/30 p-4 rounded-lg">
                                <div className="flex items-center gap-2 font-semibold text-foreground mb-2">
                                    <Lock className="w-4 h-4 text-primary" /> Encryption
                                </div>
                                <p className="text-muted-foreground text-sm">AES-256 at rest; TLS 1.3 in transit</p>
                            </div>
                            <div className="bg-muted/30 p-4 rounded-lg">
                                <div className="flex items-center gap-2 font-semibold text-foreground mb-2">
                                    <Users className="w-4 h-4 text-primary" /> Access Control
                                </div>
                                <p className="text-muted-foreground text-sm">RBAC with multi-factor authentication</p>
                            </div>
                            <div className="bg-muted/30 p-4 rounded-lg">
                                <div className="flex items-center gap-2 font-semibold text-foreground mb-2">
                                    <Shield className="w-4 h-4 text-primary" /> Network Security
                                </div>
                                <p className="text-muted-foreground text-sm">Firewalls, intrusion detection, DDoS protection</p>
                            </div>
                            <div className="bg-muted/30 p-4 rounded-lg">
                                <div className="flex items-center gap-2 font-semibold text-foreground mb-2">
                                    <Database className="w-4 h-4 text-primary" /> Monitoring
                                </div>
                                <p className="text-muted-foreground text-sm">24/7 automated security monitoring</p>
                            </div>
                        </div>

                        <h3 className="text-lg font-semibold mt-6 mb-3">4.4 Data Location</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            Customer Data is stored in:
                        </p>
                        <ul className="list-disc list-inside text-muted-foreground text-sm space-y-2 mt-2">
                            <li><strong>Primary Region:</strong> EU-West-2 (London, UK)</li>
                            <li><strong>Backup Region:</strong> EU-West-1 (Ireland)</li>
                        </ul>
                    </section>

                    {/* Section 5: Acceptable Use */}
                    <section id="acceptable-use" className="scroll-mt-32 mb-16">
                        <h2 className="text-2xl font-bold border-b border-border pb-3 mb-6 flex items-center gap-3">
                            <span className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">5</span>
                            ACCEPTABLE USE
                        </h2>

                        <h3 className="text-lg font-semibold mt-6 mb-3">5.1 Permitted Use</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            You may use the Services only for lawful business purposes in accordance with these Terms and applicable laws.
                        </p>

                        <h3 className="text-lg font-semibold mt-6 mb-3">5.2 Prohibited Activities</h3>
                        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                            <p className="text-red-800 dark:text-red-200 text-sm font-medium mb-3">You must NOT:</p>
                            <ul className="list-disc list-inside text-red-700 dark:text-red-300 text-sm space-y-2">
                                <li><strong>Reverse Engineer:</strong> Decompile, disassemble, or reverse engineer the Services</li>
                                <li><strong>Circumvent Security:</strong> Bypass authentication, access controls, or rate limits</li>
                                <li><strong>Scrape or Mine:</strong> Use automated tools to extract data beyond normal use</li>
                                <li><strong>Interfere with Service:</strong> Overload systems, introduce malware, or disrupt availability</li>
                                <li><strong>Resell or Sublicense:</strong> Provide access to third parties without permission</li>
                                <li><strong>Compete:</strong> Use the Services to build a competing product</li>
                                <li><strong>Violate Laws:</strong> Use for money laundering, fraud, or other illegal activities</li>
                                <li><strong>Infringe IP:</strong> Upload content that infringes intellectual property rights</li>
                            </ul>
                        </div>

                        <h3 className="text-lg font-semibold mt-6 mb-3">5.3 Compliance Obligations</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed mb-3">You are responsible for ensuring compliance with:</p>
                        <ul className="list-disc list-inside text-muted-foreground text-sm space-y-2">
                            <li>Financial Regulations: FCA regulations, Consumer Credit Act, anti-money laundering laws</li>
                            <li>Data Protection: GDPR, UK DPA 2018</li>
                            <li>Consumer Protection: Consumer Rights Act 2015</li>
                            <li>Industry Standards: Treating Customers Fairly (TCF), Responsible Lending principles</li>
                        </ul>
                    </section>

                    {/* Section 6-8: IP, Third Parties, Warranties (condensed) */}
                    <section className="mb-16">
                        <h2 className="text-2xl font-bold border-b border-border pb-3 mb-6 flex items-center gap-3">
                            <span className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">6</span>
                            INTELLECTUAL PROPERTY RIGHTS
                        </h2>
                        <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                            Veltro (and its licensors) own all Intellectual Property Rights in the Services. These Terms do not transfer any ownership rights to you. You retain all Intellectual Property Rights in your Customer Data.
                        </p>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            "VELTRO" and associated logos are trademarks of Veltro Ltd.
                        </p>
                    </section>

                    <section className="mb-16">
                        <h2 className="text-2xl font-bold border-b border-border pb-3 mb-6 flex items-center gap-3">
                            <span className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">7</span>
                            THIRD-PARTY SERVICES
                        </h2>
                        <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                            The Services may integrate with third-party services including credit bureaus (Equifax, Experian), open banking providers, and cloud infrastructure (AWS). Your use of these integrations is subject to those providers' terms.
                        </p>
                    </section>

                    <section className="mb-16">
                        <h2 className="text-2xl font-bold border-b border-border pb-3 mb-6 flex items-center gap-3">
                            <span className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">8</span>
                            WARRANTIES & DISCLAIMERS
                        </h2>
                        <h3 className="text-lg font-semibold mt-6 mb-3">8.1 Limited Warranty</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                            Veltro warrants that the Services will perform substantially in accordance with the Documentation for 90 days from the date you first access the Services.
                        </p>
                        <h3 className="text-lg font-semibold mt-6 mb-3">8.2 Disclaimer</h3>
                        <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                            <p className="text-slate-700 dark:text-slate-300 text-sm font-medium uppercase">
                                TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND. VELTRO DOES NOT WARRANT UNINTERRUPTED OR ERROR-FREE SERVICE.
                            </p>
                        </div>
                    </section>

                    {/* Section 9: Limitation of Liability */}
                    <section id="liability" className="scroll-mt-32 mb-16">
                        <h2 className="text-2xl font-bold border-b border-border pb-3 mb-6 flex items-center gap-3">
                            <span className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">9</span>
                            LIMITATION OF LIABILITY
                        </h2>

                        <h3 className="text-lg font-semibold mt-6 mb-3">9.1 Liability Cap</h3>
                        <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 mb-4">
                            <p className="text-slate-700 dark:text-slate-300 text-sm">
                                VELTRO'S TOTAL AGGREGATE LIABILITY SHALL NOT EXCEED THE TOTAL FEES PAID BY YOU IN THE 12 MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO LIABILITY.
                            </p>
                        </div>

                        <h3 className="text-lg font-semibold mt-6 mb-3">9.2 Exclusion of Consequential Damages</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            Veltro shall not be liable for indirect, incidental, special, or consequential damages including loss of profits, revenue, business, data, or goodwill.
                        </p>
                    </section>

                    {/* Section 10: Termination */}
                    <section id="termination" className="scroll-mt-32 mb-16">
                        <h2 className="text-2xl font-bold border-b border-border pb-3 mb-6 flex items-center gap-3">
                            <span className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">10</span>
                            TERM & TERMINATION
                        </h2>

                        <h3 className="text-lg font-semibold mt-6 mb-3">10.2 Termination by You</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed mb-3">
                            You may cancel your subscription at any time via Account Settings or by emailing support@veltro.com. Cancellation takes effect at the end of your current billing period.
                        </p>

                        <h3 className="text-lg font-semibold mt-6 mb-3">10.7 Data Retrieval & Deletion</h3>
                        <div className="grid md:grid-cols-2 gap-4 mt-4">
                            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                <p className="text-blue-800 dark:text-blue-200 text-sm font-medium">Data Export (30-Day Window)</p>
                                <p className="text-blue-700 dark:text-blue-300 text-sm mt-2">Request a complete export of your Customer Data in CSV, JSON, or SQL format.</p>
                            </div>
                            <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                                <p className="text-slate-700 dark:text-slate-300 text-sm font-medium">Data Deletion (Post-30 Days)</p>
                                <p className="text-slate-600 dark:text-slate-400 text-sm mt-2">All Customer Data deleted from production within 14 days; backups within 90 days.</p>
                            </div>
                        </div>
                    </section>

                    {/* Section 11-12: Confidentiality & General (condensed) */}
                    <section className="mb-16">
                        <h2 className="text-2xl font-bold border-b border-border pb-3 mb-6 flex items-center gap-3">
                            <span className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">11</span>
                            CONFIDENTIALITY
                        </h2>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            Each party agrees to use Confidential Information only for purposes of these Terms and not disclose it to third parties. Confidentiality obligations survive termination for 5 years.
                        </p>
                    </section>

                    <section className="mb-16">
                        <h2 className="text-2xl font-bold border-b border-border pb-3 mb-6 flex items-center gap-3">
                            <span className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">12</span>
                            GENERAL PROVISIONS
                        </h2>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="bg-muted/30 p-4 rounded-lg">
                                <p className="font-semibold text-foreground mb-2">Governing Law</p>
                                <p className="text-muted-foreground text-sm">Laws of England and Wales</p>
                            </div>
                            <div className="bg-muted/30 p-4 rounded-lg">
                                <p className="font-semibold text-foreground mb-2">Jurisdiction</p>
                                <p className="text-muted-foreground text-sm">Courts of England and Wales</p>
                            </div>
                        </div>
                    </section>

                    {/* Section 13: Contact */}
                    <section className="mb-16">
                        <h2 className="text-2xl font-bold border-b border-border pb-3 mb-6 flex items-center gap-3">
                            <span className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">13</span>
                            CONTACT INFORMATION
                        </h2>
                        <div className="bg-muted/30 p-6 rounded-lg">
                            <p className="font-bold text-foreground mb-4">Veltro Ltd</p>
                            <div className="grid md:grid-cols-2 gap-4 text-sm">
                                <div className="space-y-2">
                                    <p className="text-muted-foreground flex items-center gap-2">
                                        <Mail className="w-4 h-4" /> <strong>Support:</strong> support@veltro.com
                                    </p>
                                    <p className="text-muted-foreground flex items-center gap-2">
                                        <Mail className="w-4 h-4" /> <strong>Sales:</strong> sales@veltro.com
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-muted-foreground flex items-center gap-2">
                                        <Mail className="w-4 h-4" /> <strong>Legal:</strong> legal@veltro.com
                                    </p>
                                    <p className="text-muted-foreground flex items-center gap-2">
                                        <Mail className="w-4 h-4" /> <strong>DPO:</strong> dpo@veltro.com
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                </div>

                {/* Footer */}
                <div className="border-t border-border pt-8 mt-12 text-center">
                    <p className="text-sm text-muted-foreground mb-4">
                        Last Updated: January 20, 2026 • Version 2.0
                    </p>
                    <Link href="/subscribe">
                        <Button size="lg" className="gap-2">
                            <ArrowLeft className="w-4 h-4" /> Return to Subscribe
                        </Button>
                    </Link>
                </div>
            </main>
        </div>
    );
}
