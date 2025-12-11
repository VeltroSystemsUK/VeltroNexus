import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, Building2, Users, FileCheck, Shield, BarChart3,
  Zap, Brain, CheckCircle2, ArrowRight, Sparkles, Clock, 
  LineChart, Lock, Layers, Bot, FileText, CreditCard,
  ChevronRight, Star, Target, Workflow
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { Link } from "wouter";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary rounded-md flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold" data-testid="text-app-title">FlowLoan</h1>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-semibold">Features</a>
            <a href="#ai-powered" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-semibold">AI Automation</a>
            <a href="#workflow" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-semibold">Workflow</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/pricing">
              <Button variant="ghost" className="font-semibold" data-testid="button-pricing">
                Pricing
              </Button>
            </Link>
            <Button variant="ghost" className="font-semibold" onClick={handleLogin} data-testid="button-sign-in">
              Sign In
            </Button>
            <Button className="font-semibold" onClick={handleLogin} data-testid="button-sign-up">
              Start Free Trial
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent opacity-50" />
          
          <div className="container mx-auto px-4 py-20 md:py-28 relative">
            <div className="max-w-4xl mx-auto text-center">
              <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-[18px]">
                <Sparkles className="h-3.5 w-3.5 mr-2" />
                AI-Powered Commercial Lending Platform
              </Badge>
              
              <h2 className="text-4xl md:text-6xl font-bold mb-6 leading-tight" data-testid="text-hero-title">
                The <span className="text-primary">AI Commercial Lending</span> Workflow Management Platform
              </h2>
              
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto" data-testid="text-hero-description">Automate your lending pipeline with AI-powered credit decisioning, intelligent risk assessment, and seamless workflow automation. 
              From lead to approval in record time...</p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
                <Button size="lg" onClick={handleLogin} className="gap-2 text-lg px-8 font-semibold" data-testid="button-get-started">
                  Start Free Trial
                  <ArrowRight className="h-5 w-5" />
                </Button>
                <Button size="lg" variant="outline" onClick={handleLogin} className="gap-2 font-semibold" data-testid="button-demo">
                  <Bot className="h-5 w-5" />
                  See AI in Action
                </Button>
              </div>

              {/* Trust Badges */}
              <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-500" />
                  <span>Bank-Grade Security</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>GDPR Compliant</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-green-500" />
                  <span>Companies House Integrated</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="border-y bg-muted/30">
          <div className="container mx-auto px-4 py-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="font-bold text-primary mb-2 text-[42px]">10x</div>
                <p className="text-sm text-muted-foreground">Faster Processing</p>
              </div>
              <div className="text-center">
                <div className="font-bold text-primary mb-2 text-[42px]">85%</div>
                <p className="text-sm text-muted-foreground">Automation Rate</p>
              </div>
              <div className="text-center">
                <div className="font-bold text-primary mb-2 text-[42px]">30s</div>
                <p className="text-sm text-muted-foreground">AI Credit Decisions</p>
              </div>
              <div className="text-center">
                <div className="font-bold text-primary mb-2 text-[42px]">24/7</div>
                <p className="text-sm text-muted-foreground">Automated Workflow</p>
              </div>
            </div>
          </div>
        </section>

        {/* AI-Powered Section */}
        <section id="ai-powered" className="container mx-auto px-4 py-20">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 text-[16px]">
              <Brain className="h-3.5 w-3.5 mr-2" />
              AI-Powered Intelligence
            </Badge>
            <h3 className="text-3xl md:text-4xl font-bold mb-4">
              AI That Works While You Sleep
            </h3>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Our AI engine automates credit decisioning, risk assessment, and document analysis - reducing manual work by up to 85%.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full" />
              <CardContent className="p-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Brain className="h-6 w-6 text-primary" />
                </div>
                <h4 className="text-xl font-semibold mb-2">AI Credit Underwriting</h4>
                <p className="text-muted-foreground mb-4">
                  Machine learning analyzes bank statements, financial data, and company profiles to deliver instant credit recommendations with risk grades A-E.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>CAMPARI Framework Analysis</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Automated DSCR Calculation</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Red Flag Detection</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full" />
              <CardContent className="p-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <h4 className="text-xl font-semibold mb-2">Smart Document Analysis</h4>
                <p className="text-muted-foreground mb-4">
                  Upload bank statements and financial documents. Our AI extracts key metrics, identifies patterns, and flags anomalies automatically.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>CSV Bank Statement Parsing</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>P&L Auto-Generation</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Monthly Trend Analysis</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full" />
              <CardContent className="p-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <h4 className="text-xl font-semibold mb-2">Adverse Media Search</h4>
                <p className="text-muted-foreground mb-4">
                  AI-powered web search scans for adverse media, legal issues, and reputational risks associated with borrowers and their directors.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Real-time Web Search</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Director Background Checks</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Risk Flag Summaries</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Visual Pipeline Section */}
        <section id="workflow" className="bg-muted/30 py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <Badge variant="outline" className="mb-4 text-[16px]">
                <Workflow className="h-3.5 w-3.5 mr-2" />
                End-to-End Workflow
              </Badge>
              <h3 className="text-3xl md:text-4xl font-bold mb-4">
                Visual Pipeline Management
              </h3>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Drag-and-drop your prospects through 9 customizable stages. See exactly where every deal stands at a glance.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-3 mb-12">
              {[
                { stage: 'Lead', color: 'bg-slate-500 dark:bg-slate-600' },
                { stage: 'Contacted', color: 'bg-blue-500 dark:bg-blue-600' },
                { stage: 'Qualified', color: 'bg-indigo-500 dark:bg-indigo-600' },
                { stage: 'Proposal', color: 'bg-violet-500 dark:bg-violet-600' },
                { stage: 'Due Diligence', color: 'bg-purple-500 dark:bg-purple-600' },
                { stage: 'Approval', color: 'bg-amber-500 dark:bg-amber-600' },
                { stage: 'Approved', color: 'bg-green-500 dark:bg-green-600' },
                { stage: 'Declined', color: 'bg-red-500 dark:bg-red-600' },
                { stage: 'Withdrawn', color: 'bg-gray-400 dark:bg-gray-500' },
              ].map(({ stage, color }, i) => (
                <div key={stage} className="flex items-center gap-2">
                  <Badge 
                    className={`whitespace-nowrap inline-flex items-center rounded-md border px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover-elevate border-transparent text-white shadow-xs text-[13px] ${color}`}
                  >
                    {stage}
                  </Badge>
                  {i < 8 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mx-auto mb-4">
                    <Zap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h4 className="font-semibold mb-2">Instant Lead Capture</h4>
                  <p className="text-sm text-muted-foreground">
                    Import leads via CSV, search Companies House, or add manually. All business types supported.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-center">
                  <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center mx-auto mb-4">
                    <Building2 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h4 className="font-semibold mb-2">Auto-Enrich Data</h4>
                  <p className="text-sm text-muted-foreground">
                    Pull company details, directors, charges, and PSCs directly from Companies House API.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-center">
                  <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center mx-auto mb-4">
                    <FileCheck className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h4 className="font-semibold mb-2">Due Diligence Suite</h4>
                  <p className="text-sm text-muted-foreground">
                    7 built-in tools: checklists, calculators, affordability, ratios, character assessment & AI underwriting.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-center">
                  <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto mb-4">
                    <LineChart className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <h4 className="font-semibold mb-2">Decision & Submit</h4>
                  <p className="text-sm text-muted-foreground">
                    Internal underwriting workflow, generate PDF reports, and submit to lenders via email.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="container mx-auto px-4 py-20">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 text-[16px]">
              <Layers className="h-3.5 w-3.5 mr-2" />
              Complete Platform
            </Badge>
            <h3 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need to Scale
            </h3>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Built specifically for commercial lending teams. No bloat, no complexity - just powerful tools that work.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <div className="flex gap-4 p-6 rounded-lg border bg-card">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold mb-1">Companies House API</h4>
                <p className="text-sm text-muted-foreground">
                  Search by name, number, SIC code, postcode, or director. Auto-populate company data instantly.
                </p>
              </div>
            </div>

            <div className="flex gap-4 p-6 rounded-lg border bg-card">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold mb-1">Contact Management</h4>
                <p className="text-sm text-muted-foreground">
                  Auto-sync officers from Companies House. Add custom contacts with enriched profiles.
                </p>
              </div>
            </div>

            <div className="flex gap-4 p-6 rounded-lg border bg-card">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold mb-1">CRM & Activities</h4>
                <p className="text-sm text-muted-foreground">
                  Calendar, tasks, meetings, calls, and notes. Never miss a follow-up with smart reminders.
                </p>
              </div>
            </div>

            <div className="flex gap-4 p-6 rounded-lg border bg-card">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold mb-1">Document Storage</h4>
                <p className="text-sm text-muted-foreground">
                  Upload and organize documents by category. Financial statements, ID docs, property files, and more.
                </p>
              </div>
            </div>

            <div className="flex gap-4 p-6 rounded-lg border bg-card">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold mb-1">PDF Reports</h4>
                <p className="text-sm text-muted-foreground">
                  Generate professional prospect reports with customizable sections and drag-and-drop ordering.
                </p>
              </div>
            </div>

            <div className="flex gap-4 p-6 rounded-lg border bg-card">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold mb-1">Subscription Management</h4>
                <p className="text-sm text-muted-foreground">
                  Tiered plans with GoCardless Direct Debit. Upgrade anytime to unlock premium AI features.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Role-Based Workflow */}
        <section className="bg-gradient-to-b from-muted/50 to-background py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <Badge variant="outline" className="mb-4 text-[16px]">
                <Users className="h-3.5 w-3.5 mr-2" />
                Role-Based Workflow
              </Badge>
              <h3 className="text-3xl md:text-4xl font-bold mb-4">
                Broker & Underwriter Collaboration
              </h3>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Streamlined internal credit review with dedicated queues, two-way messaging, and complete audit trails.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <Card className="border-2">
                <CardContent className="p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold">Brokers</h4>
                      <p className="text-sm text-muted-foreground">Origination & Submission</p>
                    </div>
                  </div>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                      <span className="text-sm">Submit prospects for internal underwriting review</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                      <span className="text-sm">Set priority levels and add submission notes</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                      <span className="text-sm">Reply to underwriter queries with document attachments</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                      <span className="text-sm">Track submission status with visual badges</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2">
                <CardContent className="p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                      <Shield className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold">Underwriters</h4>
                      <p className="text-sm text-muted-foreground">Review & Decision</p>
                    </div>
                  </div>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                      <span className="text-sm">Dedicated inbox with prioritized submission queue</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                      <span className="text-sm">Claim cases and manage workload efficiently</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                      <span className="text-sm">Query brokers for additional information</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                      <span className="text-sm">Make decisions: Approve, Decline, Query, or Withdraw</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section className="container mx-auto px-4 py-20">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <Badge variant="outline" className="mb-4 text-[16px]">
                  <Lock className="h-3.5 w-3.5 mr-2" />
                  Enterprise Security
                </Badge>
                <h3 className="text-3xl font-bold mb-4">
                  Bank-Grade Security & Compliance
                </h3>
                <p className="text-muted-foreground mb-6">
                  Your data is protected with enterprise-grade security. Full audit trails, role-based access, and GDPR compliance built-in.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <span>User-specific data isolation</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <span>Complete activity audit trails</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <span>Role-based access controls</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <span>Secure document storage</span>
                  </li>
                </ul>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-6 text-center">
                    <Shield className="h-10 w-10 mx-auto mb-3 text-primary" />
                    <h4 className="font-semibold">GDPR</h4>
                    <p className="text-xs text-muted-foreground">Compliant</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 text-center">
                    <Lock className="h-10 w-10 mx-auto mb-3 text-primary" />
                    <h4 className="font-semibold">Encrypted</h4>
                    <p className="text-xs text-muted-foreground">Data at Rest</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 text-center">
                    <Users className="h-10 w-10 mx-auto mb-3 text-primary" />
                    <h4 className="font-semibold">SSO</h4>
                    <p className="text-xs text-muted-foreground">Authentication</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 text-center">
                    <FileCheck className="h-10 w-10 mx-auto mb-3 text-primary" />
                    <h4 className="font-semibold">Audit</h4>
                    <p className="text-xs text-muted-foreground">Full Trail</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonial/Social Proof */}
        <section className="bg-primary text-primary-foreground py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <div className="flex justify-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-6 w-6 fill-current" />
                ))}
              </div>
              <blockquote className="text-xl md:text-2xl font-medium mb-6">
                "FlowLoan transformed how we manage our lending pipeline. The AI credit underwriting alone saves us hours every week. It's like having an extra team member."
              </blockquote>
              <p className="text-primary-foreground/80">
                Commercial Finance Broker, UK
              </p>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="container mx-auto px-4 py-20 text-center">
          <div className="max-w-2xl mx-auto">
            <Badge variant="secondary" className="mb-6 text-[18px]">
              <Zap className="h-3.5 w-3.5 mr-2" />
              Get Started in Minutes
            </Badge>
            <h3 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Transform Your Lending Workflow?
            </h3>
            <p className="text-lg text-muted-foreground mb-8">
              Start with 10 free prospects. No credit card required. Upgrade anytime to unlock AI-powered credit underwriting.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" onClick={handleLogin} className="gap-2 text-lg px-8" data-testid="button-sign-up-cta">
                Start Free Trial
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="gap-2">
                  View Pricing
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      {/* Footer */}
      <footer className="border-t py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-primary rounded-md flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold">FlowLoan</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/pricing">
                <span className="hover:text-foreground transition-colors cursor-pointer">Pricing</span>
              </Link>
              <span>Privacy Policy</span>
              <span>Terms of Service</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 FlowLoan. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
