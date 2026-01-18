import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import logoChrome from "@assets/logo-chrome.png";
import {
  TrendingUp,
  Building2,
  Users,
  FileCheck,
  Shield,
  BarChart3,
  Zap,
  Brain,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Clock,
  LineChart,
  Lock,
  Layers,
  FileText,
  CreditCard,
  Star,
  Target,
  Search,
  Calculator,
  PoundSterling,
  Info,
  Rocket,
  Menu,
  X,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ThemeToggle from "@/components/ThemeToggle";
import { Link, useLocation } from "wouter";

function useCountUp(end: number, duration: number = 2000, startOnView: boolean = true) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!startOnView) {
      setHasStarted(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [startOnView, hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;

    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);

      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [end, duration, hasStarted]);

  return { count, ref };
}

// Veltro pricing tiers with seat limits and AI module info
interface PricingTier {
  name: string;
  price: number;
  prospects: number | string;
  maxSeats: number;
  aiModuleIncluded: boolean;
  aiModuleAddOn: number; // Monthly cost to add AI module (0 if included or N/A)
}

const VELTRO_PRICING: Record<string, PricingTier> = {
  starter: { name: "Starter", price: 39, prospects: 50, maxSeats: 1, aiModuleIncluded: false, aiModuleAddOn: 49 },
  team: { name: "Team", price: 229, prospects: 250, maxSeats: 5, aiModuleIncluded: false, aiModuleAddOn: 99 },
  lender: { name: "Lender", price: 999, prospects: Infinity, maxSeats: Infinity, aiModuleIncluded: true, aiModuleAddOn: 0 },
};

const AI_MODULE_ADD_ON_PRICE = 49; // Base price for AI Credit Underwriting add-on

