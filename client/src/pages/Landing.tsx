import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import logoChrome from "@assets/logo-chrome.png";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Rocket,
  Megaphone,
  ArrowRight,
  Clock,
  PoundSterling,
  TrendingUp,
  Search,
  Wrench,
  PenTool,
  Send,
  CheckCircle,
  ShieldCheck,
  BarChart3,
  Users,
  Target,
  Loader2,
  Mail,
} from "lucide-react";

const services = [
  {
    icon: Clock,
    title: "Cut the Admin",
    description:
      "All those repetitive tasks eating your day — data entry, chasing updates, copy-pasting between systems. I build tools that handle it automatically so your team can focus on actual work.",
  },
  {
    icon: PoundSterling,
    title: "Reduce Your Costs",
    description:
      "Stop paying people to do work a computer should be doing. Smart automation cuts overheads, reduces errors, and pays for itself within months — not years.",
  },
  {
    icon: Target,
    title: "Win More Business",
    description:
      "Respond to enquiries faster, follow up automatically, and never let a lead slip through the cracks. Your competitors are still using spreadsheets. You won't be.",
  },
  {
    icon: Users,
    title: "Free Up Your People",
    description:
      "Your best staff shouldn't be stuck on 'busy' work. Give them tools that handle the routine so they can spend their time on what actually grows the business.",
  },
];

const processSteps = [
  {
    icon: Search,
    title: "We Talk",
    description:
      "I sit down with you, understand how your business actually works, and find where time and money are being wasted.",
  },
  {
    icon: PenTool,
    title: "We Plan",
    description:
      "You get a clear proposal. What we'll build, what it'll cost, and exactly how it saves you money. No jargon.",
  },
  {
    icon: Wrench,
    title: "We Build",
    description:
      "You see progress every week. Real, working software you can try, not slides and empty promises.",
  },
  {
    icon: Rocket,
    title: "You Grow",
    description:
      "Your new system goes live. I make sure your team knows how to use it and I'm there if anything needs adjusting.",
  },
];