function SavingsCalculator() {
  const [crmSpend, setCrmSpend] = useState(100);
  const [creditDataSpend, setCreditDataSpend] = useState(200);
  const [trackingSpend, setTrackingSpend] = useState(50);
  const [labourHours, setLabourHours] = useState(20);
  const [hourlyRate, setHourlyRate] = useState(25);
  const [numberOfUsers, setNumberOfUsers] = useState(1);
  const [needsAiModule, setNeedsAiModule] = useState(false);

  const totalCurrentSpend = crmSpend + creditDataSpend + trackingSpend + (labourHours * hourlyRate);

  // Calculate total Veltro cost for a tier (base + AI add-on if needed and not included)
  const getTierTotalCost = (tier: PricingTier): number => {
    let cost = tier.price;
    if (needsAiModule && !tier.aiModuleIncluded) {
      cost += tier.aiModuleAddOn;
    }
    return cost;
  };

  // Check if tier can accommodate the user count
  const tierMeetsSeats = (tier: PricingTier): boolean => {
    return numberOfUsers <= tier.maxSeats;
  };

  // Recommend the tier that delivers the best savings while meeting requirements
  const getRecommendedTier = (): { tier: PricingTier; totalCost: number; aiAddOnApplied: boolean } => {
    const tiersList = [
      VELTRO_PRICING.starter,
      VELTRO_PRICING.team,
      VELTRO_PRICING.lender,
    ];

    // Filter tiers that meet seat requirements
    const eligibleTiers = tiersList.filter(tierMeetsSeats);

    // If no eligible tiers (shouldn't happen), default to lender
    if (eligibleTiers.length === 0) {
      const tier = VELTRO_PRICING.lender;
      return { tier, totalCost: getTierTotalCost(tier), aiAddOnApplied: needsAiModule && !tier.aiModuleIncluded };
    }

    // Find the tier with maximum savings (lowest total cost)
    let bestTier = eligibleTiers[0];
    let bestTotalCost = getTierTotalCost(bestTier);

    for (const tier of eligibleTiers) {
      const totalCost = getTierTotalCost(tier);
      if (totalCost < bestTotalCost) {
        bestTotalCost = totalCost;
        bestTier = tier;
      }
    }

    return {
      tier: bestTier,
      totalCost: bestTotalCost,
      aiAddOnApplied: needsAiModule && !bestTier.aiModuleIncluded
    };
  };

  const { tier: recommendedTier, totalCost: veltroCost, aiAddOnApplied } = getRecommendedTier();
  const monthlySavings = totalCurrentSpend - veltroCost;
  const annualSavings = monthlySavings * 12;
  const savingsPercentage = totalCurrentSpend > 0
    ? Math.round((monthlySavings / totalCurrentSpend) * 100)
    : 0;

  return (
    <div className="mt-12 bg-[#161b26] p-5 md:p-10 rounded-3xl border border-white/5">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 text-indigo-400 px-4 py-2 rounded-full mb-4">
          <Calculator className="h-4 w-4" />
          <span className="text-sm font-medium">Savings Calculator</span>
        </div>
        <h4 className="text-white text-xl md:text-2xl font-semibold mb-2">
          Calculate Your Potential Savings
        </h4>
        <p className="text-gray-400">Enter your current monthly spend to see how much you could save with Veltro.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Input Sliders */}
        <div className="space-y-6">
          <div>
            <div className="flex justify-between mb-3">
              <div className="flex items-center gap-2">
                <label className="text-white text-sm font-medium">CRM / Pipeline Tools</label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex" aria-label="More info about CRM costs" data-testid="info-crm">
                      <Info className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Customer relationship management and sales pipeline software used to track leads, contacts, and deal progress.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <span className="text-indigo-400 font-semibold">£{crmSpend}/mo</span>
            </div>
            <Slider
              value={[crmSpend]}
              onValueChange={(v) => setCrmSpend(v[0])}
              max={500}
              step={10}
              className="w-full"
              data-testid="slider-crm-spend"
            />
          </div>

          <div>
            <div className="flex justify-between mb-3">
              <div className="flex items-center gap-2">
                <label className="text-white text-sm font-medium">Credit Data / Bureau Subscriptions</label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex" aria-label="More info about credit data costs" data-testid="info-credit-data">
                      <Info className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Subscription fees for credit reference agencies and business data providers used to assess borrower creditworthiness.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <span className="text-indigo-400 font-semibold">£{creditDataSpend}/mo</span>
            </div>
            <Slider
              value={[creditDataSpend]}
              onValueChange={(v) => setCreditDataSpend(v[0])}
              max={1000}
              step={25}
              className="w-full"
              data-testid="slider-credit-data-spend"
            />
          </div>

          <div>
            <div className="flex justify-between mb-3">
              <div className="flex items-center gap-2">
                <label className="text-white text-sm font-medium">Project Tracking / Admin Tools</label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex" aria-label="More info about tracking costs" data-testid="info-tracking">
                      <Info className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Task management, document storage, and administrative software used to coordinate loan applications and team workflows.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <span className="text-indigo-400 font-semibold">£{trackingSpend}/mo</span>
            </div>
            <Slider
              value={[trackingSpend]}
              onValueChange={(v) => setTrackingSpend(v[0])}
              max={300}
              step={10}
              className="w-full"
              data-testid="slider-tracking-spend"
            />
          </div>

          <div>
            <div className="flex justify-between mb-3">
              <div className="flex items-center gap-2">
                <label className="text-white text-sm font-medium">Manual Data Entry (hours/month)</label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex" aria-label="More info about labour costs" data-testid="info-labour">
                      <Info className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Time spent on manual data entry, document processing, and administrative tasks.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <span className="text-indigo-400 font-semibold">{labourHours} hrs</span>
            </div>
            <Slider
              value={[labourHours]}
              onValueChange={(v) => setLabourHours(v[0])}
              max={80}
              step={5}
              className="w-full"
              data-testid="slider-labour-hours"
            />
          </div>

          <div>
            <div className="flex justify-between mb-3">
              <div className="flex items-center gap-2">
                <label className="text-white text-sm font-medium">Hourly Rate</label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex" aria-label="More info about hourly rate" data-testid="info-hourly-rate">
                      <Info className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Average cost per hour for staff, including wages and employer overheads (NI, pension, equipment, office space, etc.). UK average is £25-35/hour fully loaded.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <span className="text-indigo-400 font-semibold">£{hourlyRate}/hr (£{labourHours * hourlyRate}/mo)</span>
            </div>
            <Slider
              value={[hourlyRate]}
              onValueChange={(v) => setHourlyRate(v[0])}
              min={10}
              max={75}
              step={5}
              className="w-full"
              data-testid="slider-hourly-rate"
            />
          </div>

          {/* Team Size */}
          <div>
            <div className="flex justify-between mb-3">
              <div className="flex items-center gap-2">
                <label className="text-white text-sm font-medium">Number of Users</label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex" aria-label="More info about team size" data-testid="info-users">
                      <Info className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>The number of team members who will need access to the platform. Different plans support different team sizes.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <span className="text-indigo-400 font-semibold">{numberOfUsers} {numberOfUsers === 1 ? 'user' : 'users'}</span>
            </div>
            <Slider
              value={[numberOfUsers]}
              onValueChange={(v) => setNumberOfUsers(v[0])}
              min={1}
              max={20}
              step={1}
              className="w-full"
              data-testid="slider-number-users"
            />
            <p className="text-xs text-gray-500 mt-2">
              Starter: 1 user | Team: up to 5 | Lender: Unlimited
            </p>
          </div>

          {/* AI Credit Underwriting Toggle */}
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
            <div className="flex items-center gap-2">
              <div>
                <label className="text-white text-sm font-medium">AI Credit Underwriting Module</label>
                <p className="text-xs text-gray-500 mt-1">Premium add-on for Starter & Team plans</p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="inline-flex" aria-label="More info about AI module" data-testid="info-ai-module">
                    <Info className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>AI-powered credit analysis that automatically generates underwriting reports, risk assessments, and lending recommendations from uploaded documents.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Switch
              checked={needsAiModule}
              onCheckedChange={setNeedsAiModule}
              data-testid="switch-ai-module"
            />
          </div>
        </div>

        {/* Results Panel */}
        <div className="bg-gradient-to-br from-indigo-500/10 to-emerald-500/10 p-6 md:p-8 rounded-2xl border border-indigo-500/20">
          <div className="space-y-4 mb-6">
            <div className="flex justify-between items-center pb-4 border-b border-white/10">
              <span className="text-gray-400">Your Current Monthly Spend</span>
              <span className="text-red-400 font-semibold text-lg">£{totalCurrentSpend.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center pb-4 border-b border-white/10">
              <span className="text-gray-400">Recommended Veltro Plan</span>
              <div className="text-right">
                <span className="text-white font-semibold">{recommendedTier.name}</span>
                <span className="text-gray-400 text-sm ml-1">(£{recommendedTier.price}/mo)</span>
              </div>
            </div>
            {aiAddOnApplied && (
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-gray-400">+ AI Credit Underwriting</span>
                <span className="text-indigo-400 font-semibold">£{recommendedTier.aiModuleAddOn}/mo</span>
              </div>
            )}
            <div className="flex justify-between items-center pb-4 border-b border-white/10">
              <span className="text-gray-400 font-medium">Veltro Total</span>
              <span className="text-white font-bold text-lg">£{veltroCost}/mo</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Monthly Savings</span>
              <span className={`font-bold text-lg ${monthlySavings >= 0 ? 'text-emerald-400' : 'text-gray-400'}`}>
                {monthlySavings >= 0 ? `£${monthlySavings.toLocaleString()}` : '—'}
              </span>
            </div>
          </div>

          {annualSavings > 0 ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <PoundSterling className="h-6 w-6 text-emerald-400" />
                <span className="text-3xl md:text-4xl font-bold text-emerald-400">
                  {annualSavings.toLocaleString()}
                </span>
              </div>
              <p className="text-emerald-300 text-sm font-medium">
                Potential Annual Savings ({savingsPercentage}% reduction)
              </p>
            </div>
          ) : (
            <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-5 text-center">
              <p className="text-indigo-300 text-sm font-medium">
                Add your current tool costs above to see potential savings
              </p>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link href="/pricing">
              <Button className="bg-indigo-500 hover:bg-indigo-600 text-white gap-2">
                View Full Pricing
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsSection() {
  const stat1 = useCountUp(10, 2000);
  const stat2 = useCountUp(85, 2000);
  const stat3 = useCountUp(30, 2000);
  const stat4 = useCountUp(24, 2000);

  return (
    <section className="border-y bg-muted/30">
      <div className="container mx-auto px-6 md:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          <div className="text-center" ref={stat1.ref}>
            <div className="text-4xl md:text-5xl font-bold text-primary mb-3">{stat1.count}x</div>
            <p className="text-sm md:text-base text-muted-foreground font-medium">
              Faster Processing
            </p>
          </div>
          <div className="text-center" ref={stat2.ref}>
            <div className="text-4xl md:text-5xl font-bold text-primary mb-3">{stat2.count}%</div>
            <p className="text-sm md:text-base text-muted-foreground font-medium">
              Automation Rate
            </p>
          </div>
          <div className="text-center" ref={stat3.ref}>
            <div className="text-4xl md:text-5xl font-bold text-primary mb-3">{stat3.count}s</div>
            <p className="text-sm md:text-base text-muted-foreground font-medium">
              AI Credit Decisions
            </p>
          </div>
          <div className="text-center" ref={stat4.ref}>
            <div className="text-4xl md:text-5xl font-bold text-primary mb-3">{stat4.count}/7</div>
            <p className="text-sm md:text-base text-muted-foreground font-medium">
              Automated Workflow
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const [, setLocation] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const handleLogin = () => {
    setLocation("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Dark Hero Container - includes header and hero section */}
      <div className="bg-[#0f172a] relative">
        <header className="absolute top-0 left-0 right-0 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={logoChrome}
                alt="Veltro"
                className="h-8 md:h-10 object-contain"
                data-testid="img-logo-nav"
              />
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-sm text-gray-300 hover:text-white transition-colors font-semibold">Features</a>
              <a href="#ai-powered" className="text-sm text-gray-300 hover:text-white transition-colors font-semibold">AI Automation</a>
              <a href="#workflow" className="text-sm text-gray-300 hover:text-white transition-colors font-semibold">Workflow</a>
            </nav>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-2">
              <Link href="/pricing">
                <Button variant="ghost" className="font-semibold text-gray-300 hover:text-white hover:bg-white/10" data-testid="button-pricing">
                  Pricing
                </Button>
              </Link>
              <Button
                variant="ghost"
                className="font-semibold text-gray-300 hover:text-white hover:bg-white/10"
                onClick={handleLogin}
                data-testid="button-sign-in"
              >Login</Button>
              <Button
                className="font-semibold bg-[#D97706] hover:bg-[#B45309] text-white shadow-lg shadow-orange-500/25"
                onClick={handleLogin}
                data-testid="button-sign-up"
              >
                Start Free Trial
              </Button>
              <ThemeToggle />
            </div>

            {/* Mobile Menu Toggle & Actions */}
            <div className="flex items-center gap-2 md:hidden">
              <div className="scale-75 origin-right">
                <ThemeToggle />
              </div>
              <Button
                size="sm"
                className="font-semibold bg-[#D97706] hover:bg-[#B45309] text-white shadow-lg shadow-orange-500/25 text-xs px-3 h-8"
                onClick={handleLogin}
              >
                Start Trial
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-300"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </div>
          </div>

          {/* Mobile Menu Dropdown */}
          {isMobileMenuOpen && (
            <div className="md:hidden bg-[#0f172a] border-b border-white/10 absolute top-full left-0 right-0 p-4 shadow-xl animate-in slide-in-from-top-2">
              <nav className="flex flex-col gap-4">
                <a
                  href="#features"
                  className="text-gray-300 hover:text-white font-medium py-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Features
                </a>
                <a
                  href="#ai-powered"
                  className="text-gray-300 hover:text-white font-medium py-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  AI Automation
                </a>
                <a
                  href="#workflow"
                  className="text-gray-300 hover:text-white font-medium py-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Workflow
                </a>
                <Link href="/pricing" onClick={() => setIsMobileMenuOpen(false)}>
                  <span className="text-gray-300 hover:text-white font-medium py-2 block cursor-pointer">
                    Pricing
                  </span>
                </Link>
                <div className="h-px bg-white/10 my-1" />
                <Button
                  variant="ghost"
                  className="justify-start font-semibold text-gray-300 hover:text-white hover:bg-white/10 pl-0"
                  onClick={handleLogin}
                >
                  Login
                </Button>
              </nav>
            </div>
          )}
        </header>

        {/* Hero Section */}
        <section className="relative overflow-hidden pt-20">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a] via-[#0f172a] to-[#1e293b]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#D97706]/10 via-transparent to-transparent opacity-60" />

          {/* Animated Background Elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Floating orbs */}
            <div className="absolute top-20 left-[10%] w-72 h-72 bg-[#D97706]/20 rounded-full blur-3xl animate-[pulse_4s_ease-in-out_infinite]" />
            <div className="absolute top-40 right-[15%] w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-[pulse_6s_ease-in-out_infinite_1s]" />
            <div className="absolute bottom-20 left-[20%] w-64 h-64 bg-[#D97706]/15 rounded-full blur-3xl animate-[pulse_5s_ease-in-out_infinite_2s]" />

            {/* Moving grid lines */}
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: `linear-gradient(#D97706 1px, transparent 1px), linear-gradient(90deg, #D97706 1px, transparent 1px)`,
              backgroundSize: '60px 60px',
              animation: 'gridMove 20s linear infinite'
            }} />

            {/* Floating particles */}
            <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-[#D97706] rounded-full opacity-60 animate-[floatParticle_8s_ease-in-out_infinite]" />
            <div className="absolute top-1/3 right-1/3 w-1.5 h-1.5 bg-white rounded-full opacity-40 animate-[floatParticle_6s_ease-in-out_infinite_1s]" />
            <div className="absolute top-2/3 left-1/3 w-1 h-1 bg-[#D97706] rounded-full opacity-50 animate-[floatParticle_10s_ease-in-out_infinite_2s]" />
            <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-indigo-400 rounded-full opacity-30 animate-[floatParticle_7s_ease-in-out_infinite_3s]" />
            <div className="absolute bottom-1/3 right-1/2 w-1.5 h-1.5 bg-[#D97706] rounded-full opacity-40 animate-[floatParticle_9s_ease-in-out_infinite_4s]" />

            {/* Diagonal streaks - speed lines */}
            <div className="absolute top-0 left-0 w-full h-full">
              <div className="absolute top-[20%] -left-20 w-[400px] h-[1px] bg-gradient-to-r from-transparent via-[#D97706]/30 to-transparent rotate-[35deg] animate-[streak_3s_ease-in-out_infinite]" />
              <div className="absolute top-[40%] -right-20 w-[300px] h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent -rotate-[35deg] animate-[streak_4s_ease-in-out_infinite_1s]" />
              <div className="absolute top-[60%] -left-10 w-[250px] h-[1px] bg-gradient-to-r from-transparent via-[#D97706]/20 to-transparent rotate-[35deg] animate-[streak_5s_ease-in-out_infinite_2s]" />
            </div>
          </div>

          <div className="container mx-auto px-6 md:px-8 py-20 md:py-28 lg:py-36 relative">
            <div className="max-w-4xl mx-auto text-center">
              <img
                src={logoChrome}
                alt="Veltro"
                className="h-32 md:h-40 lg:h-48 object-contain mx-auto mb-12 animate-[float_3s_ease-in-out_infinite]"
                style={{
                  filter: "drop-shadow(0 0 20px rgba(217, 119, 6, 0.3))"
                }}
                data-testid="img-logo-hero"
              />

              <h2
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight tracking-tight text-white"
                data-testid="text-hero-title"
              >
                Bred for Speed.<br /><span className="text-[#D97706]">Built for Business.</span>
              </h2>

              <p
                className="text-lg md:text-xl text-[#9CA3AF] mb-12 max-w-2xl mx-auto leading-relaxed"
                data-testid="text-hero-description"
              >
                Retrieve Companies House data instantly. Enrich with curated approved data. Convert into high quality business lending applications.
              </p>

              <div className="flex items-center justify-center mb-14">
                <Button
                  size="lg"
                  onClick={handleLogin}
                  className="gap-2 text-base px-10 h-14 font-semibold bg-[#D97706] hover:bg-[#B45309] text-white shadow-xl shadow-orange-500/30 transition-all hover:shadow-orange-500/40 hover:scale-105"
                  data-testid="button-get-started"
                >
                  Start Free Trial
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </div>

              {/* Trust Badges */}
              <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-[#9CA3AF]">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-400" />
                  <span className="font-medium">Bank-Grade Security</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="font-medium">GDPR Compliant</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-emerald-400" />
                  <span className="font-medium">Companies House Integrated</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <main>
        {/* The 53-Day Trap - Problem Section */}
        <section className="bg-[#0f172a] py-20 md:py-24 border-t border-white/5">
          <div className="container mx-auto px-6 md:px-8 max-w-4xl text-center">
            <Badge variant="outline" className="mb-6 px-3 py-1.5 border-[#D97706]/40 bg-[#D97706]/10">
              <Clock className="h-4 w-4 mr-2 text-[#D97706]" />
              <span className="text-sm font-medium text-[#D97706]">The Industry Problem</span>
            </Badge>
            <h3 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight text-white">
              The <span className="text-[#D97706]">53-Day</span> Trap
            </h3>
            <p className="text-lg md:text-xl text-gray-300 leading-relaxed max-w-3xl mx-auto">
              The average business loan through traditional lenders takes <span className="text-white font-semibold">53 days</span> to complete.
              That's 53 days of silence, "black box" underwriting, "paperchasing" and constantly chasing updates from the Lender.
            </p>
            <p className="text-base md:text-lg text-gray-400 mt-6 leading-relaxed max-w-2xl mx-auto">
              Legacy banking systems and administrative chaos are eating your margins. You spend <span className="text-white font-medium">80% of your week</span> wrestling with data,
              leaving only 20% to do what you do best: <span className="text-[#D97706] font-semibold">Close deals.</span>
            </p>
          </div>
        </section>

        {/* Stats Section */}
        <StatsSection />

        {/* A Weapon for the Modern Broker - Solution Section */}
        <section className="bg-[#0f172a] py-20 md:py-24">
          <div className="container mx-auto px-6 md:px-8 max-w-6xl">
            <div className="text-center mb-14">
              <Badge variant="outline" className="mb-6 px-3 py-1.5 border-[#D97706]/30">
                <Zap className="h-4 w-4 mr-2 text-[#D97706]" />
                <span className="text-sm font-medium text-[#D97706]">The Solution</span>
              </Badge>
              <h3 className="text-3xl md:text-4xl font-bold mb-5 tracking-tight text-white">
                A Weapon for the <span className="text-[#D97706]">Modern Broker</span>
              </h3>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* The Glass Box */}
              <div className="bg-[#161b26] p-8 rounded-2xl border border-white/10 hover:border-[#D97706]/50 transition-all duration-300">
                <div className="w-14 h-14 bg-[#D97706]/10 rounded-xl flex items-center justify-center mb-6">
                  <Layers className="h-7 w-7 text-[#D97706]" />
                </div>
                <h4 className="text-white font-bold text-xl mb-2">The Glass Box</h4>
                <p className="text-[#D97706] text-sm font-medium mb-4">Workflow</p>
                <p className="text-gray-400 leading-relaxed">
                  <span className="text-white font-medium">See the Kill.</span> Stop working in the dark.
                  Our Kanban-style dashboard gives you a visual, real-time command center for every deal.
                  From "Lead" to "Cash," you know exactly where your application sits and who is holding it up.
                </p>
              </div>

              {/* Data Pedigree */}
              <div className="bg-[#161b26] p-8 rounded-2xl border border-white/10 hover:border-[#D97706]/50 transition-all duration-300">
                <div className="w-14 h-14 bg-[#D97706]/10 rounded-xl flex items-center justify-center mb-6">
                  <Building2 className="h-7 w-7 text-[#D97706]" />
                </div>
                <h4 className="text-white font-bold text-xl mb-2">Data Pedigree</h4>
                <p className="text-[#D97706] text-sm font-medium mb-4">Validation</p>
                <p className="text-gray-400 leading-relaxed">
                  <span className="text-white font-medium">Validate in Seconds.</span> Kill the "Not In Good Order" (NIGO) rejections.
                  Veltro integrates directly with Companies House and Open Banking. Type a client name,
                  and we auto-populate verified, golden-source data. Your applications go to lenders ready to fund.
                </p>
              </div>

              {/* The AI Edge */}
              <div className="bg-[#161b26] p-8 rounded-2xl border border-white/10 hover:border-[#D97706]/50 transition-all duration-300">
                <div className="w-14 h-14 bg-[#D97706]/10 rounded-xl flex items-center justify-center mb-6">
                  <Brain className="h-7 w-7 text-[#D97706]" />
                </div>
                <h4 className="text-white font-bold text-xl mb-2">The AI Edge</h4>
                <p className="text-[#D97706] text-sm font-medium mb-4">The Upgrade</p>
                <p className="text-gray-400 leading-relaxed">
                  <span className="text-white font-medium">Underwrite with Intelligence.</span> Don't just submit; strategize.
                  Upgrade to unlock our AI Credit Underwriting engine. Pre-screen your own deals against lender criteria
                  before you even hit send.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Test the Speed - How It Works */}
        <section className="py-20 md:py-24 bg-gradient-to-b from-background to-muted/30">
          <div className="container mx-auto px-6 md:px-8 max-w-5xl">
            <div className="text-center mb-14">
              <Badge variant="outline" className="mb-6 px-3 py-1.5">
                <Rocket className="h-4 w-4 mr-2" />
                <span className="text-sm font-medium">How It Works</span>
              </Badge>
              <h3 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
                Test the Speed. <span className="text-[#D97706]">Risk-Free.</span>
              </h3>
              <p className="text-lg text-muted-foreground">
                We don't need to sell you on velocity. We'll let you feel it.
              </p>
            </div>

            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center p-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-5">
                  <span className="text-2xl font-bold text-primary">1</span>
                </div>
                <h4 className="font-semibold mb-2">Create Account</h4>
                <p className="text-sm text-muted-foreground">No credit card. 60 seconds to launch.</p>
              </div>

              <div className="text-center p-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-5">
                  <span className="text-2xl font-bold text-primary">2</span>
                </div>
                <h4 className="font-semibold mb-2">Load Your Prospects</h4>
                <p className="text-sm text-muted-foreground">You get 10 Free Prospects to test the system immediately.</p>
              </div>

              <div className="text-center p-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-5">
                  <span className="text-2xl font-bold text-primary">3</span>
                </div>
                <h4 className="font-semibold mb-2">Experience Flow</h4>
                <p className="text-sm text-muted-foreground">Watch the data auto-populate and the workflow organise itself.</p>
              </div>

              <div className="text-center p-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-5">
                  <span className="text-2xl font-bold text-primary">4</span>
                </div>
                <h4 className="font-semibold mb-2">Upgrade to Scale</h4>
                <p className="text-sm text-muted-foreground">Ready for the big leagues? Unlock unlimited prospects and AI insights.</p>
              </div>
            </div>

            <div className="text-center mt-12">
              <Button
                size="lg"
                onClick={() => setLocation("/auth")}
                className="gap-2 text-base px-10 h-14 font-semibold bg-[#D97706] hover:bg-[#B45309] text-white shadow-xl shadow-orange-500/30"
                data-testid="button-trial-cta"
              >
                Start Free Trial
                <ArrowRight className="h-5 w-5" />
              </Button>
              <p className="text-sm text-muted-foreground mt-4">No credit card required. Upgrade anytime.</p>
            </div>
          </div>
        </section>

        {/* AI-Powered Section */}
        <section id="ai-powered" className="container mx-auto px-6 md:px-8 py-20 md:py-24">
          <div className="text-center mb-12 md:mb-16">
            <Badge variant="outline" className="mb-6 px-3 py-1.5">
              <Brain className="h-4 w-4 mr-2" />
              <span className="text-sm font-medium">AI-Assisted Analysis</span>
            </Badge>
            <h3 className="text-3xl md:text-4xl font-bold mb-5 tracking-tight">
              AI Tools That Support Your Decisions
            </h3>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              AI assists with credit analysis, document processing, and risk assessment. You review
              the outputs and make the final call — combining speed with human judgement.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto">
            <Card className="relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full" />
              <CardContent className="p-6 md:p-8">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                  <Brain className="h-6 w-6 text-primary" />
                </div>
                <h4 className="text-lg md:text-xl font-semibold mb-3">AI Credit Underwriting</h4>
                <p className="text-sm md:text-base text-muted-foreground mb-5 leading-relaxed">
                  Machine learning analyses bank statements, financial data, and company profiles to
                  deliver instant credit recommendations.
                </p>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>CAMPARI Framework Analysis</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>Automated DSCR Calculation</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>Red Flag Detection</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full" />
              <CardContent className="p-6 md:p-8">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <h4 className="text-lg md:text-xl font-semibold mb-3">Smart Document Analysis</h4>
                <p className="text-sm md:text-base text-muted-foreground mb-5 leading-relaxed">
                  Upload bank statements and financial documents. Our AI extracts key metrics and
                  flags anomalies automatically.
                </p>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>CSV Bank Statement Parsing</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>P&L Auto-Generation</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>Monthly Trend Analysis</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full" />
              <CardContent className="p-6 md:p-8">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <h4 className="text-lg md:text-xl font-semibold mb-3">Adverse Media Search</h4>
                <p className="text-sm md:text-base text-muted-foreground mb-5 leading-relaxed">
                  AI-powered web search scans for adverse media, legal issues, and reputational
                  risks associated with borrowers.
                </p>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>Real-time Web Search</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>Director Background Checks</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>Risk Flag Summaries</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* End-to-End Broker Engine Section */}
        <section id="workflow" className="dark:bg-[#0b0f19] py-20 md:py-24 bg-[#262525]">
          <div className="container mx-auto px-6 md:px-8 max-w-[1100px]">
            <div className="text-center mb-14 md:mb-16">
              <h3 className="text-3xl md:text-4xl font-extrabold mb-4 tracking-tight bg-gradient-to-r from-white to-indigo-400 bg-clip-text text-transparent">
                The End-to-End Broker Engine
              </h3>
              <p className="text-base md:text-lg text-gray-400 max-w-[700px] mx-auto leading-relaxed">
                One platform to find, enrich, and fund. Replace your fragmented stack with the AI-powered powerhouse for commercial finance.
              </p>
            </div>

            {/* 4-Step Flow Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
              <div className="bg-[#161b26] p-8 rounded-2xl border border-white/5 hover:border-indigo-500 hover:-translate-y-1 transition-all duration-300">
                <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center mb-5">
                  <Search className="h-6 w-6" />
                </div>
                <h4 className="text-white font-semibold text-lg mb-3">Target & Discover</h4>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Advanced search engine to filter prospects by industry, location, and name. You pick the targets; we provide the data.
                </p>
              </div>

              <div className="bg-[#161b26] p-8 rounded-2xl border border-white/5 hover:border-indigo-500 hover:-translate-y-1 transition-all duration-300">
                <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center mb-5">
                  <Zap className="h-6 w-6" />
                </div>
                <h4 className="text-white font-semibold text-lg mb-3">Enrich with Live Data</h4>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Move beyond stale bureau reports. Upload bank statements to get a realistic, real-time view of financial standing.
                </p>
              </div>

              <div className="bg-[#161b26] p-8 rounded-2xl border border-white/5 hover:border-indigo-500 hover:-translate-y-1 transition-all duration-300">
                <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center mb-5">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <h4 className="text-white font-semibold text-lg mb-3">Analyse & Match</h4>
                <p className="text-gray-400 text-sm leading-relaxed">
                  AI runs deep-tier risk assessments and matches your deal against a live database of lender criteria instantly.
                </p>
              </div>

              <div className="bg-[#161b26] p-8 rounded-2xl border border-white/5 hover:border-indigo-500 hover:-translate-y-1 transition-all duration-300">
                <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center mb-5">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h4 className="text-white font-semibold text-lg mb-3">Finalize & Fund</h4>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Review the AI-generated outputs, apply your expert judgment, and process the application through to completion.
                </p>
              </div>
            </div>

            {/* Comparison Table */}
            <div className="bg-gradient-to-b from-indigo-500/5 to-transparent p-6 md:p-10 rounded-3xl border border-indigo-500/20">
              <div className="text-center mb-8">
                <h4 className="text-white text-xl md:text-2xl font-semibold mb-2">
                  Consolidate Your Tech. Multiply Your Profit.
                </h4>
                <p className="text-gray-400">Eliminate SaaS sprawl and hidden administrative costs.</p>
              </div>

              {/* Mobile: Stacked Cards */}
              <div className="md:hidden space-y-4">
                {[
                  { category: "Credit Data", old: "Bureau Subscriptions", new: "Real-Time AI Enrichment", benefit: "Fresher Data" },
                  { category: "Pipeline Management", old: "Generalist CRM", new: "Integrated Finance Workflow", benefit: "Zero Context-Switching" },
                  { category: "Project Tracking", old: "Third-Party SaaS", new: "Automated Internal Engine", benefit: "Reduced Overhead" },
                  { category: "Back-Office Labour", old: "Manual Entry Hours", new: "AI Document Processing", benefit: "60% Faster Processing" },
                ].map((item, i) => (
                  <div key={i} className="bg-white/5 rounded-xl p-5 border border-white/10">
                    <div className="text-white font-semibold mb-3">{item.category}</div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-gray-500 text-xs uppercase mb-1">Before</div>
                        <div className="text-red-400 line-through opacity-70">{item.old}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-xs uppercase mb-1">With Veltro</div>
                        <div className="text-emerald-400 font-semibold">{item.new}</div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <span className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-xs">{item.benefit}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: Original Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left p-4 text-gray-400 uppercase text-xs tracking-wider font-medium">Category</th>
                      <th className="text-left p-4 text-gray-400 uppercase text-xs tracking-wider font-medium">Traditional Stack</th>
                      <th className="text-left p-4 uppercase text-xs tracking-wider font-medium">
                        <span className="text-[#D97706] animate-[glow_2s_ease-in-out_infinite]" style={{ textShadow: '0 0 10px rgba(217, 119, 6, 0.5), 0 0 20px rgba(217, 119, 6, 0.3)' }}>Veltro Advantage</span>
                      </th>
                      <th className="text-left p-4 text-gray-400 uppercase text-xs tracking-wider font-medium">Benefit</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-white/5">
                      <td className="p-5 text-white">Credit Data</td>
                      <td className="p-5 text-red-400 opacity-70"><span className="animate-[strikethrough_0.5s_ease-out_forwards_0.5s] strikethrough-animate">Bureau Subscriptions</span></td>
                      <td className="p-5 text-emerald-400 font-semibold">Real-Time AI Enrichment</td>
                      <td className="p-5"><span className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-xs animate-[benefitPulse_2s_ease-in-out_infinite]">Fresher Data</span></td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="p-5 text-white">Pipeline Management</td>
                      <td className="p-5 text-red-400 opacity-70"><span className="animate-[strikethrough_0.5s_ease-out_forwards_0.8s] strikethrough-animate">Generalist CRM</span></td>
                      <td className="p-5 text-emerald-400 font-semibold">Integrated Finance Workflow</td>
                      <td className="p-5"><span className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-xs animate-[benefitPulse_2s_ease-in-out_infinite_0.3s]">Zero Context-Switching</span></td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="p-5 text-white">Project Tracking</td>
                      <td className="p-5 text-red-400 opacity-70"><span className="animate-[strikethrough_0.5s_ease-out_forwards_1.1s] strikethrough-animate">Third-Party SaaS</span></td>
                      <td className="p-5 text-emerald-400 font-semibold">Automated Internal Engine</td>
                      <td className="p-5"><span className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-xs animate-[benefitPulse_2s_ease-in-out_infinite_0.6s]">Reduced Overhead</span></td>
                    </tr>
                    <tr>
                      <td className="p-5 text-white">Back-Office Labour</td>
                      <td className="p-5 text-red-400 opacity-70"><span className="animate-[strikethrough_0.5s_ease-out_forwards_1.4s] strikethrough-animate">Manual Entry Hours</span></td>
                      <td className="p-5 text-emerald-400 font-semibold">AI Document Processing</td>
                      <td className="p-5"><span className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-xs animate-[benefitPulse_2s_ease-in-out_infinite_0.9s]">60% Faster Processing</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Savings Calculator */}
            <SavingsCalculator />
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="container mx-auto px-6 md:px-8 py-20 md:py-24">
          <div className="text-center mb-12 md:mb-16">
            <Badge variant="outline" className="mb-6 px-3 py-1.5">
              <Layers className="h-4 w-4 mr-2" />
              <span className="text-sm font-medium">Complete Platform</span>
            </Badge>
            <h3 className="text-3xl md:text-4xl font-bold mb-5 tracking-tight">
              Everything You Need to Scale
            </h3>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Built specifically for commercial lending teams. No bloat, no complexity — just
              powerful tools that work.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 max-w-6xl mx-auto">
            <div className="flex gap-4 p-5 md:p-6 rounded-xl border bg-card">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-base">Companies House API</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Search by name, number, SIC code, postcode, or director.
                </p>
              </div>
            </div>

            <div className="flex gap-4 p-5 md:p-6 rounded-xl border bg-card">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-base">Contact Management</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Auto-sync officers from Companies House with enriched profiles.
                </p>
              </div>
            </div>

            <div className="flex gap-4 p-5 md:p-6 rounded-xl border bg-card">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-base">CRM & Activities</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Calendar, tasks, meetings, calls, and smart reminders.
                </p>
              </div>
            </div>

            <div className="flex gap-4 p-5 md:p-6 rounded-xl border bg-card">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-base">Document Storage</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Upload and organise documents by category.
                </p>
              </div>
            </div>

            <div className="flex gap-4 p-5 md:p-6 rounded-xl border bg-card">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-base">PDF Reports</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Generate professional prospect reports with customizable sections.
                </p>
              </div>
            </div>

            <div className="flex gap-4 p-5 md:p-6 rounded-xl border bg-card">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-base">Subscription Management</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Tiered plans with flexible payment options.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Role-Based Workflow */}
        <section className="bg-gradient-to-b from-muted/50 to-background py-20 md:py-24">
          <div className="container mx-auto px-6 md:px-8">
            <div className="text-center mb-12 md:mb-16">
              <Badge variant="outline" className="mb-6 px-3 py-1.5">
                <Users className="h-4 w-4 mr-2" />
                <span className="text-sm font-medium">Role-Based Workflow</span>
              </Badge>
              <h3 className="text-3xl md:text-4xl font-bold mb-5 tracking-tight">
                Broker & Underwriter Collaboration
              </h3>
              <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Streamlined internal credit review with dedicated queues, two-way messaging, and
                complete audit trails.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 md:gap-8 max-w-4xl mx-auto">
              <Card className="border-2">
                <CardContent className="p-6 md:p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-14 w-14 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <TrendingUp className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-lg md:text-xl font-semibold">Brokers</h4>
                      <p className="text-sm text-muted-foreground">Origination & Submission</p>
                    </div>
                  </div>
                  <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm leading-relaxed">
                        Submit prospects for internal underwriting review
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm leading-relaxed">
                        Set priority levels and add submission notes
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm leading-relaxed">
                        Reply to underwriter queries with attachments
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm leading-relaxed">
                        Track submission status with visual badges
                      </span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2">
                <CardContent className="p-6 md:p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-14 w-14 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                      <Shield className="h-7 w-7 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h4 className="text-lg md:text-xl font-semibold">Underwriters</h4>
                      <p className="text-sm text-muted-foreground">Review & Decision</p>
                    </div>
                  </div>
                  <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm leading-relaxed">
                        Deal Inbox with Prioritisation Queue
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm leading-relaxed">
                        Claim cases and manage workload efficiently
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm leading-relaxed">
                        Query brokers for additional information
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm leading-relaxed">
                        Approve, Decline, Query, or Withdraw
                      </span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section className="container mx-auto px-6 md:px-8 py-20 md:py-24">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
              <div>
                <Badge variant="outline" className="mb-6 px-3 py-1.5">
                  <Lock className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Enterprise Security</span>
                </Badge>
                <h3 className="text-3xl md:text-4xl font-bold mb-5 tracking-tight">
                  Bank-Grade Security & Compliance
                </h3>
                <p className="text-base md:text-lg text-muted-foreground mb-8 leading-relaxed">
                  Your data is protected with enterprise-grade security. Full audit trails,
                  role-based access, and GDPR compliance built-in.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="text-base">User-specific data isolation</span>
                  </li>
                  <li className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="text-base">Complete activity audit trails</span>
                  </li>
                  <li className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="text-base">Role-based access controls</span>
                  </li>
                  <li className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="text-base">Secure document storage</span>
                  </li>
                </ul>
              </div>
              <div className="grid grid-cols-2 gap-4 md:gap-5">
                <Card>
                  <CardContent className="p-6 md:p-8 text-center">
                    <Shield className="h-10 w-10 mx-auto mb-4 text-primary" />
                    <h4 className="font-semibold text-base">GDPR</h4>
                    <p className="text-sm text-muted-foreground">Compliant</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 md:p-8 text-center">
                    <Lock className="h-10 w-10 mx-auto mb-4 text-primary" />
                    <h4 className="font-semibold text-base">Encrypted</h4>
                    <p className="text-sm text-muted-foreground">Data at Rest</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 md:p-8 text-center">
                    <Users className="h-10 w-10 mx-auto mb-4 text-primary" />
                    <h4 className="font-semibold text-base">SSO</h4>
                    <p className="text-sm text-muted-foreground">Authentication</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 md:p-8 text-center">
                    <FileCheck className="h-10 w-10 mx-auto mb-4 text-primary" />
                    <h4 className="font-semibold text-base">Audit</h4>
                    <p className="text-sm text-muted-foreground">Full Trail</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Social Proof Section */}
        <section className="bg-[#0f172a] text-white py-16 md:py-20">
          <div className="container mx-auto px-6 md:px-8">
            <div className="max-w-3xl mx-auto text-center">
              <h3 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
                The Future of Lending is <span className="text-[#D97706]">Fast.</span>
              </h3>
              <p className="text-lg text-gray-300 mb-8">
                Join the brokers who have stopped chasing paper and started breaking records.
              </p>
              <div className="flex justify-center mb-6">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-6 w-6 fill-[#D97706] text-[#D97706]" />
                ))}
              </div>
              <blockquote className="text-xl md:text-2xl font-medium mb-6 leading-relaxed text-gray-200">
                "Veltro transformed how we manage our lending pipeline. The AI credit underwriting
                alone saves us hours every week."
              </blockquote>
              <p className="text-gray-400 text-base">
                — Commercial Finance Broker, UK
              </p>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="container mx-auto px-6 md:px-8 py-20 md:py-24 text-center">
          <div className="max-w-2xl mx-auto">
            <Badge variant="secondary" className="mb-8 px-4 py-2">
              <Zap className="h-4 w-4 mr-2" />
              <span className="text-sm font-medium">Get Started in Minutes</span>
            </Badge>
            <h3 className="text-3xl md:text-4xl font-bold mb-6 tracking-tight">
              Ready to Transform Your Lending Workflow?
            </h3>
            <p className="text-base md:text-lg text-muted-foreground mb-10 leading-relaxed">
              Start with 10 free prospects. No credit card required. Upgrade anytime to unlock
              AI-powered credit underwriting.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={handleLogin}
                className="gap-2 text-base px-8 h-12 font-semibold bg-[#D97706] hover:bg-[#B45309] text-white"
                data-testid="button-sign-up-cta"
              >
                Start Free Trial Now
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="gap-2 h-12 font-medium">
                  View Pricing
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      {/* Footer */}
      <footer className="border-t py-12 md:py-16 bg-muted/30">
        <div className="container mx-auto px-6 md:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img
                src={logoChrome}
                alt="Veltro"
                className="h-8 object-contain"
                data-testid="img-logo-footer"
              />
            </div>
            <div className="flex items-center gap-8 text-sm text-muted-foreground">
              <Link href="/pricing">
                <span className="hover:text-foreground transition-colors cursor-pointer font-medium">
                  Pricing
                </span>
              </Link>
              <span className="hover:text-foreground transition-colors cursor-pointer">
                Privacy Policy
              </span>
              <span className="hover:text-foreground transition-colors cursor-pointer">
                Terms of Service
              </span>
            </div>
            <p className="text-sm text-muted-foreground">© 2024 Veltro. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