export default function Landing() {
  const [, setLocation] = useLocation();
  const [hoursPerWeek, setHoursPerWeek] = useState<number[]>([20]);
  const [hourlyRate, setHourlyRate] = useState<number[]>([50]);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistName, setWaitlistName] = useState("");
  const [waitlistCompany, setWaitlistCompany] = useState("");
  const [waitlistTrialInterest, setWaitlistTrialInterest] = useState(false);
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [waitlistResult, setWaitlistResult] = useState<"success" | "exists" | "error" | null>(null);

  const roiCalculations = useMemo(() => {
    const hours = hoursPerWeek[0];
    const rate = hourlyRate[0];
    const annualManualCost = hours * rate * 52;
    const automationEfficiency = 0.7;
    const annualSavings = annualManualCost * automationEfficiency;
    const monthlyHoursSaved = hours * automationEfficiency * 4.33;
    return { annualManualCost, annualSavings, monthlyHoursSaved };
  }, [hoursPerWeek, hourlyRate]);

  const handleLogin = () => {
    setLocation("/auth");
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail.trim()) return;
    setWaitlistSubmitting(true);
    setWaitlistResult(null);
    try {
      const res = await fetch("/api/marketing/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: waitlistEmail.trim(),
          firstName: waitlistName.trim() || undefined,
          companyName: waitlistCompany.trim() || undefined,
          trialInterest: waitlistTrialInterest,
          source: "landing",
        }),
      });
      if (res.status === 409) {
        setWaitlistResult("exists");
      } else if (res.ok) {
        setWaitlistResult("success");
        setWaitlistEmail("");
        setWaitlistName("");
        setWaitlistCompany("");
        setWaitlistTrialInterest(false);
      } else {
        setWaitlistResult("error");
      }
    } catch {
      setWaitlistResult("error");
    } finally {
      setWaitlistSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a]">
      <div className="bg-[#0f172a] relative">
        {/* Header */}
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
            <nav className="hidden md:flex items-center gap-6">
              {[
                { label: "Services", href: "#services" },
                { label: "Savings", href: "#savings" },
                { label: "Results", href: "#results" },
                { label: "Process", href: "#process" },
                { label: "Pricing", href: "#pricing" },
                { label: "Contact", href: "#contact" },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => {
                    e.preventDefault();
                    document.querySelector(link.href)?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <Button
              variant="ghost"
              className="font-semibold text-gray-300 hover:text-white hover:bg-white/10"
              onClick={handleLogin}
              data-testid="button-sign-in"
            >
              Login
            </Button>
          </div>
        </header>

        {/* Hero Section */}
        <section className="relative overflow-hidden pt-20">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a] via-[#0f172a] to-[#1e293b]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#D97706]/10 via-transparent to-transparent opacity-60" />

          {/* Animated Background Elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-20 left-[10%] w-72 h-72 bg-[#D97706]/20 rounded-full blur-3xl animate-[pulse_4s_ease-in-out_infinite]" />
            <div className="absolute top-40 right-[15%] w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-[pulse_6s_ease-in-out_infinite_1s]" />
            <div className="absolute bottom-20 left-[20%] w-64 h-64 bg-[#D97706]/15 rounded-full blur-3xl animate-[pulse_5s_ease-in-out_infinite_2s]" />

            <div className="absolute inset-0 opacity-[0.03] landing-grid-bg" />

            <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-[#D97706] rounded-full opacity-60 animate-[floatParticle_8s_ease-in-out_infinite]" />
            <div className="absolute top-1/3 right-1/3 w-1.5 h-1.5 bg-white rounded-full opacity-40 animate-[floatParticle_6s_ease-in-out_infinite_1s]" />
            <div className="absolute top-2/3 left-1/3 w-1 h-1 bg-[#D97706] rounded-full opacity-50 animate-[floatParticle_10s_ease-in-out_infinite_2s]" />
            <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-emerald-400 rounded-full opacity-30 animate-[floatParticle_7s_ease-in-out_infinite_3s]" />
            <div className="absolute bottom-1/3 right-1/2 w-1.5 h-1.5 bg-[#D97706] rounded-full opacity-40 animate-[floatParticle_9s_ease-in-out_infinite_4s]" />

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
                className="h-24 md:h-32 lg:h-36 object-contain mx-auto mb-8 animate-[float_3s_ease-in-out_infinite] drop-shadow-[0_0_20px_rgba(217,119,6,0.3)]"
                data-testid="img-logo-hero"
              />

              <p
                className="typewriter-text inline-block mb-6 text-lg md:text-xl font-bold text-white overflow-hidden whitespace-nowrap border-r-2 border-[#D97706] mx-auto"
              >
                Forward Development Engineering
              </p>

              <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-4 leading-tight tracking-tight text-white">
                Bred for Speed
              </h1>
              <h2 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-8 leading-tight tracking-tight">
                <span className="text-[#D97706]">Built for Business</span>
              </h2>

              <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10">
                We build bespoke software that saves your business time and money.
                Less admin. Lower costs. More sales. It's that simple.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  className="bg-[#D97706] hover:bg-[#B45309] text-white px-8 py-3 text-lg"
                  onClick={() => scrollTo("contact")}
                >
                  Let's Talk{" "}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-white/10 px-8 py-3 text-lg"
                  onClick={() => scrollTo("results")}
                >
                  See the Results
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Services Section */}
      <section id="services" className="relative py-20 md:py-28 bg-[#0f172a]">
        <div className="container mx-auto px-6 md:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              How We Help Your <span className="text-[#D97706]">Business</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">
              No buzzwords. No BS. No false promises...
            </p>
            <p>
              Just practical tools to make your business better in every way!
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service, i) => (
              <Card
                key={i}
                className="bg-white/[0.03] border-white/[0.06] backdrop-blur-sm hover:border-[#D97706]/40 hover:bg-white/[0.05] transition-all duration-500 group"
              >
                <CardContent className="p-6 pt-6">
                  <div className="w-12 h-12 rounded-lg bg-[#D97706]/10 flex items-center justify-center mb-4 group-hover:bg-[#D97706]/20 transition-colors">
                    <service.icon className="h-6 w-6 text-[#D97706]" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {service.title}
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {service.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ROI Calculator Section */}
      <section id="savings" className="relative py-20 md:py-28 bg-gradient-to-b from-[#0f172a] to-[#1e293b]">
        <div className="container mx-auto px-6 md:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              How Much Could You <span className="text-[#D97706]">Save</span>?
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">
              Drag the sliders below. The numbers speak for themselves.
            </p>
          </div>
          <div className="max-w-4xl mx-auto">
            <Card className="bg-white/[0.03] border-white/[0.06] backdrop-blur-sm">
              <CardContent className="p-8 pt-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  {/* Inputs */}
                  <div className="space-y-8">
                    <div>
                      <div className="flex justify-between mb-3">
                        <label className="text-gray-300 font-medium">
                          Hours your team spends on repetitive tasks per week
                        </label>
                        <span className="text-[#D97706] font-bold text-lg">
                          {hoursPerWeek[0]}h
                        </span>
                      </div>
                      <Slider
                        value={hoursPerWeek}
                        onValueChange={setHoursPerWeek}
                        min={5}
                        max={80}
                        step={5}
                        className="[&_[role=slider]]:bg-[#D97706] [&_[role=slider]]:border-[#D97706] [&_span>span]:bg-[#D97706]"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between mb-3">
                        <label className="text-gray-300 font-medium">
                          What you pay per hour for that work
                        </label>
                        <span className="text-[#D97706] font-bold text-lg">
                          £{hourlyRate[0]}
                        </span>
                      </div>
                      <Slider
                        value={hourlyRate}
                        onValueChange={setHourlyRate}
                        min={15}
                        max={150}
                        step={5}
                        className="[&_[role=slider]]:bg-[#D97706] [&_[role=slider]]:border-[#D97706] [&_span>span]:bg-[#D97706]"
                      />
                    </div>
                    <p className="text-gray-500 text-xs">
                      These figures assume 70% of that work can be automated —
                      a realistic, conservative estimate based on real projects.
                    </p>
                  </div>

                  {/* Results */}
                  <div className="space-y-6">
                    <div className="bg-white/[0.03] rounded-xl p-6 border border-white/[0.06]">
                      <div className="flex items-center gap-3 mb-2">
                        <PoundSterling className="h-5 w-5 text-red-400" />
                        <span className="text-gray-400 text-sm">
                          What That Costs You Per Year
                        </span>
                      </div>
                      <p className="text-3xl font-bold text-red-400">
                        £{roiCalculations.annualManualCost.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-[#D97706]/10 rounded-xl p-6 border border-[#D97706]/20">
                      <div className="flex items-center gap-3 mb-2">
                        <TrendingUp className="h-5 w-5 text-[#D97706]" />
                        <span className="text-gray-400 text-sm">
                          What You Could Save Annually
                        </span>
                      </div>
                      <p className="text-3xl font-bold text-[#D97706]">
                        £{roiCalculations.annualSavings.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-white/[0.03] rounded-xl p-6 border border-white/[0.06]">
                      <div className="flex items-center gap-3 mb-2">
                        <Clock className="h-5 w-5 text-emerald-400" />
                        <span className="text-gray-400 text-sm">
                          Hours Your Team Gets Back Every Month
                        </span>
                      </div>
                      <p className="text-3xl font-bold text-emerald-400">
                        {Math.round(roiCalculations.monthlyHoursSaved)} hours
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Results / Case Studies Section */}
      <section
        id="results"
        className="relative py-20 md:py-28 bg-[#1e293b]"
      >
        <div className="container mx-auto px-6 md:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Real <span className="text-[#D97706]">Results</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">
              Here's what happens when you stop doing things the hard way
            </p>
          </div>
          <div className="max-w-4xl mx-auto space-y-8">

            {/* Case Study 1: Veltro */}
            <Card className="bg-white/[0.03] border-white/[0.06] backdrop-blur-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="grid grid-cols-1 lg:grid-cols-5">
                  <div className="lg:col-span-2 bg-gradient-to-br from-[#D97706]/20 to-[#1e293b] p-8 flex flex-col items-center justify-center min-h-[200px]">
                    <img
                      src={logoChrome}
                      alt="Veltro"
                      className="h-20 mb-4 animate-[float_3s_ease-in-out_infinite]"
                    />
                    <Badge className="bg-[#D97706]/20 text-[#D97706] border-[#D97706]/30">
                      Live Platform
                    </Badge>
                  </div>
                  <div className="lg:col-span-3 p-8">
                    <h3 className="text-2xl font-bold text-white mb-2">
                      Finance Company
                    </h3>
                    <h2>
                      From Spreadsheets to a Complete Platform
                    </h2>
                    <p className="text-gray-400 mb-6">
                      A commercial finance business was drowning in spreadsheets,
                      manual data entry, and missed follow-ups. I built them a
                      complete system that handles everything from finding new
                      clients to closing deals — automatically.
                    </p>
                    <div className="space-y-3 mb-6">
                      {[
                        "Handles your ENTIRE workflow — no more lost paperwork",
                        "Automatically assesses new applications in seconds, not hours",
                        "Matches deals to the right lender instantly, staff used to spend days on this",
                        "Tracks every lead and follows up automatically so nothing falls through the cracks",
                        "Cut admin time by over 60%, freeing the team to close more deals",
                      ].map((item, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-[#D97706] mt-0.5 shrink-0" />
                          <span className="text-gray-300 text-sm">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Case Study 2: ComplianceGuard */}
            <Card className="bg-white/[0.03] border-white/[0.06] backdrop-blur-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="grid grid-cols-1 lg:grid-cols-5">
                  <div className="lg:col-span-2 bg-gradient-to-br from-emerald-500/15 to-[#1e293b] p-8 flex flex-col items-center justify-center min-h-[200px]">
                    <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 animate-[float_3s_ease-in-out_infinite]">
                      <ShieldCheck className="h-10 w-10 text-emerald-400" />
                    </div>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      In Development
                    </Badge>
                  </div>
                  <div className="lg:col-span-3 p-8">
                    <h3 className="text-2xl font-bold text-white mb-2">
                      Regulated Business
                    </h3>
                    <h2>
                      Compliance Without the Headaches
                    </h2>
                    <p className="text-gray-400 mb-6">
                      Businesses in regulated industries spend thousands on
                      compliance reviews and live in fear of getting it wrong.
                      This system reads your policies, spots the gaps, and
                      generates the reports your regulator needs — automatically.
                    </p>
                    <div className="space-y-3 mb-6">
                      {[
                        "Reads and checks your policy documents so your team doesn't have to",
                        "Spots compliance gaps before your regulator does",
                        "Alerts you when regulations change so you're never caught off guard",
                        "Generates audit-ready reports at the click of a button",
                        "Cuts compliance review time by 80% — saving thousands in consultant fees",
                      ].map((item, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
                          <span className="text-gray-300 text-sm">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Case Study 3: PulseOps */}
            <Card className="bg-white/[0.03] border-white/[0.06] backdrop-blur-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="grid grid-cols-1 lg:grid-cols-5">
                  <div className="lg:col-span-2 bg-gradient-to-br from-emerald-500/15 to-[#1e293b] p-8 flex flex-col items-center justify-center min-h-[200px]">
                    <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 animate-[float_3s_ease-in-out_infinite]">
                      <BarChart3 className="h-10 w-10 text-emerald-400" />
                    </div>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      In Development
                    </Badge>
                  </div>
                  <div className="lg:col-span-3 p-8">
                    <h3 className="text-2xl font-bold text-white mb-2">
                      Operations Company
                    </h3>
                    <h2>
                      See Your Whole Business in One Place
                    </h2>
                    <p className="text-gray-400 mb-6">
                      Most businesses run on 5-10 different systems that don't talk
                      to each other. This dashboard pulls everything together so you
                      can see what's working, what's not, and where the money is
                      going — without ringing three different people.
                    </p>
                    <div className="space-y-3 mb-6">
                      {[
                        "Pulls data from all your existing systems into one clear dashboard",
                        "Spots problems and bottlenecks before they cost you money",
                        "Shows you exactly where your business is losing time and revenue",
                        "Forecasts what's coming so you can plan ahead, not react",
                        "Weekly summary reports sent straight to your inbox — no chasing required",
                      ].map((item, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
                          <span className="text-gray-300 text-sm">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Case Study 4: Lead Generation */}
            <Card className="bg-white/[0.03] border-white/[0.06] backdrop-blur-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="grid grid-cols-1 lg:grid-cols-5">
                  <div className="lg:col-span-2 bg-gradient-to-br from-amber-500/15 to-[#1e293b] p-8 flex flex-col items-center justify-center min-h-[200px]">
                    <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 animate-[float_3s_ease-in-out_infinite]">
                      <Megaphone className="h-10 w-10 text-amber-400" />
                    </div>
                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                      In Development
                    </Badge>
                  </div>
                  <div className="lg:col-span-3 p-8">
                    <h3 className="text-2xl font-bold text-white mb-2">
                      Sales Team
                    </h3>
                    <h2>
                      Leads That Actually Convert
                    </h2>
                    <p className="text-gray-400 mb-6">
                      Most businesses waste hours chasing cold leads that go nowhere.
                      This system finds the right prospects, qualifies them automatically,
                      and puts warm, ready-to-buy leads straight into your sales team's
                      hands — so they spend their time closing, not searching.
                    </p>
                    <div className="space-y-3 mb-6">
                      {[
                        "Automatically finds and qualifies new prospects from public business data",
                        "Scores every lead so your team knows who to call first",
                        "Sends personalised outreach automatically — emails, follow-ups, the lot",
                        "Tracks every interaction so nothing gets forgotten or duplicated",
                        "Increased qualified leads by 3x while cutting prospecting time in half",
                      ].map((item, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
                          <span className="text-gray-300 text-sm">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </section>

      {/* Process Section */}
      <section id="process" className="relative py-20 md:py-28 bg-gradient-to-b from-[#1e293b] to-[#0f172a]">
        <div className="container mx-auto px-6 md:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              How It <span className="text-[#D97706]">Works</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">
              No lengthy contracts. No confusing jargon. Just a straightforward
              process that gets you results.
            </p>
          </div>
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
              {/* Connector line (desktop only) */}
              <div className="hidden md:block absolute top-10 left-[12.5%] right-[12.5%] h-[2px] bg-gradient-to-r from-[#D97706]/50 via-[#D97706] to-[#D97706]/50" />
              {processSteps.map((step, i) => (
                <div key={i} className="text-center relative">
                  <div className="w-20 h-20 rounded-full bg-[#0f172a] border-2 border-[#D97706]/30 flex items-center justify-center mx-auto mb-4 relative z-10">
                    <step.icon className="h-8 w-8 text-[#D97706]" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {step.title}
                  </h3>
                  <p className="text-gray-400 text-sm">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof / Trust Section */}
      <section className="relative py-16 bg-[#0f172a]">
        <div className="container mx-auto px-6 md:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div>
                <p className="text-4xl md:text-5xl font-bold text-[#D97706] mb-2">£ Millions</p>
                <p className="text-gray-400 text-sm">Saved for businesses by cutting waste and automating the boring stuff</p>
              </div>
              <div>
                <p className="text-4xl md:text-5xl font-bold text-[#D97706] mb-2">60%+</p>
                <p className="text-gray-400 text-sm">Less time on admin — more time growing your business</p>
              </div>
              <div>
                <p className="text-4xl md:text-5xl font-bold text-[#D97706] mb-2">Weeks</p>
                <p className="text-gray-400 text-sm">From first chat to working software that makes your life easier</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative py-20 md:py-28 bg-gradient-to-b from-[#0f172a] to-[#1e293b]">
        <div className="container mx-auto px-6 md:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Simple, Honest <span className="text-[#D97706]">Pricing</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">
              No hidden fees. No surprises. Every project starts with a free conversation to understand what you actually need.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter */}
            <Card className="bg-white/[0.03] border-white/[0.06] backdrop-blur-sm hover:border-white/[0.12] transition-all duration-300">
              <CardContent className="p-8">
                <h3 className="text-xl font-bold text-white mb-2">Starter</h3>
                <p className="text-gray-400 text-sm mb-6">Perfect for one quick win that saves you time straight away</p>
                <p className="text-3xl font-bold text-white mb-1">
                  From <span className="text-[#D97706]">£1,500</span>
                </p>
                <p className="text-gray-500 text-xs mb-8">one-off project fee</p>
                <ul className="space-y-3 mb-8">
                  {[
                    "One workflow automated",
                    "Up and running in 1–2 weeks",
                    "Full handover & training",
                    "30 days free support",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-gray-300 text-sm">
                      <CheckCircle className="h-4 w-4 text-[#D97706] mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full bg-white/10 hover:bg-white/20 text-white border-0"
                  onClick={() => document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Let's Talk
                </Button>
              </CardContent>
            </Card>

            {/* Growth — highlighted */}
            <Card className="bg-white/[0.05] border-[#D97706]/30 backdrop-blur-sm ring-1 ring-[#D97706]/20 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-[#D97706] text-white border-0 hover:bg-[#D97706]">Most Popular</Badge>
              </div>
              <CardContent className="p-8">
                <h3 className="text-xl font-bold text-white mb-2">Growth</h3>
                <p className="text-gray-400 text-sm mb-6">For businesses ready to properly streamline how they work</p>
                <p className="text-3xl font-bold text-white mb-1">
                  From <span className="text-[#D97706]">£5,000</span>
                </p>
                <p className="text-gray-500 text-xs mb-8">scoped to your needs</p>
                <ul className="space-y-3 mb-8">
                  {[
                    "Multiple workflows automated",
                    "Integrations with your existing tools",
                    "Custom dashboard & reporting",
                    "3 months support included",
                    "Staff training & documentation",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-gray-300 text-sm">
                      <CheckCircle className="h-4 w-4 text-[#D97706] mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full bg-[#D97706] hover:bg-[#B45309] text-white border-0"
                  onClick={() => document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Let's Talk
                </Button>
              </CardContent>
            </Card>

            {/* Enterprise */}
            <Card className="bg-white/[0.03] border-white/[0.06] backdrop-blur-sm hover:border-white/[0.12] transition-all duration-300">
              <CardContent className="p-8">
                <h3 className="text-xl font-bold text-white mb-2">Enterprise</h3>
                <p className="text-gray-400 text-sm mb-6">Full platform builds for businesses that want to change the game</p>
                <p className="text-3xl font-bold text-white mb-1">
                  <span className="text-[#D97706]">Custom</span>
                </p>
                <p className="text-gray-500 text-xs mb-8">tailored to your business</p>
                <ul className="space-y-3 mb-8">
                  {[
                    "End-to-end platform development",
                    "Ongoing support & maintenance",
                    "Priority response times",
                    "Dedicated monthly retainer option",
                    "Scale as your business grows",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-gray-300 text-sm">
                      <CheckCircle className="h-4 w-4 text-[#D97706] mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full bg-white/10 hover:bg-white/20 text-white border-0"
                  onClick={() => document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Let's Talk
                </Button>
              </CardContent>
            </Card>
          </div>
          <p className="text-center text-gray-500 text-sm mt-10 max-w-xl mx-auto">
            Every project is different — these are starting points. We'll have a free chat, I'll understand what you need, and you'll get a clear quote with no obligation.
          </p>
        </div>
      </section>

      {/* CTA / Contact Section */}
      <section id="contact" className="relative py-20 md:py-28 bg-[#0f172a]">
        <div className="container mx-auto px-6 md:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
              Tired of Doing Things the <span className="text-[#D97706]">Hard Way</span>?
            </h2>
            <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto">
              Join the waiting list and be the first to know when we launch new tools
              that can transform your business.
            </p>

            {waitlistResult === "success" ? (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-8 max-w-md mx-auto">
                <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">You're on the list!</h3>
                <p className="text-gray-400 text-sm">
                  We'll be in touch soon with updates and exclusive offers.
                </p>
              </div>
            ) : (
              <form onSubmit={handleWaitlistSubmit} className="max-w-md mx-auto space-y-4">
                <Input
                  type="email"
                  required
                  placeholder="Your email address *"
                  value={waitlistEmail}
                  onChange={(e) => setWaitlistEmail(e.target.value)}
                  className="bg-white/[0.05] border-white/[0.1] text-white placeholder:text-gray-500 h-12"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="First name"
                    value={waitlistName}
                    onChange={(e) => setWaitlistName(e.target.value)}
                    className="bg-white/[0.05] border-white/[0.1] text-white placeholder:text-gray-500 h-12"
                  />
                  <Input
                    placeholder="Company name"
                    value={waitlistCompany}
                    onChange={(e) => setWaitlistCompany(e.target.value)}
                    className="bg-white/[0.05] border-white/[0.1] text-white placeholder:text-gray-500 h-12"
                  />
                </div>
                <label className="flex items-center gap-3 cursor-pointer text-left">
                  <Checkbox
                    checked={waitlistTrialInterest}
                    onCheckedChange={(checked) => setWaitlistTrialInterest(checked === true)}
                    className="border-white/20 data-[state=checked]:bg-[#D97706] data-[state=checked]:border-[#D97706]"
                  />
                  <span className="text-sm text-gray-300">
                    I'm interested in the <span className="text-[#D97706] font-medium">£49/month trial</span> for lead generation tools
                  </span>
                </label>
                <Button
                  type="submit"
                  disabled={waitlistSubmitting || !waitlistEmail.trim()}
                  className="w-full bg-[#D97706] hover:bg-[#B45309] text-white h-12 text-lg"
                >
                  {waitlistSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <Mail className="h-5 w-5 mr-2" />
                  )}
                  {waitlistSubmitting ? "Joining..." : "Join the Waiting List"}
                </Button>
                {waitlistResult === "exists" && (
                  <p className="text-amber-400 text-sm">
                    You're already on the waiting list — we'll be in touch!
                  </p>
                )}
                {waitlistResult === "error" && (
                  <p className="text-red-400 text-sm">
                    Something went wrong. Please try again.
                  </p>
                )}
                <p className="text-gray-600 text-xs">
                  No spam, ever. Unsubscribe anytime.
                </p>
              </form>
            )}

            <Separator className="bg-white/10 my-12" />
            <p className="text-gray-500 text-sm">
              &copy; {new Date().getFullYear()} Veltro - Forward Development Engineering
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
